"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/src/db";
import {
  audit,
  categories,
  coupons,
  messages,
  products,
  returns,
  reviews,
  settings,
  variants,
} from "@/src/db/schema";
import { requireAdmin } from "@/src/lib/auth";
import type { FormState } from "@/src/features/account/auth-actions";
import { fulfill, orderNumber } from "@/src/features/orders/service";
import { OrderError } from "@/src/features/orders/quote";
import { deliverOutbox, queueMail } from "@/src/features/mail/outbox";
import { email } from "@/src/lib/validation";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (x) => (x === "" || x === undefined ? null : x),
    z.coerce.number().int().min(min).max(max).nullable(),
  );
const statuses = z.enum(["new", "processing", "resolved"]);
const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
};
export async function updateOrder(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({
      id: z.uuid(),
      action: z.enum([
        "paid",
        "refund",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ]),
      tracking: z.string().trim().max(100).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Nieprawidłowe dane zamówienia." };
  try {
    await fulfill(data.data.id, data.data.action, admin.id, data.data.tracking);
    refresh();
    return { message: "Zaktualizowano zamówienie." };
  } catch (error) {
    return {
      error:
        error instanceof OrderError
          ? error.message
          : "Nie udało się zaktualizować zamówienia.",
    };
  }
}
export async function saveCoupon(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{3,40}$/),
      kind: z.enum(["percent", "fixed"]),
      value: z.coerce.number().int().min(1).max(10_000_000),
      minimum: z.coerce.number().int().min(0).max(10_000_000),
      maximum: optionalInt(1, 10_000_000),
      usageLimit: optionalInt(1, 100000),
      customerLimit: optionalInt(1, 100000),
      expiresAt: z.union([z.iso.date(), z.literal("")]),
      productIds: z.array(text(1, 80)).max(50),
      categoryIds: z.array(text(1, 80)).max(50),
    })
    .safeParse({
      ...Object.fromEntries(form),
      productIds: form.getAll("productIds"),
      categoryIds: form.getAll("categoryIds"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.kind === "percent" && parsed.data.value > 100)
    return { error: "Maksymalny rabat procentowy to 100%." };
  const values = {
    ...parsed.data,
    expiresAt: parsed.data.expiresAt
      ? new Date(Date.parse(parsed.data.expiresAt + "T00:00:00Z") + 86400000)
      : null,
    active: form.get("active") === "on",
    stack: form.get("stack") === "on",
  };
  await db().transaction(async (tx) => {
    await tx
      .insert(coupons)
      .values(values)
      .onConflictDoUpdate({ target: coupons.code, set: values });
    await tx
      .insert(audit)
      .values({
        adminId: admin.id,
        action: "coupon.save",
        target: values.code,
      });
  });
  refresh();
  return { message: "Kod rabatowy zapisany." };
}
export async function promoteCategory(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      id: text(1, 80),
      percent: z.coerce.number().int().min(1).max(90),
      start: z.union([z.iso.date(), z.literal("")]),
      end: z.union([z.iso.date(), z.literal("")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Wybierz kategorię, procent i poprawne daty." };
  const { id, percent, start, end } = parsed.data;
  if (start && end && start > end)
    return { error: "Koniec promocji nie może poprzedzać początku." };
  const amount = sql<number>`greatest(1,(${variants.price}::bigint * ${100 - percent} / 100)::integer)`;
  const changed = await db().transaction(async (tx) => {
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, id));
    if (!category) return [];
    const rows = await tx
      .update(variants)
      .set({
        salePrice: amount,
        saleStart: start ? new Date(start + "T00:00:00Z") : null,
        saleEnd: end
          ? new Date(Date.parse(end + "T00:00:00Z") + 86400000)
          : null,
      })
      .where(
        and(
          eq(variants.active, true),
          sql`${variants.price}>1`,
          sql`(${variants.salePrice} is null or ${variants.saleEnd} <= now())`,
          sql`exists(select 1 from ${products} where ${products.id} = ${variants.productId} and ${products.categoryId} = ${id} and ${products.status} = 'active')`,
        ),
      )
      .returning({ id: variants.id });
    if (rows.length)
      await tx
        .insert(audit)
        .values({
          adminId: admin.id,
          action: "category.promotion",
          target: id,
        });
    return rows;
  });
  refresh();
  return changed.length
    ? { message: `Przeceniono warianty: ${changed.length}.` }
    : {
        error:
          "Brak aktywnych wariantów bez zaplanowanej lub trwającej przeceny.",
      };
}

export async function moderateReview(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({
      id: z.uuid(),
      status: z.enum(["published", "rejected", "pending"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Nieprawidłowy status." };
  await db().transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ status: data.data.status })
      .where(eq(reviews.id, data.data.id));
    await tx
      .insert(audit)
      .values({
        adminId: admin.id,
        action: `review.${data.data.status}`,
        target: data.data.id,
      });
  });
  refresh();
  return { message: "Zapisano status opinii." };
}
export async function updateTicket(
  kind: "message" | "return",
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  if (kind !== "message" && kind !== "return")
    return { error: "Nieznany rodzaj zgłoszenia." };
  const data = z
    .object({ id: z.uuid(), status: statuses })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Nieprawidłowy status." };
  const ok = await db().transaction(async (tx) => {
    const table = kind === "message" ? messages : returns;
    const [row] = await tx
      .update(table)
      .set({ status: data.data.status })
      .where(
        and(
          eq(table.id, data.data.id),
          sql`${table.status} <> ${data.data.status}`,
        ),
      )
      .returning();
    if (!row) return false;
    await tx
      .insert(audit)
      .values({
        adminId: admin.id,
        action: `${kind}.${data.data.status}`,
        target: data.data.id,
      });
    if (kind === "return")
      await queueMail(
        tx,
        `return:${row.id}:${data.data.status}:${crypto.randomUUID()}`,
        row.email,
        "NEXORA • Status zgłoszenia",
        `Twoje zgłoszenie ma status: ${{ new: "nowe", processing: "w trakcie obsługi", resolved: "rozwiązane" }[data.data.status]}.`,
      );
    return true;
  });
  if (!ok) return { message: "Status nie zmienił się." };
  await deliverOutbox();
  refresh();
  return { message: "Zapisano status zgłoszenia." };
}
export async function saveSettings(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({
      name: text(2, 70),
      description: text(8, 300),
      email,
      freeShipping: z.coerce.number().int().min(0).max(1000000),
      heroTitle: text(5, 95),
      heroText: text(12, 350),
      seo: z.string().trim().max(200),
      pickup: optionalInt(0, 100000),
      courier: optionalInt(0, 100000),
      express: optionalInt(0, 100000),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: data.error.issues[0].message };
  const { pickup, courier, express, ...fields } = data.data;
  const shippingOptions = Object.entries({ pickup, courier, express }).flatMap(
    ([id, price]) => (price === null ? [] : [{ id, price }]),
  );
  if (!shippingOptions.length)
    return { error: "Włącz przynajmniej jedną metodę dostawy." };
  const values = {
    ...fields,
    newsletterEnabled: form.get("newsletterEnabled") === "on",
    shippingOptions,
  };
  await db().transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: settings.id, set: values });
    await tx
      .insert(audit)
      .values({ adminId: admin.id, action: "settings.save", target: "store" });
  });
  refresh();
  return { message: "Ustawienia sklepu zapisane." };
}

export async function notifyOrder(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin(),
    id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Nie znaleziono zamówienia." };
  const { orders } = await import("@/src/db/schema");
  const [order] = await db()
    .select()
    .from(orders)
    .where(eq(orders.id, id.data));
  if (!order) return { error: "Nie znaleziono zamówienia." };
  const day = new Date().toISOString().slice(0, 10);
  await db().transaction(async (tx) => {
    await queueMail(
      tx,
      `order-update:${order.id}:${order.payment}:${order.fulfillment}:${day}`,
      order.email,
      `NEXORA • Informacja o zamówieniu ${orderNumber(order)}`,
      `Status Twojego zamówienia ${orderNumber(order)} możesz sprawdzić na koncie lub w linku z potwierdzenia.`,
    );
    await tx
      .insert(audit)
      .values({ adminId: admin.id, action: "order.notify", target: order.id });
  });
  await deliverOutbox();
  return { message: "Powiadomienie trafiło do kolejki." };
}
