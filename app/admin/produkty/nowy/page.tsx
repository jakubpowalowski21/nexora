import { asc } from "drizzle-orm";
import { requireAdmin } from "@/src/lib/auth";
import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { ProductEditor } from "@/src/components/admin/product-editor";
export default async function Page() {
  await requireAdmin();
  const all = await db()
    .select()
    .from(categories)
    .orderBy(asc(categories.position));
  return (
    <>
      <div className="page-heading">
        <h1>Dodaj produkt</h1>
      </div>
      <ProductEditor categories={all} />
    </>
  );
}
