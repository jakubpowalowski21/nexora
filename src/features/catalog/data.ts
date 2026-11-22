import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";
import { db, hasDb } from "@/src/db";
import {
  categories,
  categoryRedirects,
  images,
  inventory,
  orderItems,
  orders,
  products,
  reviews,
  settings,
  variants,
} from "@/src/db/schema";
import {
  defaultSettings,
  demoCategories,
  demoProducts,
  demoReviews,
} from "./demo";
import { slugify } from "@/src/lib/format";

export type Variant = typeof variants.$inferSelect & { stock: number };
export type Product = typeof products.$inferSelect & {
  variants: Variant[];
  images: Pick<typeof images.$inferSelect, "url" | "alt" | "position">[];
  rating: number;
  reviewCount: number;
  sold: number;
};
export type Category = typeof categories.$inferSelect;
export type Search = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 12;
export const sorts = [
  ["popularnosc", "Popularność"],
  ["cena-rosnaco", "Cena rosnąco"],
  ["cena-malejaco", "Cena malejąco"],
  ["najnowsze", "Najnowsze"],
  ["ocena", "Najwyżej oceniane"],
  ["nazwa", "Nazwa A–Z"],
];
export const currentPrice = (
  variant: Pick<Variant, "price" | "salePrice" | "saleStart" | "saleEnd">,
  now = new Date(),
) =>
  variant.salePrice &&
  (!variant.saleStart || variant.saleStart <= now) &&
  (!variant.saleEnd || variant.saleEnd > now)
    ? variant.salePrice
    : variant.price;
export const effectivePrice = sql<number>`case when ${variants.salePrice} is not null and (${variants.saleStart} is null or ${variants.saleStart} <= now()) and (${variants.saleEnd} is null or ${variants.saleEnd} > now()) then ${variants.salePrice} else ${variants.price} end`;
export const available = sql<number>`coalesce(${inventory.stock} - ${inventory.reserved}, 0)`;
const average =
  sql<number>`coalesce((select avg(${reviews.rating}) from ${reviews} where ${reviews.productId} = ${products.id} and ${reviews.status} = 'published'), 0)`.mapWith(
    Number,
  );
const reviewsCount =
  sql<number>`(select count(*) from ${reviews} where ${reviews.productId} = ${products.id} and ${reviews.status} = 'published')`.mapWith(
    Number,
  );
const sold =
  sql<number>`coalesce((select sum(${orderItems.quantity}) from ${orderItems} join ${orders} on ${orders.id} = ${orderItems.orderId} where ${orderItems.productId} = ${products.id} and ${orders.payment} in ('paid', 'partially_refunded')), 0)`.mapWith(
    Number,
  );
const get = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 120) || "";
const priceLimit = (value: string) =>
  value && Number.isFinite(Number(value.replace(",", ".")))
    ? Math.round(Number(value.replace(",", ".")) * 100)
    : null;

export function parseFilters(
  query: Search,
  forced?: {
    category?: string;
    sale?: boolean;
    sort?: string;
    featured?: boolean;
    size?: number;
  },
) {
  return {
    q: get(query.szukaj),
    category: forced?.category || get(query.kategoria),
    brand: get(query.marka),
    color: get(query.kolor),
    connection: get(query.lacznosc),
    stock: get(query.dostepnosc),
    sale: forced?.sale || get(query.promocja) === "1",
    rating: Number(get(query.ocena)) || 0,
    min: priceLimit(get(query.cenaOd)),
    max: priceLimit(get(query.cenaDo)),
    sort: forced?.sort || get(query.sortowanie) || "popularnosc",
    page: Math.min(
      1000,
      Math.max(1, Math.floor(Number(get(query.strona))) || 1),
    ),
    featured: forced?.featured || false,
    size: forced?.size || PAGE_SIZE,
    facets: Object.entries(query)
      .filter(([key]) => key.startsWith("param-"))
      .slice(0, 8)
      .map(([key, value]) => [key.slice(6), get(value)] as const)
      .filter(([, value]) => !!value),
  };
}
type Filters = ReturnType<typeof parseFilters>;

