"use server";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type Transaction } from "@/src/db";
import {
  audit,
  brands,
  categories,
  categoryRedirects,
  images,
  inventory,
  movements,
  products,
  variants,
} from "@/src/db/schema";
import { requireAdmin } from "@/src/lib/auth";
import type { FormState } from "@/src/features/account/auth-actions";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const id = text(1, 80);
const slug = z
  .string()
  .min(2)
  .max(96)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug może zawierać małe litery, cyfry i myślniki.",
  );
const asset = z
  .string()
  .max(120)
  .regex(
    /^\/media\/(?:[a-z0-9.-]+\.(?:webp|png|jpe?g)|uploads\/[a-f0-9]{64}\.webp)$/,
    "Podaj adres zdjęcia z katalogu /media lub prześlij plik.",
  );
const blank = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );
const limitedDate = blank(z.iso.date());
const price = z.coerce.number().int().min(1).max(10_000_000);
const productForm = z.object({
  name: text(2, 140),
  slug,
  brand: text(2, 60),
  categoryId: id,
  summary: text(10, 320),
  description: text(10, 8000),
  box: text(2, 400),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.boolean(),
  tax: z.coerce.number().int().min(0).max(100),
  metaTitle: blank(text(2, 90)),
  metaDescription: blank(text(2, 180)),
  ogImage: blank(asset),
  specifications: z.array(z.tuple([text(1, 75), text(1, 200)])).max(40),
  variants: z
    .array(
      z
        .object({
          id: id.optional(),
          name: text(1, 80),
          sku: text(2, 80),
          color: text(1, 60),
          connection: text(1, 40),
          price,
          salePrice: blank(price),
          saleStart: limitedDate,
          saleEnd: limitedDate,
          image: blank(asset),
          stock: z.coerce.number().int().min(0).max(500000),
          expectedStock: blank(z.number().int().min(0).max(500000)),
        })
        .refine((v) => !v.salePrice || v.salePrice < v.price, {
          message: "Cena promocyjna musi być niższa od regularnej.",
        })
        .refine((v) => !v.saleStart || !v.saleEnd || v.saleStart <= v.saleEnd, {
          message: "Sprawdź daty promocji.",
        }),
    )
    .min(1)
    .max(24),
  images: z
    .array(
      z.object({
        url: asset,
        alt: text(2, 180),
      }),
    )
    .max(20),
});

