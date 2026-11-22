import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";

const url = process.env.TEST_DATABASE_URL;
const ns = "nexora_test_" + randomUUID().replaceAll("-", "");
let root: Pool | undefined;
let created = false;
let database: typeof import("@/src/db");
let service: typeof import("@/src/features/orders/service");
let commerce: typeof import("@/src/features/cart/server");

async function fixture(stock: number) {
  const repo = database.db(),
    id = randomUUID(),
    variant = id + "-v";
  await repo.insert(schema.products).values({
    id,
    slug: id,
    name: "Produkt testowy",
    brand: "NEXORA TEST",
    categoryId: "test",
    status: "active",
    summary: "Przykładowy produkt testu.",
    description: "Opis testu.",
  });
  await repo.insert(schema.variants).values({
    id: variant,
    productId: id,
    name: "Czarny",
    sku: variant,
    color: "Czarny",
    connection: "Bezprzewodowa",
    price: 25000,
  });
  await repo.insert(schema.inventory).values({ variantId: variant, stock });
  return { id, variant };
}
function input(id: string, quantity = 1) {
  return {
    name: "Klient Testowy",
    email: "test@example.com",
    phone: "123456789",
    street: "Testowa 1",
    zip: "00-001",
    city: "Warszawa",
    country: "Polska" as const,
    shipping: "pickup" as const,
    payment: "transfer" as const,
    terms: true as const,
    requestId: randomUUID(),
    items: [{ id, quantity }],
  };
}
const idFrom = (url: string) => new URL(url).searchParams.get("id")!;

