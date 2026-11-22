import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/src/lib/auth";
import { db } from "@/src/db";
import { categories, inventory, products, variants } from "@/src/db/schema";
import { productOperation } from "@/src/features/admin/products";
import { ActionForm } from "@/src/components/ui/forms";
import { Button } from "@/src/components/ui/button";
import { money } from "@/src/lib/format";
const states = {
  active: "Aktywny",
  draft: "Szkic",
  archived: "Archiwalny",
} as const;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kategoria?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams,
    q = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "",
    category = typeof query.kategoria === "string" ? query.kategoria : "";
  const status = Object.keys(states).includes(query.status || "")
    ? (query.status as keyof typeof states)
    : undefined;
  const [items, all] = await Promise.all([
    db()
      .select({
        p: products,
        category: categories.name,
        price: sql<number>`min(${variants.price})`.mapWith(Number),
        stock:
          sql<number>`coalesce(sum(${inventory.stock} - ${inventory.reserved}),0)`.mapWith(
            Number,
          ),
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(
        variants,
        and(eq(variants.productId, products.id), eq(variants.active, true)),
      )
      .leftJoin(inventory, eq(inventory.variantId, variants.id))
      .where(
        and(
          q
            ? or(
                ilike(products.name, `%${q}%`),
                ilike(products.brand, `%${q}%`),
                ilike(variants.sku, `%${q}%`),
              )
            : undefined,
          status ? eq(products.status, status) : undefined,
          category ? eq(categories.id, category) : undefined,
        ),
      )
      .groupBy(products.id, categories.name)
      .orderBy(asc(products.name))
      .limit(250),
    db().select().from(categories).orderBy(asc(categories.position)),
  ]);
  return (
    <>
      <div className="section-heading">
        <div className="page-heading">
          <h1>Produkty</h1>
        </div>
        <Button asChild>
          <Link href="/admin/produkty/nowy">Dodaj produkt</Link>
        </Button>
      </div>
      <form className="admin-query">
        <label>
          Szukaj
          <input name="q" defaultValue={q} placeholder="Nazwa, marka lub SKU" />
        </label>
        <label>
          Kategoria
          <select name="kategoria" defaultValue={category}>
            <option value="">Wszystkie</option>
            {all.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status || ""}>
            <option value="">Wszystkie</option>
            {Object.entries(states).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Filtruj</Button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Kategoria</th>
              <th>Cena od</th>
              <th>Dostępne</th>
              <th>Status</th>
              <th>Operacje</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ p, category, price, stock }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/produkty/${p.id}/edytuj`}>{p.name}</Link>
                </td>
                <td>{category}</td>
                <td>{price ? money(price) : "—"}</td>
                <td>{stock}</td>
                <td>{states[p.status]}</td>
                <td>
                  <ActionForm
                    action={productOperation}
                    submit="Wykonaj"
                    variant="secondary"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="op"
                      aria-label={`Operacja dla produktu ${p.name}`}
                      defaultValue="duplicate"
                    >
                      <option value="duplicate">Duplikuj</option>
                      {p.status !== "active" && (
                        <option value="active">Opublikuj</option>
                      )}
                      {p.status !== "draft" && (
                        <option value="draft">Ukryj</option>
                      )}
                      {p.status !== "archived" && (
                        <option value="archived">Archiwizuj</option>
                      )}
                    </select>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="panel">Brak wyników.</p>}
      </div>
    </>
  );
}
