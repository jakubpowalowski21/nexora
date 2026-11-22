"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/src/db";
import {
  addresses,
  orderItems,
  orders,
  returnItems,
  returns,
  reviews,
  users,
} from "@/src/db/schema";
import { requireCustomer, viewer } from "@/src/lib/auth";
import { address, email, reviewInput } from "@/src/lib/validation";
import {
  cancelOrder,
  orderNumber,
  validLookup,
} from "@/src/features/orders/service";
import { OrderError } from "@/src/features/orders/quote";
import { deliverOutbox } from "@/src/features/mail/outbox";
import type { FormState } from "./auth-actions";
import { rateLimit } from "./security";

const uuid = z.uuid();
const invalid = (error: z.ZodError) => ({ error: error.issues[0].message });
export async function saveAddress(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const parsed = address
    .extend({ label: z.string().trim().min(2).max(45), id: uuid.optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { label, id, ...data } = parsed.data;
  const isDefault = form.get("isDefault") === "on";
  const saved = await db().transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, user.id))
      .for("update");
    const current = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, user.id));
    if (id && !current.some((address) => address.id === id)) return false;
    if (!id && current.length >= 12) return false;
    if (isDefault)
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, user.id));
    if (id)
      await tx
        .update(addresses)
        .set({ label, data, isDefault })
        .where(and(eq(addresses.userId, user.id), eq(addresses.id, id)));
    else
      await tx
        .insert(addresses)
        .values({
          userId: user.id,
          label,
          data,
          isDefault: isDefault || !current.length,
        });
    return true;
  });
  if (!saved)
    return { error: "Nie można zapisać tego adresu. Limit adresów: 12." };
  revalidatePath("/konto/adresy");
  return { message: "Adres zapisany." };
}
export async function deleteAddress(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireCustomer(),
    id = uuid.safeParse(form.get("id"));
  if (!id.success) return { error: "Brak adresu." };
  await db()
    .delete(addresses)
    .where(and(eq(addresses.userId, user.id), eq(addresses.id, id.data)));
  revalidatePath("/konto/adresy");
  return { message: "Adres usunięty." };
}
export async function saveProfile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const profile = z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: z
        .string()
        .trim()
        .regex(/^(?:[+0-9 ()-]{7,25})?$/, "Podaj poprawny numer telefonu."),
    })
    .safeParse(Object.fromEntries(form));
  if (!profile.success) return invalid(profile.error);
  await db()
    .update(users)
    .set({ name: profile.data.name, phone: profile.data.phone || null })
    .where(eq(users.id, user.id));
  revalidatePath("/konto");
  return { message: "Dane zapisane." };
}
export async function cancelGuestOrder(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { error: "Brak zamówienia." };
  const user = await viewer();
  const token = String(form.get("token") || "").slice(0, 80);
  const [order] = await db()
    .select()
    .from(orders)
    .where(eq(orders.id, id.data));
  if (
    !order ||
    (!(order.userId && order.userId === user?.id) && !validLookup(order, token))
  )
    return { error: "Nie znaleziono zamówienia." };
  if (order.payment !== "pending" || order.fulfillment !== "new")
    return {
      error: "Zamówienie nie jest już dostępne do samodzielnego anulowania.",
    };
  try {
    const change = await cancelOrder(
      id.data,
      user?.id,
      order.userId === user?.id ? user?.id : undefined,
      false,
      order.userId === user?.id ? undefined : token,
    );
    if (!change)
      return { error: "Status zamówienia uległ zmianie. Odśwież stronę." };
    await deliverOutbox();
  } catch (error) {
    return {
      error:
        error instanceof OrderError
          ? error.message
          : "Nie udało się anulować zamówienia.",
    };
  }
  revalidatePath("/konto/zamowienia");
  revalidatePath("/zamowienie/sukces");
  revalidatePath("/zamowienie/niepowodzenie");
  return { message: "Zamówienie zostało anulowane." };
}
export async function canReview(userId: string, productId: string) {
  const [row] = await db()
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        inArray(orders.payment, ["paid", "partially_refunded"]),
        sql`${orders.fulfillment} <> 'cancelled'`,
        sql`not exists (select 1 from ${reviews} where ${reviews.productId} = ${productId} and ${reviews.userId} = ${userId})`,
      ),
    )
    .limit(1);
  return !!row;
}
export async function reviewProduct(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const data = reviewInput.safeParse(Object.fromEntries(form));
  if (!data.success) return invalid(data.error);
  if (!(await canReview(user.id, data.data.productId)))
    return { error: "Opinię może napisać klient z potwierdzonym zakupem." };
  const [review] = await db()
    .insert(reviews)
    .values({ ...data.data, userId: user.id, author: user.name.split(" ")[0] })
    .onConflictDoNothing()
    .returning();
  return review
    ? { message: "Opinia została przekazana do moderacji." }
    : { error: "Opinia została już dodana." };
}
export async function createReturn(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await viewer();
  const parsed = z
    .object({
      number: z.string().regex(/^NX-\d{4}-\d{6,}$/i),
      email,
      type: z.enum(["return", "complaint"]),
      body: z.string().trim().min(10).max(3000),
    })
    .safeParse({
      ...Object.fromEntries(form),
      email: user?.email || form.get("email"),
    });
  if (!parsed.success) return invalid(parsed.error);
  const { number, email: buyer, type, body } = parsed.data;
  try {
    if (!(await rateLimit(`return:${user?.id || buyer}`, 10, 60)))
      return { error: "Spróbuj ponownie później." };
    const sequence = Number(number.split("-").at(-1));
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 2147483647)
      return { error: "Sprawdź numer zamówienia." };
    const [order] = await db()
      .select()
      .from(orders)
      .where(and(eq(orders.sequence, sequence), eq(orders.email, buyer)));
    if (
      !order ||
      orderNumber(order) !== number.toUpperCase() ||
      (user && order.userId !== user.id) ||
      !["paid", "partially_refunded"].includes(order.payment)
    )
      return { error: "Sprawdź numer opłaconego zamówienia i adres e-mail." };
    const selected = z.array(uuid).max(80).safeParse(form.getAll("items"));
    if (!selected.success) return { error: "Sprawdź wybrane produkty." };
    if (user && !selected.data.length)
      return { error: "Wybierz produkty z zamówienia." };
    const items = await db()
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    if (selected.data.some((id) => !items.some((item) => item.id === id)))
      return { error: "Produkty nie należą do wybranego zamówienia." };
    await db().transaction(async (tx) => {
      const [request] = await tx
        .insert(returns)
        .values({ orderId: order.id, email: buyer, type, body })
        .returning();
      if (selected.data.length)
        await tx
          .insert(returnItems)
          .values(
            [...new Set(selected.data)].map((itemId) => ({
              returnId: request.id,
              itemId,
            })),
          );
    });
    revalidatePath("/konto/zwroty");
    return { message: "Zgłoszenie zostało zapisane." };
  } catch {
    return { error: "Nie udało się zapisać zgłoszenia." };
  }
}