let retryAt = 0;
async function catalogData<T>(
  read: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (!hasDb || Date.now() < retryAt) return fallback();
  try {
    return await read();
  } catch (error) {
    const code =
      (error as { code?: string; cause?: { code?: string } }).cause?.code ||
      (error as { code?: string }).code;
    if (
      process.env.VERCEL ||
      (code &&
        ![
          "42P01",
          "ENOTFOUND",
          "EAI_AGAIN",
          "ECONNREFUSED",
          "ECONNRESET",
          "ETIMEDOUT",
          "EACCES",
        ].includes(code)) ||
      (!code &&
        !String((error as { cause?: unknown }).cause || error).includes(
          "timeout",
        ))
    )
      throw error;
    retryAt = Date.now() + 10_000;
    console.warn(
      "NEXORA: katalog korzysta z lokalnych danych demonstracyjnych, PostgreSQL jest chwilowo niedostępny.",
    );
    return fallback();
  }
}

export const getSettings = cache(async () =>
  catalogData(
    async () =>
      (await db().select().from(settings).where(eq(settings.id, 1)))[0] ||
      defaultSettings,
    () => defaultSettings,
  ),
);
export const getCategories = cache(async () =>
  catalogData(
    () =>
      db()
        .select()
        .from(categories)
        .where(eq(categories.active, true))
        .orderBy(asc(categories.position), asc(categories.id)),
    () => demoCategories,
  ),
);
export const getCategory = cache(async (slug: string) =>
  (await getCategories()).find((item) => item.slug === slug),
);
export async function getCategoryRedirect(slug: string) {
  return catalogData(
    async () =>
      (
        await db()
          .select({ slug: categories.slug })
          .from(categoryRedirects)
          .innerJoin(
            categories,
            eq(categoryRedirects.categoryId, categories.id),
          )
          .where(
            and(eq(categoryRedirects.slug, slug), eq(categories.active, true)),
          )
      )[0]?.slug,
    () => undefined,
  );
}

function normalize(value: string) {
  return slugify(value).replaceAll("-", " ");
}
function dbNormalize(value: SQL | typeof products.name) {
  return sql`translate(lower(${value}), 'ąćęłńóśźż', 'acelnoszz')`;
}
function matchesSearch(value: string, q: string) {
  const searchable = normalize(value);
  return normalize(q)
    .split(" ")
    .filter(Boolean)
    .every(
      (word) =>
        searchable.includes(word) ||
        (word.length >= 5 && searchable.includes(word.slice(0, -2))),
    );
}
function matchesVariant(v: Variant, f: Filters) {
  const price = currentPrice(v);
  return (
    (!f.stock || (f.stock === "tak" ? v.stock > 0 : v.stock === 0)) &&
    (!f.color || f.color === v.color) &&
    (!f.connection || f.connection === v.connection) &&
    (f.min === null || price >= f.min) &&
    (f.max === null || price <= f.max) &&
    (!f.sale || price < v.price)
  );
}
function demoCatalog(f: Filters) {
  const list: Product[] = demoProducts
    .map((p) => {
      const approved = demoReviews.filter(
        (review) => review.productId === p.id,
      );
      return {
        ...p,
        rating: approved.length
          ? approved.reduce((sum, review) => sum + review.rating, 0) /
            approved.length
          : 0,
        reviewCount: approved.length,
      };
    })
    .filter(
      (p) =>
        (!f.category || p.categoryId === f.category) &&
        (!f.brand || p.brand === f.brand) &&
        (!f.featured || p.featured) &&
        p.rating >= f.rating &&
        matchesSearch(
          `${p.name} ${p.brand} ${p.summary} ${demoCategories.find((c) => c.id === p.categoryId)?.name}`,
          f.q,
        ) &&
        f.facets.every(([key, val]) => p.specifications[key] === val),
    )
    .map((p) => ({
      ...p,
      variants: p.variants.filter((v) => matchesVariant(v, f)),
    }))
    .filter((p) => p.variants.length);
  const min = (p: Product) => {
    const inStock = p.variants.filter((variant) => variant.stock > 0);
    return Math.min(
      ...(inStock.length ? inStock : p.variants).map((v) => currentPrice(v)),
    );
  };
  list.sort(
    (a, b) =>
      (f.sort === "cena-rosnaco"
        ? min(a) - min(b)
        : f.sort === "cena-malejaco"
          ? min(b) - min(a)
          : f.sort === "ocena"
            ? b.rating - a.rating
            : f.sort === "najnowsze"
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : f.sort === "nazwa"
                ? a.name.localeCompare(b.name, "pl")
                : Number(b.featured) - Number(a.featured)) ||
      a.id.localeCompare(b.id),
  );
  return {
    total: list.length,
    products: list.slice((f.page - 1) * f.size, f.page * f.size),
  };
}

