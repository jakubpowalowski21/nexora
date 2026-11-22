import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { Address } from "@/src/lib/validation";

const time = (name: string) => timestamp(name, { withTimezone: true });
const created = () => time("created_at").notNull().defaultNow();
const id = () => uuid("id").defaultRandom().primaryKey();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const role = pgEnum("role", ["customer", "admin"]);
export const productStatus = pgEnum("product_status", [
  "active",
  "draft",
  "archived",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const fulfillment = pgEnum("fulfillment", [
  "new",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);
export const moderation = pgEnum("moderation", [
  "pending",
  "published",
  "rejected",
]);
export const ticketStatus = pgEnum("ticket_status", [
  "new",
  "processing",
  "resolved",
]);

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: role().default("customer").notNull(),
  verifiedAt: time("verified_at"),
  phone: text(),
  lastLoginAt: time("last_login_at"),
  authVersion: integer().notNull().default(0),
  createdAt: created(),
});
export const tokens = pgTable(
  "auth_tokens",
  {
    hash: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull(),
    targetEmail: text(),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [index().on(t.userId, t.type)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  until: time("until").notNull(),
});
export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text().notNull(),
    data: jsonb().$type<Address>().notNull(),
    isDefault: boolean().default(false).notNull(),
  },
  (t) => [index().on(t.userId)],
);
export const categories = pgTable("categories", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull(),
  image: text().notNull(),
  position: integer().default(0).notNull(),
  active: boolean().default(true).notNull(),
  parentId: text().references((): AnyPgColumn => categories.id),
  facets: jsonb().$type<string[]>().notNull().default([]),
});
export const categoryRedirects = pgTable("category_redirects", {
  slug: text().primaryKey(),
  categoryId: text()
    .notNull()
    .references(() => categories.id),
});
export const brands = pgTable("brands", { name: text().primaryKey() });
export const products = pgTable(
  "products",
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    brand: text()
      .notNull()
      .references(() => brands.name),
    categoryId: text()
      .notNull()
      .references(() => categories.id),
    summary: text().notNull(),
    description: text().notNull(),
    specifications: jsonb()
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    box: text().notNull().default("Produkt, dokumentacja"),
    status: productStatus().default("draft").notNull(),
    featured: boolean().default(false).notNull(),
    metaTitle: text(),
    metaDescription: text(),
    ogImage: text(),
    tax: integer().default(23).notNull(),
    createdAt: created(),
  },
  (t) => [index().on(t.categoryId, t.status, t.createdAt)],
);
export const variants = pgTable(
  "product_variants",
  {
    id: text().primaryKey(),
    productId: text()
      .notNull()
      .references(() => products.id),
    name: text().notNull(),
    sku: text().notNull().unique(),
    color: text().notNull(),
    connection: text().notNull(),
    price: integer().notNull(),
    salePrice: integer(),
    saleStart: time("sale_start"),
    saleEnd: time("sale_end"),
    image: text(),
    position: integer().notNull().default(0),
    active: boolean().notNull().default(true),
  },
  (t) => [
    index().on(t.productId),
    check(
      "valid_variant_price",
      sql`${t.price} > 0 and (${t.salePrice} is null or (${t.salePrice} > 0 and ${t.salePrice} < ${t.price}))`,
    ),
  ],
);
export const images = pgTable(
  "product_images",
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id),
    url: text().notNull(),
    alt: text().notNull(),
    // Earlier deployments still read this nullable column.
    legacyProviderId: text("public_id"),
    position: integer().notNull().default(0),
  },
  (t) => [index().on(t.productId, t.position)],
);
export const uploadedImages = pgTable(
  "uploaded_images",
  {
    digest: text().primaryKey(),
    bytes: bytea().notNull(),
    createdAt: created(),
  },
  (table) => [
    check(
      "uploaded_image_size",
      sql`octet_length(${table.bytes}) between 1 and 3000000`,
    ),
  ],
);
export const inventory = pgTable(
  "inventory",
  {
    variantId: text()
      .primaryKey()
      .references(() => variants.id),
    stock: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
  },
  (t) => [
    check(
      "valid_inventory",
      sql`${t.stock} >= ${t.reserved} and ${t.reserved} >= 0`,
    ),
  ],
);
export const movements = pgTable(
  "inventory_movements",
  {
    id: id(),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    actorId: uuid().references(() => users.id),
    orderId: uuid().references(() => orders.id),
    delta: integer().notNull(),
    reservedDelta: integer().notNull().default(0),
    reason: text().notNull(),
    createdAt: created(),
  },
  (t) => [index().on(t.variantId, t.createdAt)],
);
export const cartItems = pgTable(
  "cart_items",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    quantity: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.variantId] }),
    check("valid_cart_quantity", sql`${t.quantity} between 1 and 99`),
  ],
);
export const cartMerges = pgTable(
  "cart_merges",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: uuid().notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.requestId] })],
);
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text()
      .notNull()
      .references(() => products.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);
