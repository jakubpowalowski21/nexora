import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import type Stripe from "stripe";
import { db, type Transaction } from "@/src/db";
import {
  cartItems,
  inventory,
  movements,
  orderHistory,
  orderItems,
  orders,
  redemptions,
  reservations,
  shipments,
  webhookEvents,
} from "@/src/db/schema";
import { deliverOutbox, queueMail } from "@/src/features/mail/outbox";
import { fulfillmentLabels, money, siteUrl } from "@/src/lib/format";
import type { checkoutInput } from "@/src/lib/validation";
import { getStripe } from "@/src/lib/stripe";
import { canAdvance } from "./pricing";
import { OrderError, quote } from "./quote";

type Order = typeof orders.$inferSelect;
type Input = z.infer<typeof checkoutInput>;
type Fulfillment = Order["fulfillment"];

export const orderNumber = (order: Pick<Order, "createdAt" | "sequence">) =>
  `NX-${new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Warsaw" }).format(order.createdAt)}-${String(order.sequence).padStart(6, "0")}`;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const lookup = (requestId: string) => {
  if (!process.env.AUTH_SECRET)
    throw new OrderError("Sklep nie ma skonfigurowanych zamówień.");
  return createHmac("sha256", process.env.AUTH_SECRET)
    .update(`order:${requestId}`)
    .digest("base64url");
};
export function validLookup(order: Order, token?: string) {
  return (
    typeof token === "string" &&
    /^[a-zA-Z0-9_-]{43}$/.test(token) &&
    timingSafeEqual(Buffer.from(hash(token)), Buffer.from(order.lookupHash))
  );
}
export function confirmationURL(order: Order, outcome = "sukces") {
  return `${siteUrl()}/zamowienie/${outcome}?id=${order.id}&klucz=${lookup(order.requestId)}`;
}

