import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { orders } from "@/src/db/schema";
import { requireCustomer } from "@/src/lib/auth";
import { OrderTable } from "@/src/components/account/order-table";
export default async function Page() {
  const user = await requireCustomer();
  const rows = await db()
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));
  return (
    <>
      <div className="page-heading">
        <h1>Moje zamówienia</h1>
      </div>
      <OrderTable rows={rows} />
    </>
  );
}
