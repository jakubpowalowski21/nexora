import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { favorites } from "@/src/db/schema";
import { requireCustomer } from "@/src/lib/auth";
import { getProductsById } from "@/src/features/catalog/data";
import { ProductGrid } from "@/src/components/products/card";
export default async function Page() {
  const user = await requireCustomer();
  const ids = await db()
    .select({ id: favorites.productId })
    .from(favorites)
    .where(eq(favorites.userId, user.id));
  const products = await getProductsById(ids.map((p) => p.id));
  return (
    <>
      <div className="page-heading">
        <h1>Ulubione produkty</h1>
      </div>
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <div className="panel">
          <p>Ulubione jest puste.</p>
          <Link className="text-link" href="/produkty">
            Przeglądaj katalog
          </Link>
        </div>
      )}
    </>
  );
}