describe.skipIf(!url)("sprzedaż i magazyn w PostgreSQL", () => {
  beforeAll(async () => {
    if (!url) throw new Error("Brak TEST_DATABASE_URL");
    const direct = new URL(url);
    if (direct.hostname.includes("-pooler"))
      throw new Error("Test wymaga połączenia bezpośredniego.");
    direct.searchParams.delete("options");
    root = new Pool({
      connectionString: direct.href,
      connectionTimeoutMillis: 10000,
    });
    await root.query(`create schema "${ns}"`);
    created = true;
    const migration = await root.connect();
    try {
      await migration.query(`set search_path to "${ns}"`);
      for (const file of (await readdir("drizzle"))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        const source = (await readFile(`drizzle/${file}`, "utf8")).replaceAll(
          '"public".',
          `"${ns}".`,
        );
        for (const query of source.split("--> statement-breakpoint"))
          if (query.trim()) await migration.query(query);
      }
    } finally {
      migration.release();
    }
    direct.searchParams.set("options", `-c search_path=${ns}`);
    process.env.DATABASE_URL = direct.href;
    delete process.env.DATABASE_URL_POOLED;
    delete process.env.SMTP_HOST;
    delete process.env.VERCEL;
    process.env.AUTH_SECRET = randomUUID() + randomUUID();
    database = await import("@/src/db");
    service = await import("@/src/features/orders/service");
    commerce = await import("@/src/features/cart/server");
    await database.db().insert(schema.brands).values({ name: "NEXORA TEST" });
    await database.db().insert(schema.categories).values({
      id: "test",
      name: "Test",
      slug: "test",
      description: "Testowa",
      image: "/media/audio.webp",
    });
  });
  afterAll(async () => {
    await database?.closeDb();
    try {
      if (created && /^nexora_test_[a-f0-9]{32}$/.test(ns))
        await root?.query(`drop schema "${ns}" cascade`);
    } finally {
      await root?.end();
    }
  });
  it("serwuje zapisane zdjęcie z poprawnym typem i walidatorem pamięci podręcznej", async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#4f46e5" },
    })
      .webp()
      .toBuffer();
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha256").update(bytes).digest("hex");
    await database.db().insert(schema.uploadedImages).values({ digest, bytes });
    const { GET } = await import("@/app/media/uploads/[asset]/route");
    const asset = `${digest}.webp`;
    const url = `http://localhost:3000/media/uploads/${asset}`;
    const params = Promise.resolve({ asset });

    const response = await GET(new Request(url), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);

    const cached = await GET(
      new Request(url, { headers: { "If-None-Match": `"${digest}"` } }),
      { params },
    );
    expect(cached.status).toBe(304);
    const missing = await GET(new Request(url), {
      params: Promise.resolve({ asset: `${"0".repeat(64)}.webp` }),
    });
    expect(missing.status).toBe(404);
  });
  it("odmawia przy ilości przekraczającej stan i rezerwuje ostatnią sztukę tylko raz", async () => {
    const { variant } = await fixture(1);
    await expect(service.createOrder(input(variant, 2))).rejects.toThrow(
      "dostępna liczba sztuk",
    );
    const outcomes = await Promise.allSettled([
      service.createOrder(input(variant)),
      service.createOrder(input(variant)),
    ]);
    expect(outcomes.filter((row) => row.status === "fulfilled")).toHaveLength(
      1,
    );
    const [item] = await database
      .db()
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.variantId, variant));
    expect(item).toMatchObject({ stock: 1, reserved: 1 });
  });
  it("scala koszyk raz i ogranicza liczbę sztuk do magazynu", async () => {
    const { variant, id } = await fixture(4),
      repo = database.db();
    const [user] = await repo
      .insert(schema.users)
      .values({
        name: "Test",
        email: "merge@example.com",
        passwordHash: "fixture",
      })
      .returning();
    await commerce.updateCommerce(user.id, {
      op: "cart",
      id: variant,
      quantity: 1,
      mode: "add",
    });
    const payload = {
      op: "merge" as const,
      requestId: randomUUID(),
      items: [{ id: variant, quantity: 7 }],
      favorites: [id],
    };
    const [state, retry] = await Promise.all([
      commerce.updateCommerce(user.id, payload),
      commerce.updateCommerce(user.id, payload),
    ]);
    expect(state).toMatchObject({
      items: [{ id: variant, quantity: 4 }],
      favorites: [id],
    });
    expect(retry).toEqual(state);
  });
  it("atomowo ogranicza użycia kuponu i zwalnia je po anulowaniu", async () => {
    const { variant } = await fixture(6),
      repo = database.db();
    await repo
      .insert(schema.coupons)
      .values({ code: "LIMIT", kind: "percent", value: 10, usageLimit: 1 });
    const a = { ...input(variant), coupon: "LIMIT" },
      b = { ...input(variant), email: "other@example.com", coupon: "LIMIT" };
    const used = await Promise.allSettled([
      service.createOrder(a),
      service.createOrder(b),
    ]);
    const winner = used.find((row) => row.status === "fulfilled");
    expect(used.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    if (winner?.status !== "fulfilled") throw new Error("Brak zamówienia");
    expect(await service.cancelOrder(idFrom(winner.value.url))).toBe(true);
    expect(
      await service.createOrder({ ...b, requestId: randomUUID() }),
    ).toHaveProperty("url");
  });
  it("weryfikuje dostęp do zamówienia i pozwala przejść przez prawidłowe statusy", async () => {
    const { variant } = await fixture(2),
      repo = database.db();
    const [owner, other] = await repo
      .insert(schema.users)
      .values([
        {
          name: "Właściciel",
          email: "owner@example.com",
          passwordHash: "fixture",
        },
        {
          name: "Admin",
          email: "staff@example.com",
          passwordHash: "fixture",
          role: "admin",
        },
      ])
      .returning();
    const order = await service.createOrder(
      { ...input(variant), email: owner.email },
      owner.id,
    );
    const id = idFrom(order.url),
      key = new URL(order.url).searchParams.get("klucz")!;
    expect(
      await service.orderDetails(id, { userId: other.id }),
    ).toBeUndefined();
    expect(
      await service.orderDetails(id, { token: key + "x" }),
    ).toBeUndefined();
    expect(await service.orderDetails(id, { userId: owner.id })).toBeTruthy();
    await expect(
      service.fulfill(id, "shipped", other.id, "TEST"),
    ).rejects.toThrow("Niedozwolona");
    await service.fulfill(id, "paid", other.id);
    await service.fulfill(id, "processing", other.id);
    await service.fulfill(id, "shipped", other.id, "TEST123");
    await service.fulfill(id, "delivered", other.id);
    const view = await service.orderDetails(id, { token: key });
    expect(view?.order.fulfillment).toBe("delivered");
    expect(view?.shipment.tracking).toBe("TEST123");
  });
  it("odrzuca błędną kwotę i inne środowisko oraz księguje webhook Stripe raz", async () => {
    const { variant } = await fixture(2),
      repo = database.db();
    const placed = await service.createOrder(input(variant)),
      id = idFrom(placed.url);
    await repo
      .update(schema.orders)
      .set({ paymentMethod: "stripe", stripeSession: "cs_test_fixture" })
      .where(eq(schema.orders.id, id));
    const event = (eventId: string, amount: number, siteOrigin?: string) =>
      ({
        id: eventId,
        livemode: false,
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_fixture",
            livemode: false,
            client_reference_id: id,
            metadata: { orderId: id, siteOrigin },
            amount_total: amount,
            currency: "pln",
            mode: "payment",
            payment_status: "paid",
            payment_intent: "pi_test_fixture",
          },
        },
      }) as unknown as Stripe.Event;
    await service.processStripeEvent(event("evt_wrong_total", 100));
    await service.processStripeEvent(
      event("evt_valid_total", 25000, "https://other-nexora.example"),
    );
    expect(
      (
        await repo.select().from(schema.orders).where(eq(schema.orders.id, id))
      )[0].payment,
    ).toBe("pending");
    const success = event("evt_valid_total", 25000);
    await Promise.all([
      service.processStripeEvent(success),
      service.processStripeEvent(success),
      service.processStripeEvent({ ...success, id: "evt_second_delivery" }),
    ]);
    expect(
      (
        await repo
          .select()
          .from(schema.inventory)
          .where(eq(schema.inventory.variantId, variant))
      )[0],
    ).toMatchObject({ stock: 1, reserved: 0 });
    const payment = await repo
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.key, `paid:${id}`));
    expect(payment).toHaveLength(1);
  });
  it("zwalnia wygasłą rezerwację", async () => {
    const { variant } = await fixture(1),
      repo = database.db();
    const order = await service.createOrder(input(variant)),
      id = idFrom(order.url);
    await repo
      .update(schema.orders)
      .set({ expiresAt: sql`now() - interval '1 minute'` })
      .where(eq(schema.orders.id, id));
    expect(await service.expirePendingOrders()).toBeGreaterThanOrEqual(1);
    expect(
      (
        await repo
          .select()
          .from(schema.inventory)
          .where(eq(schema.inventory.variantId, variant))
      )[0],
    ).toMatchObject({ stock: 1, reserved: 0 });
  });
});
