import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, hasDb, type Transaction } from "@/src/db";
import {
  categories,
  coupons,
  images,
  inventory,
  products,
  redemptions,
  settings,
  variants,
} from "@/src/db/schema";
import { available, currentPrice } from "@/src/features/catalog/data";
import { defaultSettings, demoProducts } from "@/src/features/catalog/demo";
import { shippingCost } from "@/src/lib/format";
import type { CartLine } from "@/src/lib/validation";
import { couponDiscount } from "./pricing";

export class OrderError extends Error {}

export function normalizeLines(lines: CartLine[]) {
  const quantities = new Map<string, number>();
  for (const { id, quantity } of lines)
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  return [...quantities]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, quantity]) => ({ id, quantity }));
}

export async function purchasable(
  lines: CartLine[],
  repo: Pick<ReturnType<typeof db>, "select"> = db(),
) {
  if (!lines.length) return [];
  const photo = sql<
    string | null
  >`coalesce(${variants.image}, (select ${images.url} from ${images} where ${images.productId} = ${products.id} order by ${images.position} limit 1), ${categories.image})`;
  return repo
    .select({
      variant: variants,
      product: products,
      stock: available,
      image: photo,
    })
    .from(variants)
    .innerJoin(products, eq(variants.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(inventory, eq(inventory.variantId, variants.id))
    .where(
      and(
        inArray(
          variants.id,
          lines.map((line) => line.id),
        ),
        eq(variants.active, true),
        eq(products.status, "active"),
        eq(categories.active, true),
      ),
    );
}

type Input = {
  items: CartLine[];
  shipping: "pickup" | "courier" | "express";
  coupon?: string;
};
type QuoteItem = CartLine & {
  productId: string;
  categoryId: string;
  slug: string;
  name: string;
  variant: string;
  sku: string;
  tax: number;
  price: number;
  regular: number;
  stock: number;
  image: string;
};
export async function quote(
  input: Input,
  buyer?: string,
  tx?: Transaction,
  preview = false,
) {
  const lines = normalizeLines(input.items);
  const repo = tx || (hasDb && !preview ? db() : undefined);
  const [rows, overrides] = repo
    ? await Promise.all([
        purchasable(lines, repo),
        repo.select().from(settings).where(eq(settings.id, 1)),
      ])
    : [
        demoProducts.flatMap((product) =>
          product.variants
            .filter((variant) => lines.some((line) => line.id === variant.id))
            .map((variant) => ({
              variant,
              product,
              stock: variant.stock,
              image: variant.image,
            })),
        ),
        [],
      ];
  const store = overrides[0] || defaultSettings;
  const items: QuoteItem[] = [];
  const issues: string[] = [];
  const missing: string[] = [];
  for (const line of lines) {
    const row = rows.find((row) => row.variant.id === line.id);
    if (!row) {
      missing.push(line.id);
      issues.push("Jeden z produktów został wycofany z oferty.");
      continue;
    }
    const { variant, product, stock, image } = row;
    if (line.quantity > Math.min(99, stock))
      issues.push(
        `${product.name} (${variant.name}) — dostępna liczba sztuk: ${Math.min(stock, 99)}.`,
      );
    items.push({
      ...line,
      productId: product.id,
      categoryId: product.categoryId,
      slug: product.slug,
      name: product.name,
      variant: variant.name,
      sku: variant.sku,
      tax: product.tax,
      price: currentPrice(variant),
      regular: variant.price,
      stock,
      image: image || "/media/audio.webp",
    });
  }
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  let discount = 0;
  let couponError = "";
  if (input.coupon) {
    const lookup = repo
      ?.select()
      .from(coupons)
      .where(eq(coupons.code, input.coupon));
    const coupon = lookup
      ? (await (tx ? lookup.for("update") : lookup))[0]
      : input.coupon === "NEXORA10"
        ? {
            code: "NEXORA10",
            value: 10,
            kind: "percent" as const,
            minimum: 20000,
            maximum: null,
            active: true,
            expiresAt: null,
            stack: true,
            productIds: [] as string[],
            categoryIds: [] as string[],
            usageLimit: null,
            customerLimit: null,
          }
        : undefined;
    if (
      !coupon ||
      !coupon.active ||
      (coupon.expiresAt && coupon.expiresAt <= new Date())
    )
      couponError = "Kod rabatowy jest nieaktywny lub nie istnieje.";
    else if (subtotal < coupon.minimum)
      couponError = "Koszyk nie osiąga minimalnej wartości dla tego kodu.";
    else {
      const eligible = items
        .filter(
          (item) =>
            (coupon.stack || item.price === item.regular) &&
            ((!coupon.productIds.length && !coupon.categoryIds.length) ||
              coupon.productIds.includes(item.productId) ||
              coupon.categoryIds.includes(item.categoryId)),
        )
        .reduce((sum, item) => sum + item.quantity * item.price, 0);
      if (
        repo &&
        (coupon.usageLimit !== null || (buyer && coupon.customerLimit !== null))
      ) {
        const [uses] = await repo
          .select({
            total: sql<number>`count(*)`.mapWith(Number),
            personal:
              sql<number>`count(*) filter (where ${redemptions.email} = ${buyer || ""})`.mapWith(
                Number,
              ),
          })
          .from(redemptions)
          .where(
            and(
              eq(redemptions.code, coupon.code),
              ne(redemptions.status, "released"),
            ),
          );
        if (
          (coupon.usageLimit !== null && uses.total >= coupon.usageLimit) ||
          (buyer &&
            coupon.customerLimit !== null &&
            uses.personal >= coupon.customerLimit)
        )
          couponError = "Wykorzystano limit użyć kodu.";
      }
      if (!eligible) couponError = "Kod nie obejmuje produktów w koszyku.";
      if (!couponError) discount = couponDiscount(coupon, eligible);
    }
  }
  const method = store.shippingOptions.some((row) => row.id === input.shipping)
    ? input.shipping
    : undefined;
  if (!method && tx)
    throw new OrderError("Wybrana metoda dostawy jest niedostępna.");
  const initial =
    method || (store.shippingOptions[0]?.id as Input["shipping"] | undefined);
  const delivery =
    items.length && initial
      ? shippingCost(
          initial,
          subtotal - discount,
          store.freeShipping,
          store.shippingOptions,
        )
      : 0;
  if (
    subtotal > 2_147_483_647 ||
    subtotal - discount + delivery > 2_147_483_647
  )
    issues.push("Wartość koszyka przekracza limit zamówienia.");
  return {
    items,
    issues,
    missing,
    subtotal,
    discount,
    delivery,
    total: subtotal - discount + delivery,
    remaining: Math.max(0, store.freeShipping - (subtotal - discount)),
    couponError,
    threshold: store.freeShipping,
    preview: !repo,
  };
}

export type Quote = Awaited<ReturnType<typeof quote>>;