function searchTerms(query: string) {
  const words = normalize(query).split(" ").filter(Boolean).slice(0, 8);
  const search = dbNormalize(
    sql`concat_ws(' ', ${products.name}, ${products.brand}, ${products.summary}, ${categories.name})`,
  );
  return words.map((word) =>
    or(
      sql`${search} like ${`%${word}%`}`,
      word.length >= 5
        ? sql`${search} like ${`%${word.slice(0, -2)}%`}`
        : undefined,
    ),
  );
}
export async function searchSuggestions(query: string) {
  const best = sql<number>`(select ${effectivePrice} from ${variants}
    left join ${inventory} on ${inventory.variantId} = ${variants.id}
    where ${variants.productId} = ${products.id} and ${variants.active}
    order by (${available} > 0) desc, ${effectivePrice}, ${variants.id} limit 1)`.mapWith(
    Number,
  );
  const photo = sql<string>`coalesce((select ${images.url} from ${images} where ${images.productId} = ${products.id}
    order by ${images.position}, ${images.id} limit 1), ${categories.image})`;
  return catalogData(
    () =>
      db()
        .select({
          name: products.name,
          slug: products.slug,
          image: photo,
          price: best,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.status, "active"),
            eq(categories.active, true),
            sql`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.active})`,
            ...searchTerms(query),
          ),
        )
        .orderBy(desc(products.featured), asc(products.name), asc(products.id))
        .limit(6),
    () =>
      demoCatalog(parseFilters({ szukaj: query }, { size: 6 })).products.map(
        (product) => ({
          name: product.name,
          slug: product.slug,
          image: product.images[0].url,
          price: currentPrice(product.variants[0]),
        }),
      ),
  );
}

const base = {
  product: products,
  rating: average,
  reviewCount: reviewsCount,
  sold,
};
async function hydrate(
  rows: {
    product: typeof products.$inferSelect;
    rating: number;
    reviewCount: number;
    sold: number;
  }[],
  filter?: SQL,
) {
  const ids = rows.map(({ product }) => product.id);
  if (!ids.length) return [];
  const [v, photos] = await Promise.all([
    db()
      .select({ variant: variants, stock: available })
      .from(variants)
      .leftJoin(inventory, eq(inventory.variantId, variants.id))
      .where(
        and(
          inArray(variants.productId, ids),
          eq(variants.active, true),
          filter,
        ),
      )
      .orderBy(asc(variants.position), asc(variants.id)),
    db()
      .select()
      .from(images)
      .where(inArray(images.productId, ids))
      .orderBy(asc(images.position), asc(images.id)),
  ]);
  return rows.map(({ product, ...stats }): Product => ({
    ...product,
    ...stats,
    variants: v
      .filter(({ variant }) => variant.productId === product.id)
      .map(({ variant, stock }) => ({ ...variant, stock })),
    images: photos.filter((item) => item.productId === product.id),
  }));
}