function array(form: FormData, key: string) {
  try {
    return JSON.parse(String(form.get(key) || "[]")) as unknown;
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}
async function record(
  tx: Transaction,
  adminId: string,
  action: string,
  target: string,
) {
  await tx.insert(audit).values({ adminId, action, target });
}

export async function saveProduct(
  productId: string | null,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const spec = String(form.get("specifications") || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("=");
      return i < 1 ? [line, ""] : [line.slice(0, i), line.slice(i + 1)];
    });
  const data = productForm.safeParse({
    ...Object.fromEntries(form),
    featured: form.get("featured") === "on",
    specifications: spec,
    variants: array(form, "variants"),
    images: array(form, "images"),
  });
  if (!data.success) return { error: data.error.issues[0].message };
  const {
    variants: list,
    images: photos,
    specifications,
    ...attributes
  } = data.data;
  const skus = list.map((v) => v.sku.toUpperCase());
  if (new Set(skus).size !== list.length)
    return { error: "Każdy wariant musi mieć osobny SKU." };
  try {
    await db().transaction(async (tx) => {
      const [category] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, attributes.categoryId));
      if (!category) throw new Error("Wybrana kategoria nie istnieje.");
      const key = productId || randomUUID();
      await tx
        .insert(brands)
        .values({ name: attributes.brand })
        .onConflictDoNothing();
      const values = {
        ...attributes,
        specifications: Object.fromEntries(specifications),
        metaTitle: attributes.metaTitle ?? null,
        metaDescription: attributes.metaDescription ?? null,
        ogImage: attributes.ogImage ?? null,
      };
      if (productId) {
        const [existing] = await tx
          .update(products)
          .set(values)
          .where(eq(products.id, productId))
          .returning();
        if (!existing) throw new Error("Produkt został wycofany.");
      } else await tx.insert(products).values({ ...values, id: key });
      const old = await tx
        .select({ id: variants.id })
        .from(variants)
        .where(eq(variants.productId, key));
      if (
        new Set(list.filter((v) => v.id).map((v) => v.id)).size !==
          list.filter((v) => v.id).length ||
        list.some((v) => v.id && !old.some((row) => row.id === v.id))
      )
        throw new Error("Wariant nie należy do produktu.");
      const removed = old
        .map((v) => v.id)
        .filter((v) => !list.some((item) => item.id === v));
      if (removed.length)
        await tx
          .update(variants)
          .set({ active: false })
          .where(inArray(variants.id, removed));
      for (const [position, v] of list.entries()) {
        const itemId = v.id || randomUUID();
        const variant = {
          name: v.name,
          sku: skus[position],
          color: v.color,
          connection: v.connection,
          price: v.price,
          salePrice: v.salePrice ?? null,
          saleStart: v.saleStart ? new Date(v.saleStart + "T00:00:00Z") : null,
          saleEnd: v.saleEnd
            ? new Date(Date.parse(v.saleEnd + "T00:00:00Z") + 86400000)
            : null,
          image: v.image ?? null,
          position,
          active: true,
        };
        if (v.id) {
          const [oldStock] = await tx
            .select()
            .from(inventory)
            .where(eq(inventory.variantId, itemId))
            .for("update");
          await tx.update(variants).set(variant).where(eq(variants.id, itemId));
          if (!oldStock)
            await tx.insert(inventory).values({ variantId: itemId, stock: 0 });
          if (v.stock === v.expectedStock) continue;
          if (v.expectedStock !== (oldStock?.stock || 0))
            throw new Error(
              `Zmienił się stan wariantu ${v.name}. Odśwież edycję przed korektą.`,
            );
          if (v.stock < (oldStock?.reserved || 0))
            throw new Error(
              `Wariant ${v.name} ma ${oldStock?.reserved || 0} aktywnych rezerwacji.`,
            );
          await tx
            .update(inventory)
            .set({ stock: v.stock })
            .where(eq(inventory.variantId, itemId));
          await tx
            .insert(movements)
            .values({
              variantId: itemId,
              actorId: admin.id,
              delta: v.stock - v.expectedStock,
              reason: "Aktualizacja wariantu",
            });
        } else {
          await tx
            .insert(variants)
            .values({ ...variant, id: itemId, productId: key });
          await tx
            .insert(inventory)
            .values({ variantId: itemId, stock: v.stock });
          if (v.stock)
            await tx
              .insert(movements)
              .values({
                variantId: itemId,
                actorId: admin.id,
                delta: v.stock,
                reason: "Nowy wariant",
              });
        }
      }
      await tx.delete(images).where(eq(images.productId, key));
      if (photos.length)
        await tx
          .insert(images)
          .values(
            photos.map((photo, position) => ({
              ...photo,
              productId: key,
              position,
            })),
          );
      await record(
        tx,
        admin.id,
        productId ? "product.update" : "product.create",
        key,
      );
    });
    refresh();
    return { message: "Produkt zapisany." };
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    return {
      error:
        code === "23505"
          ? "Ten slug lub SKU jest już używany."
          : code
            ? "Nie udało się zapisać produktu. Skontroluj dane."
            : (error as Error).message,
    };
  }
}
export async function productOperation(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({ id, op: z.enum(["draft", "active", "archived", "duplicate"]) })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Nieprawidłowa operacja." };
  try {
    await db().transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(products)
        .where(eq(products.id, data.data.id))
        .for("update");
      if (!p) throw new Error();
      if (data.data.op === "duplicate") {
        const id = randomUUID(),
          suffix = id.slice(0, 8);
        await tx
          .insert(products)
          .values({
            ...p,
            id,
            name: `${p.name} (kopia)`,
            slug: `${p.slug.slice(0, 86)}-${suffix}`,
            status: "draft",
            featured: false,
            createdAt: new Date(),
          });
        const [v, photos] = await Promise.all([
          tx.select().from(variants).where(eq(variants.productId, p.id)),
          tx.select().from(images).where(eq(images.productId, p.id)),
        ]);
        for (const item of v) {
          const vid = randomUUID();
          await tx
            .insert(variants)
            .values({
              ...item,
              id: vid,
              productId: id,
              sku: `${item.sku.slice(0, 70)}-${suffix.toUpperCase()}`,
            });
          await tx.insert(inventory).values({ variantId: vid, stock: 0 });
        }
        if (photos.length)
          await tx
            .insert(images)
            .values(
              photos.map((photo) => ({
                ...photo,
                id: undefined,
                productId: id,
              })),
            );
      } else
        await tx
          .update(products)
          .set({ status: data.data.op })
          .where(eq(products.id, p.id));
      await record(tx, admin.id, `product.${data.data.op}`, p.id);
    });
    refresh();
    return { message: "Zmiana zapisana." };
  } catch {
    return { error: "Nie udało się zmienić produktu." };
  }
}
export async function saveCategory(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({
      id: blank(id),
      name: text(2, 100),
      slug,
      description: text(5, 400),
      image: asset,
      position: z.coerce.number().int().min(0).max(9999),
      parentId: blank(id),
      facets: z.string().max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: data.error.issues[0].message };
  const { id: key, facets, ...fields } = data.data;
  try {
    await db().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(210153)`);
      const all = await tx.select().from(categories);
      const old = all.find((c) => c.id === key);
      if (key && !old) throw new Error("Kategoria już nie istnieje.");
      let ancestor = fields.parentId;
      const visited = new Set<string>();
      while (ancestor) {
        if (ancestor === key || visited.has(ancestor))
          throw new Error("Kategoria nadrzędna tworzy cykl.");
        visited.add(ancestor);
        ancestor = all.find((c) => c.id === ancestor)?.parentId || undefined;
      }
      const values = {
        ...fields,
        active: form.get("active") === "on",
        parentId: fields.parentId ?? null,
        facets: [
          ...new Set(
            facets
              .split(",")
              .map((name) => name.trim().slice(0, 75))
              .filter(Boolean),
          ),
        ].slice(0, 8),
      };
      if (old) {
        if (old.slug !== values.slug)
          await tx
            .insert(categoryRedirects)
            .values({ slug: old.slug, categoryId: old.id })
            .onConflictDoUpdate({
              target: categoryRedirects.slug,
              set: { categoryId: old.id },
            });
        await tx
          .update(categories)
          .set(values)
          .where(eq(categories.id, old.id));
      } else
        await tx.insert(categories).values({ ...values, id: randomUUID() });
      await record(tx, admin.id, "category.save", old?.id || fields.slug);
    });
    refresh();
    return { message: "Kategoria zapisana." };
  } catch (error) {
    return {
      error: (error as { cause?: unknown }).cause
        ? "Sprawdź slug i kategorię nadrzędną."
        : (error as Error).message,
    };
  }
}
export async function correctStock(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const data = z
    .object({
      id,
      delta: z.coerce
        .number()
        .int()
        .min(-500000)
        .max(500000)
        .refine((n) => n !== 0),
      reason: text(4, 160),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: "Podaj niezerową korektę i jej powód." };
  const { id: variantId, delta, reason } = data.data;
  const success = await db().transaction(async (tx) => {
    const [change] = await tx
      .update(inventory)
      .set({ stock: sql`${inventory.stock} + ${delta}` })
      .where(
        and(
          eq(inventory.variantId, variantId),
          sql`${inventory.stock} + ${delta} >= ${inventory.reserved}`,
          sql`${inventory.stock} + ${delta} <= 500000`,
        ),
      )
      .returning();
    if (!change) return false;
    await tx
      .insert(movements)
      .values({ variantId, actorId: admin.id, delta, reason });
    await record(tx, admin.id, "inventory.adjust", variantId);
    return true;
  });
  if (!success)
    return {
      error: "Korekta przekracza limit lub narusza aktywne rezerwacje.",
    };
  refresh();
  return { message: "Stan magazynowy zaktualizowany." };
}

export async function loadProductAdmin(id: string) {
  await requireAdmin();
  const [p] = await db().select().from(products).where(eq(products.id, id));
  if (!p) return undefined;
  const [v, photos] = await Promise.all([
    db()
      .select({ variant: variants, stock: inventory.stock })
      .from(variants)
      .leftJoin(inventory, eq(inventory.variantId, variants.id))
      .where(and(eq(variants.productId, id), eq(variants.active, true)))
      .orderBy(asc(variants.position)),
    db()
      .select()
      .from(images)
      .where(eq(images.productId, id))
      .orderBy(asc(images.position)),
  ]);
  return {
    ...p,
    variants: v.map(({ variant, stock }) => ({
      ...variant,
      stock: stock || 0,
    })),
    images: photos,
  };
}
