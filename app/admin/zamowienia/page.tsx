import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/src/lib/auth";
import { db } from "@/src/db";
import { orders } from "@/src/db/schema";
import { paymentLabels, fulfillmentLabels } from "@/src/lib/format";
import { OrderTable } from "@/src/components/account/order-table";
import { Button } from "@/src/components/ui/button";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string }>;
}) {
  await requireAdmin();
  const data = await searchParams,
    q = typeof data.q === "string" ? data.q.trim().slice(0, 120) : "";
  const status = Object.keys(fulfillmentLabels).includes(data.status || "")
    ? (data.status as keyof typeof fulfillmentLabels)
    : undefined;
  const payment = Object.keys(paymentLabels).includes(data.payment || "")
    ? (data.payment as keyof typeof paymentLabels)
    : undefined;
  const number = sql<string>`concat('NX-', extract(year from ${orders.createdAt} at time zone 'Europe/Warsaw')::int, '-', lpad(${orders.sequence}::text, greatest(6,length(${orders.sequence}::text)),'0'))`;
  const rows = await db()
    .select()
    .from(orders)
    .where(
      and(
        q
          ? or(ilike(orders.email, `%${q}%`), ilike(number, `%${q}%`))
          : undefined,
        status ? eq(orders.fulfillment, status) : undefined,
        payment ? eq(orders.payment, payment) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(150);
  return (
    <>
      <div className="page-heading">
        <h1>Zamówienia</h1>
      </div>
      <form className="admin-query">
        <label>
          Numer lub e-mail
          <input name="q" defaultValue={q} />
        </label>
        <label>
          Realizacja
          <select name="status" defaultValue={status || ""}>
            <option value="">Wszystkie</option>
            {Object.entries(fulfillmentLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Płatność
          <select name="payment" defaultValue={payment || ""}>
            <option value="">Wszystkie</option>
            {Object.entries(paymentLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Filtruj</Button>
      </form>
      <OrderTable rows={rows} admin />
    </>
  );
}