export async function catalog(f: Filters) {
  return catalogData(
    async () => {
      const variantFilter = and(
        f.color ? eq(variants.color, f.color) : undefined,
        f.connection ? eq(variants.connection, f.connection) : undefined,
        f.stock === "tak"
          ? sql`${available} > 0`
          : f.stock === "nie"
            ? sql`${available} = 0`
            : undefined,
        f.min !== null ? sql`${effectivePrice} >= ${f.min}` : undefined,
        f.max !== null ? sql`${effectivePrice} <= ${f.max}` : undefined,
        f.sale ? sql`${effectivePrice} < ${variants.price}` : undefined,
      );
      const eligible = db()
        .select({
          productId: variants.productId,
          price:
            sql<number>`coalesce(min(${effectivePrice}) filter (where ${available} > 0), min(${effectivePrice}))`.as(
              "min_price",
            ),
        })
        .from(variants)
        .leftJoin(inventory, eq(variants.id, inventory.variantId))
        .where(and(eq(variants.active, true), variantFilter))
        .groupBy(variants.productId)
        .as("eligible");
      const where = and(
        eq(products.status, "active"),
        eq(categories.active, true),
        f.category ? eq(categories.slug, f.category) : undefined,
        f.brand ? eq(products.brand, f.brand) : undefined,
        f.featured ? eq(products.featured, true) : undefined,
        f.rating ? sql`${average} >= ${f.rating}` : undefined,
        ...searchTerms(f.q),
        ...f.facets.map(
          ([key, value]) => sql`${products.specifications}->>${key} = ${value}`,
        ),
      );
      const order =
        f.sort === "cena-rosnaco"
          ? [asc(eligible.price)]
          : f.sort === "cena-malejaco"
            ? [desc(eligible.price)]
            : f.sort === "najnowsze"
              ? [desc(products.createdAt)]
              : f.sort === "ocena"
                ? [desc(average), desc(reviewsCount)]
                : f.sort === "nazwa"
                  ? [asc(products.name)]
                  : [desc(sold), desc(products.featured)];
      const [rows, totals] = await Promise.all([
        db()
          .select(base)
          .from(products)
          .innerJoin(categories, eq(products.categoryId, categories.id))
          .innerJoin(eligible, eq(eligible.productId, products.id))
          .where(where)
          .orderBy(...order, asc(products.id))
          .limit(f.size)
          .offset((f.page - 1) * f.size),
        db()
          .select({ total: count() })
          .from(products)
          .innerJoin(categories, eq(products.categoryId, categories.id))
          .innerJoin(eligible, eq(eligible.productId, products.id))
          .where(where),
      ]);
      return {
        products: await hydrate(rows, variantFilter),
        total: totals[0].total,
      };
    },
    () => demoCatalog(f),
  );
}

export const getProduct = cache(
  async (slug: string): Promise<Product | undefined> =>
    catalogData(
      async () =>
        (
          await hydrate(
            await db()
              .select(base)
              .from(products)
              .innerJoin(categories, eq(products.categoryId, categories.id))
              .where(
                and(
                  eq(products.slug, slug),
                  eq(products.status, "active"),
                  eq(categories.active, true),
                ),
              ),
          )
        )[0],
      () => demoProducts.find((p) => p.slug === slug),
    ),
);
export async function getProductsById(ids: string[]) {
  if (!ids.length) return [];
  return catalogData(
    () =>
      db()
        .select(base)
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            inArray(products.id, ids),
            eq(products.status, "active"),
            eq(categories.active, true),
          ),
        )
        .then((rows) => hydrate(rows)),
    () => demoProducts.filter((p) => ids.includes(p.id)),
  );
}
export const getReviews = cache(async (productId?: string) =>
  catalogData(
    () =>
      db()
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.status, "published"),
            productId ? eq(reviews.productId, productId) : undefined,
          ),
        )
        .orderBy(desc(reviews.createdAt))
        .limit(productId ? 40 : 3),
    () =>
      demoReviews.filter(
        (review) => !productId || review.productId === productId,
      ),
  ),
);
export async function filterOptions(category?: string) {
  const format = (
    rows: Array<{
      brand: string;
      specifications: Record<string, string>;
      color: string;
      connection: string;
    }>,
    facets: string[],
  ) => ({
    brands: [...new Set(rows.map((p) => p.brand))].sort(),
    colors: [...new Set(rows.map((p) => p.color))].sort(),
    connections: [...new Set(rows.map((p) => p.connection))].sort(),
    facets: Object.fromEntries(
      facets.map((key) => [
        key,
        [
          ...new Set(rows.map((p) => p.specifications[key]).filter(Boolean)),
        ].sort(),
      ]),
    ),
  });
  const selected = category ? await getCategory(category) : undefined;
  return catalogData(
    () =>
      db()
        .select({
          brand: products.brand,
          specifications: products.specifications,
          color: variants.color,
          connection: variants.connection,
        })
        .from(products)
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .innerJoin(variants, eq(variants.productId, products.id))
        .where(
          and(
            eq(products.status, "active"),
            eq(categories.active, true),
            eq(variants.active, true),
            category ? eq(categories.slug, category) : undefined,
          ),
        )
        .then((rows) => format(rows, selected?.facets || [])),
    () =>
      format(
        demoProducts
          .filter((p) => !category || p.categoryId === category)
          .flatMap((p) =>
            p.variants.map((v) => ({
              ...v,
              brand: p.brand,
              specifications: p.specifications,
            })),
          ),
        selected?.facets || [],
      ),
  );
}