export async function createOrder(input: Input, userId?: string) {
  if (
    input.payment === "stripe" &&
    (!getStripe() || !process.env.STRIPE_WEBHOOK_SECRET)
  )
    throw new OrderError(
      "Płatność Stripe jest chwilowo niedostępna. Wybierz przelew demonstracyjny.",
    );
  const lookupHash = hash(lookup(input.requestId));
  const result = await db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`,
    );
    const [existing] = await tx
      .select()
      .from(orders)
      .where(eq(orders.requestId, input.requestId));
    if (existing) {
      if (
        existing.userId !== (userId ?? null) ||
        existing.email !== input.email ||
        existing.paymentMethod !== input.payment
      )
        throw new OrderError("Odśwież checkout i spróbuj ponownie.");
      if (existing.fulfillment === "cancelled")
        throw new OrderError(
          "To zamówienie wygasło. Wróć do koszyka i złóż nowe zamówienie.",
        );
      return existing;
    }
    const storeQuote = await quote(input, input.email, tx);
    if (
      storeQuote.issues.length ||
      !storeQuote.items.length ||
      storeQuote.couponError
    )
      throw new OrderError(
        storeQuote.issues[0] || storeQuote.couponError || "Koszyk jest pusty.",
      );
    if (
      input.payment === "stripe" &&
      (storeQuote.total < 200 || storeQuote.total > 99_999_999)
    ) {
      throw new OrderError(
        "Kwota wykracza poza zakres płatności testowej kartą. Wybierz przelew demonstracyjny.",
      );
    }
    const expiresAt = new Date(
      Date.now() +
        (input.payment === "stripe" ? 45 * 60_000 : 24 * 60 * 60_000),
    );
    const { name, street, zip, city, country, phone, company, nip } = input;
    const [order] = await tx
      .insert(orders)
      .values({
        requestId: input.requestId,
        lookupHash,
        userId,
        email: input.email,
        address: { name, street, zip, city, country, phone, company, nip },
        shippingMethod: input.shipping,
        paymentMethod: input.payment,
        subtotal: storeQuote.subtotal,
        discount: storeQuote.discount,
        shippingCost: storeQuote.delivery,
        total: storeQuote.total,
        expiresAt,
      })
      .returning();
    for (const item of storeQuote.items) {
      const held = await tx
        .update(inventory)
        .set({ reserved: sql`${inventory.reserved} + ${item.quantity}` })
        .where(
          and(
            eq(inventory.variantId, item.id),
            sql`${inventory.stock} - ${inventory.reserved} >= ${item.quantity}`,
          ),
        )
        .returning({ id: inventory.variantId });
      if (!held.length)
        throw new OrderError(
          `Zmieniono dostępność produktu ${item.name}. Sprawdź koszyk.`,
        );
      await tx.insert(orderItems).values({
        orderId: order.id,
        variantId: item.id,
        productId: item.productId,
        name: item.name,
        variant: item.variant,
        sku: item.sku,
        unitPrice: item.price,
        regularPrice: item.regular,
        quantity: item.quantity,
        tax: item.tax,
      });
      await tx.insert(reservations).values({
        orderId: order.id,
        variantId: item.id,
        quantity: item.quantity,
      });
      await tx.insert(movements).values({
        orderId: order.id,
        variantId: item.id,
        delta: 0,
        reservedDelta: item.quantity,
        reason: "Rezerwacja zamówienia",
      });
    }
    if (input.coupon && storeQuote.discount)
      await tx
        .insert(redemptions)
        .values({ orderId: order.id, code: input.coupon, email: input.email });
    await tx
      .insert(orderHistory)
      .values({ orderId: order.id, label: "Przyjęto zamówienie" });
    await queueMail(
      tx,
      `order:${order.id}`,
      order.email,
      `NEXORA • Zamówienie ${orderNumber(order)}`,
      `Dziękujemy za zamówienie ${orderNumber(order)}. Łączna kwota wynosi ${money(order.total)}.\n\n${confirmationURL(order)}\n\nZamówienie demonstracyjne. Nie wysyłaj pieniędzy.`,
    );
    return order;
  });
  if (result.paymentMethod === "transfer" || result.payment !== "pending") {
    await deliverOutbox();
    return { url: confirmationURL(result) };
  }
  const stripe = getStripe()!;
  try {
    const session = result.stripeSession
      ? await stripe.checkout.sessions.retrieve(result.stripeSession)
      : await openStripeSession(result, stripe);
    if (session.status === "complete") return { url: confirmationURL(result) };
    if (!session.url || session.status !== "open")
      throw new OrderError(
        "Sesja płatności wygasła. Wróć do koszyka, aby złożyć nowe zamówienie.",
      );
    await deliverOutbox();
    return { url: session.url };
  } catch (error) {
    if (error instanceof OrderError) throw error;
    console.warn("NEXORA: nie udało się uruchomić Stripe Checkout.");
    throw new OrderError(
      "Nie udało się otworzyć płatności. Ponów próbę lub wróć do koszyka. Nieopłacona rezerwacja wygaśnie automatycznie.",
    );
  }
}

async function openStripeSession(order: Order, stripe: Stripe) {
  return db().transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, order.id))
      .for("update");
    if (
      locked.payment !== "pending" ||
      locked.fulfillment !== "new" ||
      locked.expiresAt.getTime() < Date.now() + 30 * 60_000
    )
      throw new OrderError("Nie można wznowić tej płatności. Wróć do koszyka.");
    if (locked.stripeSession)
      return stripe.checkout.sessions.retrieve(locked.stripeSession);
    const metadata = {
      orderId: order.id,
      siteOrigin: new URL(siteUrl()).origin,
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        locale: "pl",
        customer_email: order.email,
        client_reference_id: order.id,
        metadata,
        payment_intent_data: { metadata },
        line_items: [
          {
            price_data: {
              currency: "pln",
              unit_amount: order.total,
              product_data: { name: `NEXORA • ${orderNumber(order)}` },
            },
            quantity: 1,
          },
        ],
        success_url: confirmationURL(order),
        cancel_url: confirmationURL(order, "niepowodzenie"),
        expires_at: Math.floor(order.expiresAt.getTime() / 1000),
      },
      { idempotencyKey: `nexora-checkout-${order.id}` },
    );
    await tx
      .update(orders)
      .set({ stripeSession: session.id })
      .where(eq(orders.id, order.id));
    return session;
  });
}

async function releaseOrClaim(
  tx: Transaction,
  order: Order,
  claim: boolean,
  actorId?: string,
) {
  const lines = await tx
    .select()
    .from(reservations)
    .where(
      and(eq(reservations.orderId, order.id), eq(reservations.state, "held")),
    )
    .orderBy(asc(reservations.variantId));
  for (const line of lines) {
    await tx
      .update(inventory)
      .set({
        stock: sql`${inventory.stock} - ${claim ? line.quantity : 0}`,
        reserved: sql`${inventory.reserved} - ${line.quantity}`,
      })
      .where(eq(inventory.variantId, line.variantId));
    await tx
      .update(reservations)
      .set({ state: claim ? "claimed" : "released" })
      .where(
        and(
          eq(reservations.orderId, order.id),
          eq(reservations.variantId, line.variantId),
        ),
      );
    await tx.insert(movements).values({
      orderId: order.id,
      variantId: line.variantId,
      actorId,
      delta: claim ? -line.quantity : 0,
      reservedDelta: -line.quantity,
      reason: claim ? "Sprzedaż" : "Zwolnienie rezerwacji",
    });
    if (claim && order.userId) {
      await tx
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, order.userId),
            eq(cartItems.variantId, line.variantId),
            sql`${cartItems.quantity} <= ${line.quantity}`,
          ),
        );
      await tx
        .update(cartItems)
        .set({ quantity: sql`${cartItems.quantity} - ${line.quantity}` })
        .where(
          and(
            eq(cartItems.userId, order.userId),
            eq(cartItems.variantId, line.variantId),
          ),
        );
    }
  }
  await tx
    .update(redemptions)
    .set({ status: claim ? "used" : "released" })
    .where(eq(redemptions.orderId, order.id));
}

async function setPaid(
  tx: Transaction,
  order: Order,
  stripeSession?: string,
  stripeIntent?: string,
  actorId?: string,
) {
  if (order.payment !== "pending" || order.fulfillment !== "new") return;
  await releaseOrClaim(tx, order, true, actorId);
  await tx
    .update(orders)
    .set({ payment: "paid", paidAt: new Date(), stripeSession, stripeIntent })
    .where(eq(orders.id, order.id));
  await tx
    .insert(orderHistory)
    .values({ orderId: order.id, actorId, label: "Płatność potwierdzona" });
  await queueMail(
    tx,
    `paid:${order.id}`,
    order.email,
    `NEXORA • Płatność ${orderNumber(order)}`,
    `Potwierdzamy płatność demonstracyjną za zamówienie ${orderNumber(order)}.\n\n${confirmationURL(order)}`,
  );
}

async function setCancelled(tx: Transaction, order: Order, actorId?: string) {
  if (order.payment !== "pending" || order.fulfillment !== "new") return;
  await releaseOrClaim(tx, order, false, actorId);
  await tx
    .update(orders)
    .set({ payment: "failed", fulfillment: "cancelled" })
    .where(eq(orders.id, order.id));
  await tx
    .insert(orderHistory)
    .values({ orderId: order.id, actorId, label: "Zamówienie anulowane" });
  await queueMail(
    tx,
    `cancelled:${order.id}`,
    order.email,
    `NEXORA • Anulowano ${orderNumber(order)}`,
    `Zamówienie ${orderNumber(order)} zostało anulowane, a rezerwacja produktów zwolniona.`,
  );
}

function sessionMatches(order: Order, session: Stripe.Checkout.Session) {
  return (
    order.paymentMethod === "stripe" &&
    !session.livemode &&
    session.metadata?.orderId === order.id &&
    session.client_reference_id === order.id &&
    (!order.stripeSession || order.stripeSession === session.id) &&
    session.amount_total === order.total &&
    session.currency === "pln" &&
    session.mode === "payment"
  );
}
export async function processStripeEvent(event: Stripe.Event) {
  if (event.livemode)
    throw new Error("Obsługiwane są wyłącznie zdarzenia testowe.");
  const object = event.data.object as { metadata?: Stripe.Metadata | null };
  // Stripe CLI and a hosted endpoint can receive the same test event.
  // The checkout's own environment must be the first to record it.
  if (
    object.metadata?.siteOrigin &&
    object.metadata.siteOrigin !== new URL(siteUrl()).origin
  )
    return;
  await db().transaction(async (tx) => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return;
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (
        !session.metadata?.orderId ||
        !/^[\da-f-]{36}$/i.test(session.metadata.orderId)
      )
        return;
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, session.metadata.orderId))
        .for("update");
      if (!order || !sessionMatches(order, session)) return;
      const intent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (session.payment_status === "paid" && intent)
        await setPaid(tx, order, session.id, intent);
      else if (event.type === "checkout.session.expired")
        await setCancelled(tx, order);
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const intent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intent || charge.currency !== "pln") return;
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.stripeIntent, intent))
        .for("update");
      if (
        !order ||
        charge.amount !== order.total ||
        charge.amount_refunded <= order.refundedTotal
      )
        return;
      await markRefund(tx, order, charge.amount_refunded);
    }
  });
  await deliverOutbox();
}

async function markRefund(
  tx: Transaction,
  order: Order,
  amount: number,
  actorId?: string,
) {
  const full = amount === order.total;
  const restock = full && ["new", "processing"].includes(order.fulfillment);
  if (restock) {
    const lines = await tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.orderId, order.id),
          eq(reservations.state, "claimed"),
        ),
      )
      .orderBy(asc(reservations.variantId));
    for (const line of lines) {
      await tx
        .update(inventory)
        .set({ stock: sql`${inventory.stock} + ${line.quantity}` })
        .where(eq(inventory.variantId, line.variantId));
      await tx.insert(movements).values({
        orderId: order.id,
        variantId: line.variantId,
        actorId,
        delta: line.quantity,
        reason: "Zwrot przed wysyłką",
      });
    }
  }
  await tx
    .update(orders)
    .set({
      refundedTotal: amount,
      payment: full ? "refunded" : "partially_refunded",
      fulfillment: restock ? "cancelled" : order.fulfillment,
    })
    .where(eq(orders.id, order.id));
  await tx.insert(orderHistory).values({
    orderId: order.id,
    actorId,
    label: full ? "Zwrócono płatność" : "Częściowy zwrot płatności",
  });
}

export async function expirePendingOrders() {
  const candidates = await db()
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.payment, "pending"), lte(orders.expiresAt, new Date())),
    )
    .limit(30);
  for (const { id } of candidates) {
    try {
      await cancelOrder(id, undefined, undefined, true);
    } catch {
      console.warn("NEXORA: nie potwierdzono jeszcze wygaśnięcia zamówienia.");
    }
  }
  return candidates.length;
}

export async function cancelOrder(
  id: string,
  actorId?: string,
  ownerId?: string,
  expiry = false,
  token?: string,
) {
  return db().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (
      !order ||
      (ownerId && order.userId !== ownerId) ||
      (token && !validLookup(order, token))
    )
      throw new OrderError("Nie znaleziono zamówienia.");
    if (
      order.payment !== "pending" ||
      order.fulfillment !== "new" ||
      (expiry && order.expiresAt > new Date())
    )
      return false;
    if (order.paymentMethod === "stripe" && order.stripeSession) {
      const stripe = getStripe();
      if (!stripe) throw new OrderError("Stripe jest niedostępny.");
      let session = await stripe.checkout.sessions.retrieve(
        order.stripeSession,
      );
      if (session.status === "open")
        session = await stripe.checkout.sessions.expire(session.id);
      if (!sessionMatches(order, session))
        throw new OrderError("Dane sesji nie odpowiadają zamówieniu.");
      if (session.status !== "expired")
        throw new OrderError("Płatność wymaga potwierdzenia.");
    }
    if (
      order.paymentMethod === "stripe" &&
      !order.stripeSession &&
      Date.now() < order.expiresAt.getTime()
    ) {
      throw new OrderError(
        "Poczekaj na wygaśnięcie rezerwacji. Wynik utworzenia sesji jest nierozstrzygnięty.",
      );
    }
    await setCancelled(tx, order, actorId);
    return true;
  });
}

export async function fulfill(
  id: string,
  action: Fulfillment | "paid" | "refund",
  actorId: string,
  tracking?: string,
) {
  if (action === "cancelled") {
    if (!(await cancelOrder(id, actorId)))
      throw new OrderError("Zamówienie nie jest już dostępne do anulowania.");
    await deliverOutbox();
    return;
  }
  await db().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (!order) throw new OrderError("Brak zamówienia.");
    if (action === "paid") {
      if (
        order.paymentMethod !== "transfer" ||
        order.payment !== "pending" ||
        order.expiresAt <= new Date()
      )
        throw new OrderError(
          "Tylko aktywny przelew demonstracyjny można potwierdzić ręcznie.",
        );
      return setPaid(tx, order, undefined, undefined, actorId);
    }
    if (action === "refund") {
      if (!["paid", "partially_refunded"].includes(order.payment))
        throw new OrderError("Zwrot wymaga opłaconego zamówienia.");
      if (order.paymentMethod === "stripe") {
        const stripe = getStripe();
        if (!stripe || !order.stripeIntent)
          throw new OrderError("Nie można połączyć się ze Stripe.");
        const refund = await stripe.refunds.create(
          { payment_intent: order.stripeIntent },
          { idempotencyKey: `nexora-refund-${id}` },
        );
        if (refund.status !== "succeeded")
          throw new OrderError(
            "Stripe przetwarza zwrot. Status zostanie zaktualizowany przez webhook.",
          );
      }
      return markRefund(tx, order, order.total, actorId);
    }
    if (
      !canAdvance(order.fulfillment, action, order.payment) ||
      (action === "shipped" && !tracking)
    )
      throw new OrderError(
        "Niedozwolona zmiana statusu lub brak numeru przesyłki.",
      );
    await tx
      .update(orders)
      .set({ fulfillment: action })
      .where(eq(orders.id, id));
    await tx
      .insert(orderHistory)
      .values({ orderId: id, actorId, label: fulfillmentLabels[action] });
    if (action === "shipped" && tracking) {
      await tx.insert(shipments).values({ orderId: id, tracking });
      await queueMail(
        tx,
        `shipped:${id}`,
        order.email,
        `NEXORA • Wysłano ${orderNumber(order)}`,
        `Numer Twojej przesyłki demonstracyjnej: ${tracking}.`,
      );
    }
  });
  await deliverOutbox();
}

export async function orderDetails(
  id: string,
  access: { userId?: string; token?: string; admin?: boolean },
) {
  const [order] = await db().select().from(orders).where(eq(orders.id, id));
  if (
    !order ||
    !(
      access.admin ||
      (access.userId && order.userId === access.userId) ||
      validLookup(order, access.token)
    )
  )
    return undefined;
  const [items, history, delivery] = await Promise.all([
    db().select().from(orderItems).where(eq(orderItems.orderId, id)),
    db()
      .select()
      .from(orderHistory)
      .where(eq(orderHistory.orderId, id))
      .orderBy(asc(orderHistory.createdAt)),
    db().select().from(shipments).where(eq(shipments.orderId, id)),
  ]);
  return { order, items, history, shipment: delivery[0] };
}
