import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth";
import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { ProductEditor } from "@/src/components/admin/product-editor";
import { loadProductAdmin } from "@/src/features/admin/products";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [product, all] = await Promise.all([
    loadProductAdmin(id),
    db().select().from(categories).orderBy(asc(categories.position)),
  ]);
  if (!product) notFound();
  return (
    <>
      <div className="page-heading">
        <h1>Edytuj produkt</h1>
        <p>{product.name}</p>
      </div>
      <ProductEditor product={product} categories={all} />
    </>
  );
}
