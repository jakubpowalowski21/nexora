import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { favorites, orders } from "@/src/db/schema";
import { requireCustomer } from "@/src/lib/auth";
import { catalog, parseFilters } from "@/src/features/catalog/data";
import { date } from "@/src/lib/format";
import { ProductGrid } from "@/src/components/products/card";
import { OrderTable } from "@/src/components/account/order-table";
export default async function Page() {
  const user = await requireCustomer();
  const [recent, total, active, saved, recommended, last] = await Promise.all([
    db()
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(3),
    db()
      .select({ total: count() })
      .from(orders)
      .where(eq(orders.userId, user.id)),
    db()
      .select({ total: count() })
      .from(orders)
      .where(
        and(
          eq(orders.userId, user.id),
          inArray(orders.fulfillment, ["processing", "shipped"]),
        ),
      ),
    db()
      .select({ total: count() })
      .from(favorites)
      .where(eq(favorites.userId, user.id)),
    catalog(parseFilters({}, { size: 3, featured: true })),
    db()
      .select({ paidAt: orders.paidAt })
      .from(orders)
      .where(
        and(
          eq(orders.userId, user.id),
          inArray(orders.payment, ["paid", "partially_refunded"]),
        ),
      )
      .orderBy(desc(orders.paidAt))
      .limit(1),
  ]);
  return (
    <>
      <div className="page-heading">
        <h1>Witaj, {user.name.split(" ")[0]}!</h1>
        <p>Zarządzaj zakupami i danymi konta.</p>
      </div>
      <div className="metrics">
        {[
          ["Zamówienia", total[0].total],
          ["W realizacji", active[0].total],
          ["Ulubione", saved[0].total],
          ["Ostatni zakup", last[0]?.paidAt ? date(last[0].paidAt) : "—"],
        ].map(([label, value]) => (
          <div className="panel metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="section-heading dashboard-gap">
        <h2>Ostatnie zamówienia</h2>
        <Link className="text-link" href="/konto/zamowienia">
          Wszystkie zamówienia
        </Link>
      </div>
      <OrderTable rows={recent} />
      <div className="section-heading dashboard-gap">
        <h2>Polecany sprzęt</h2>
      </div>
      <ProductGrid products={recommended.products} />
    </>
  );
}