export const coupons = pgTable("coupons", {
  code: text().primaryKey(),
  kind: text({ enum: ["percent", "fixed"] }).notNull(),
  value: integer().notNull(),
  minimum: integer().notNull().default(0),
  maximum: integer(),
  usageLimit: integer(),
  customerLimit: integer(),
  expiresAt: time("expires_at"),
  active: boolean().notNull().default(true),
  stack: boolean().notNull().default(false),
  productIds: jsonb().$type<string[]>().notNull().default([]),
  categoryIds: jsonb().$type<string[]>().notNull().default([]),
});
export const orders = pgTable(
  "orders",
  {
    id: id(),
    sequence: serial().notNull().unique(),
    requestId: uuid().notNull().unique(),
    lookupHash: text().notNull(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    address: jsonb().$type<Address>().notNull(),
    shippingMethod: text().notNull(),
    paymentMethod: text({ enum: ["stripe", "transfer"] }).notNull(),
    subtotal: integer().notNull(),
    discount: integer().notNull(),
    shippingCost: integer().notNull(),
    total: integer().notNull(),
    refundedTotal: integer().notNull().default(0),
    payment: paymentStatus().notNull().default("pending"),
    fulfillment: fulfillment().notNull().default("new"),
    stripeSession: text().unique(),
    stripeIntent: text().unique(),
    expiresAt: time("expires_at").notNull(),
    paidAt: time("paid_at"),
    createdAt: created(),
  },
  (t) => [
    index().on(t.userId, t.createdAt),
    index().on(t.payment, t.expiresAt),
    index().on(t.paidAt),
    check(
      "valid_order_totals",
      sql`${t.total} >= 0 and ${t.refundedTotal} between 0 and ${t.total}`,
    ),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    productId: text()
      .notNull()
      .references(() => products.id),
    name: text().notNull(),
    variant: text().notNull(),
    sku: text().notNull(),
    unitPrice: integer().notNull(),
    regularPrice: integer().notNull(),
    tax: integer().notNull(),
    quantity: integer().notNull(),
  },
  (t) => [index().on(t.orderId), index().on(t.productId)],
);
export const reservations = pgTable(
  "inventory_reservations",
  {
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    variantId: text()
      .notNull()
      .references(() => variants.id),
    quantity: integer().notNull(),
    state: text({ enum: ["held", "claimed", "released"] })
      .notNull()
      .default("held"),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.variantId] })],
);
export const redemptions = pgTable(
  "coupon_redemptions",
  {
    orderId: uuid()
      .primaryKey()
      .references(() => orders.id),
    code: text()
      .notNull()
      .references(() => coupons.code),
    email: text().notNull(),
    status: text({ enum: ["held", "used", "released"] })
      .notNull()
      .default("held"),
  },
  (t) => [index().on(t.code, t.email)],
);
export const orderHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    actorId: uuid().references(() => users.id),
    label: text().notNull(),
    createdAt: created(),
  },
  (t) => [index().on(t.orderId)],
);
export const shipments = pgTable("shipments", {
  orderId: uuid()
    .primaryKey()
    .references(() => orders.id),
  tracking: text().notNull(),
  shippedAt: time("shipped_at").defaultNow().notNull(),
});
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    productId: text()
      .notNull()
      .references(() => products.id),
    author: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    rating: integer().notNull(),
    status: moderation().notNull().default("pending"),
    sample: boolean().notNull().default(false),
    createdAt: created(),
  },
  (t) => [
    unique().on(t.userId, t.productId),
    index().on(t.productId, t.status),
    check("valid_rating", sql`${t.rating} between 1 and 5`),
  ],
);
export const returns = pgTable(
  "returns",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    email: text().notNull(),
    type: text({ enum: ["return", "complaint"] }).notNull(),
    body: text().notNull(),
    status: ticketStatus().default("new").notNull(),
    createdAt: created(),
  },
  (t) => [index().on(t.orderId)],
);
export const returnItems = pgTable(
  "return_items",
  {
    returnId: uuid()
      .notNull()
      .references(() => returns.id),
    itemId: uuid()
      .notNull()
      .references(() => orderItems.id),
  },
  (t) => [primaryKey({ columns: [t.returnId, t.itemId] })],
);
export const messages = pgTable("contact_messages", {
  id: id(),
  email: text().notNull(),
  subject: text().notNull(),
  body: text().notNull(),
  status: ticketStatus().notNull().default("new"),
  createdAt: created(),
});
export const newsletter = pgTable("newsletter_subscribers", {
  email: text().primaryKey(),
  consentVersion: text().notNull(),
  createdAt: created(),
});
export const settings = pgTable("store_settings", {
  id: integer().primaryKey().default(1),
  name: text().default("NEXORA").notNull(),
  description: text()
    .default("Elektronika, która dobrze pasuje do Twojej codzienności.")
    .notNull(),
  email: text().default("kontakt@nexora.example").notNull(),
  freeShipping: integer().default(19900).notNull(),
  shippingOptions: jsonb()
    .$type<Array<{ id: string; price: number }>>()
    .notNull()
    .default([
      { id: "pickup", price: 999 },
      { id: "courier", price: 1499 },
      { id: "express", price: 2499 },
    ]),
  newsletterEnabled: boolean().default(true).notNull(),
  heroTitle: text().default("Technologia, która robi różnicę.").notNull(),
  heroText: text()
    .default(
      "Odkryj sprzęt zaprojektowany z myślą o Twojej codzienności. Wyjątkowa jakość, nowoczesny design i komfort bez kompromisów.",
    )
    .notNull(),
  seo: text(),
});
export const audit = pgTable("admin_audit_logs", {
  id: id(),
  adminId: uuid()
    .notNull()
    .references(() => users.id),
  action: text().notNull(),
  target: text().notNull(),
  createdAt: created(),
});
export const webhookEvents = pgTable("webhook_events", {
  id: text().primaryKey(),
  type: text().notNull(),
  createdAt: created(),
});
export const outbox = pgTable(
  "email_outbox",
  {
    id: id(),
    key: text().notNull().unique(),
    to: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    attempts: integer().default(0).notNull(),
    nextAt: time("next_at").notNull().defaultNow(),
    sentAt: time("sent_at"),
    createdAt: created(),
  },
  (t) => [index().on(t.sentAt, t.nextAt)],
);
