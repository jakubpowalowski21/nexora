import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { addresses } from "@/src/db/schema";
import { requireCustomer } from "@/src/lib/auth";
import { AddressForm } from "@/src/components/account/addresses";
export default async function Page() {
  const user = await requireCustomer();
  const rows = await db()
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id));
  return (
    <>
      <div className="page-heading">
        <h1>Adresy dostawy</h1>
      </div>
      <div className="detail-sections">
        {rows.map((entry) => (
          <AddressForm key={entry.id} entry={entry} />
        ))}
        <AddressForm />
      </div>
    </>
  );
}
