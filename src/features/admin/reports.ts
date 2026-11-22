import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  categories,
  inventory,
  messages,
  orderItems,
  orders,
  products,
  redemptions,
  returns,
  users,
  variants,
} from "@/src/db/schema";

const localDate = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const dayMs = 86400000;
function midnight(day: string) {
  const utc = new Date(day + "T00:00:00Z");
  const zone = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "longOffset",
  })
    .formatToParts(utc)
    .find((x) => x.type === "timeZoneName")!.value;
  return new Date(utc.getTime() - Number(zone.slice(3, 6)) * 3_600_000);
}
export function dateRange(query: { okres?: string; od?: string; do?: string }) {
  const now = new Date(),
    today = localDate(now);
  const days = query.okres === "1" ? 1 : query.okres === "7" ? 7 : 30;
  const parse = (value?: string) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
      ? value
      : undefined;
  const to = parse(query.do) || today;
  const requested = parse(query.od);
  const from =
    requested &&
    requested <= to &&
    Date.parse(to) - Date.parse(requested) <= 366 * dayMs
      ? requested
      : new Date(Date.parse(to) - (days - 1) * dayMs)
          .toISOString()
          .slice(0, 10);
  return {
    from,
    to,
    start: midnight(from),
    end: midnight(new Date(Date.parse(to) + dayMs).toISOString().slice(0, 10)),
  };
}
type Range = ReturnType<typeof dateRange>;
export async function report(range: Range) {
  const repo = db(),
    paid = and(gte(orders.paidAt, range.start), lt(orders.paidAt, range.end));
  const placed = and(
    gte(orders.createdAt, range.start),
    lt(orders.createdAt, range.end),
  );
  const day = sql<string>`(${orders.paidAt} at time zone 'Europe/Warsaw')::date::text`;
  const amount =
    sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}),0)`.mapWith(
      Number,
    );
  const quantity = sql<number>`coalesce(sum(${orderItems.quantity}),0)`.mapWith(
    Number,
  );
  const salesValue =
    sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}::bigint),0)`.mapWith(
      Number,
    );
  const customer = sql<string>`coalesce(${orders.userId}::text, ${orders.email})`;
  const [
    summary,
    placedCount,
    newCustomers,
    daily,
    top,
    byCategory,
    statuses,
    discounts,
    buyers,
  ] = await Promise.all([
    repo
      .select({
        revenue: amount,
        purchases:
          sql<number>`count(*) filter (where ${orders.payment} <> 'refunded')`.mapWith(
            Number,
          ),
      })
      .from(orders)
      .where(paid),
    repo.select({ count: count() }).from(orders).where(placed),
    repo
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.role, "customer"),
          gte(users.createdAt, range.start),
          lt(users.createdAt, range.end),
        ),
      ),
    repo
      .select({ day, revenue: amount })
      .from(orders)
      .where(paid)
      .groupBy(day)
      .orderBy(asc(day)),
    repo
      .select({
        id: orderItems.productId,
        name: sql<string>`max(${orderItems.name})`,
        quantity,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(paid, sql`${orders.payment} <> 'refunded'`))
      .groupBy(orderItems.productId)
      .orderBy(desc(quantity), asc(orderItems.productId))
      .limit(8),
    repo
      .select({ name: categories.name, value: salesValue, quantity })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(paid, sql`${orders.payment} <> 'refunded'`))
      .groupBy(categories.name)
      .orderBy(desc(salesValue)),
    repo
      .select({ status: orders.fulfillment, count: count() })
      .from(orders)
      .where(placed)
      .groupBy(orders.fulfillment),
    repo
      .select({ code: redemptions.code, count: count() })
      .from(redemptions)
      .innerJoin(orders, eq(redemptions.orderId, orders.id))
      .where(
        and(
          eq(redemptions.status, "used"),
          paid,
          sql`${orders.payment} <> 'refunded'`,
        ),
      )
      .groupBy(redemptions.code)
      .orderBy(desc(count())),
    repo
      .select({ id: customer, first: sql<Date>`min(${orders.paidAt})` })
      .from(orders)
      .where(
        sql`${orders.paidAt} is not null and ${orders.paidAt} < ${range.end} and ${orders.payment} <> 'refunded'`,
      )
      .groupBy(customer)
      .having(sql`bool_or(${orders.paidAt} >= ${range.start})`),
  ]);
  const newBuyers = buyers.filter(
    (row) => new Date(row.first) >= range.start,
  ).length;
  const days =
    Math.round((Date.parse(range.to) - Date.parse(range.from)) / dayMs) + 1;
  const chart =
    days <= 31
      ? Array.from({ length: days }, (_, i) =>
          new Date(Date.parse(range.from) + i * dayMs)
            .toISOString()
            .slice(0, 10),
        ).map((day) => ({
          day,
          revenue: daily.find((row) => row.day === day)?.revenue || 0,
        }))
      : daily;
  return {
    revenue: summary[0].revenue,
    average: summary[0].purchases
      ? Math.round(summary[0].revenue / summary[0].purchases)
      : 0,
    count: placedCount[0].count,
    newCustomers: newCustomers[0].count,
    chart,
    top,
    byCategory,
    statuses,
    discounts,
    newBuyers,
    returningBuyers: buyers.length - newBuyers,
  };
}
export async function overview() {
  const repo = db();
  const [recent, low, newMessages, newReturns] = await Promise.all([
    repo.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    repo
      .select({
        id: variants.id,
        name: products.name,
        variant: variants.name,
        available: sql<number>`${inventory.stock} - ${inventory.reserved}`,
      })
      .from(inventory)
      .innerJoin(variants, eq(variants.id, inventory.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(
        and(
          eq(products.status, "active"),
          eq(variants.active, true),
          sql`${inventory.stock} - ${inventory.reserved} < 5`,
        ),
      )
      .orderBy(asc(sql`${inventory.stock} - ${inventory.reserved}`))
      .limit(10),
    repo
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.status} <> 'resolved'`),
    repo
      .select({ count: count() })
      .from(returns)
      .where(sql`${returns.status} <> 'resolved'`),
  ]);
  return { recent, low, tickets: newMessages[0].count + newReturns[0].count };
}
