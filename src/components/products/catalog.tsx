import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  SlidersHorizontal,
} from "lucide-react";
import {
  catalog,
  filterOptions,
  getCategories,
  parseFilters,
  sorts,
  type Category,
  type Search,
} from "@/src/features/catalog/data";
import { Breadcrumbs } from "@/src/components/ui/breadcrumbs";
import { Button } from "@/src/components/ui/button";
import { ProductGrid } from "./card";

export async function CatalogPage({
  query,
  base = "/produkty",
  category,
  sale = false,
  recent = false,
}: {
  query: Search;
  base?: string;
  category?: Category;
  sale?: boolean;
  recent?: boolean;
}) {
  const filters = parseFilters(query, {
    category: category?.slug,
    sale,
    sort: recent && !query.sortowanie ? "najnowsze" : undefined,
  });
  const [result, categories, options] = await Promise.all([
    catalog(filters),
    getCategories(),
    filterOptions(filters.category),
  ]);
  const title =
    category?.name ||
    (sale ? "Promocje" : recent ? "Nowości" : "Wszystkie produkty");
  const copy =
    category?.description ||
    (sale
      ? "Sprzęt w aktualnych cenach promocyjnych."
      : recent
        ? "Najnowsze produkty w ofercie NEXORA."
        : "Znajdź sprzęt dopasowany do siebie.");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const selected = Array.isArray(value) ? value[0] : value;
    if (selected && key !== "strona") params.set(key, selected);
  }
  const pageLink = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set("strona", String(page));
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const total = Math.ceil(result.total / filters.size);
  const start = Math.min(Math.max(1, filters.page - 2), Math.max(1, total - 4));
  const select = (
    label: string,
    name: string,
    items: string[][],
    value: string,
  ) => (
    <label key={name}>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">Wszystkie</option>
        {items.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const named = (items: string[]) => items.map((name) => [name, name]);
  return (
    <div className="wrap page-space">
      <Breadcrumbs items={[{ name: title }]} />
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <div className="catalog-layout">
        <aside>
          <form action={base} key={params.toString()} className="filters">
            <h2>
              <SlidersHorizontal size={17} /> Filtry i sortowanie
            </h2>
            <label>
              Szukaj
              <input
                name="szukaj"
                placeholder="Nazwa, marka lub kategoria"
                defaultValue={filters.q}
                maxLength={120}
              />
            </label>
            {!category &&
              select(
                "Kategoria",
                "kategoria",
                categories.map((c) => [c.slug, c.name]),
                filters.category,
              )}
            {select("Marka", "marka", named(options.brands), filters.brand)}
            <fieldset className="price-fields">
              <legend>Cena w złotych</legend>
              <label>
                Od
                <input
                  name="cenaOd"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={filters.min === null ? "" : filters.min / 100}
                />
              </label>
              <label>
                Do
                <input
                  name="cenaDo"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={filters.max === null ? "" : filters.max / 100}
                />
              </label>
            </fieldset>
            {select(
              "Dostępność",
              "dostepnosc",
              [
                ["tak", "Dostępne"],
                ["nie", "Niedostępne"],
              ],
              filters.stock,
            )}
            {select("Kolor", "kolor", named(options.colors), filters.color)}
            {select(
              "Łączność",
              "lacznosc",
              named(options.connections),
              filters.connection,
            )}
            {Object.entries(options.facets).map(([label, values]) =>
              select(
                label,
                `param-${label}`,
                named(values),
                filters.facets.find(([name]) => name === label)?.[1] || "",
              ),
            )}
            {select(
              "Ocena",
              "ocena",
              [
                ["4", "Od 4 gwiazdek"],
                ["5", "5 gwiazdek"],
              ],
              filters.rating ? String(filters.rating) : "",
            )}
            {!sale && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="promocja"
                  value="1"
                  defaultChecked={filters.sale}
                />{" "}
                Tylko przecenione
              </label>
            )}
            <label>
              Sortowanie
              <select name="sortowanie" defaultValue={filters.sort}>
                {sorts.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Zastosuj filtry</Button>
            <Button asChild variant="secondary">
              <Link href={base}>Wyczyść filtry</Link>
            </Button>
          </form>
        </aside>
        <section aria-label="Wyniki wyszukiwania">
          <div className="results-head">
            <p role="status">
              {result.total} {result.total === 1 ? "produkt" : "produktów"}
              {filters.q && <> dla „{filters.q}”</>}
            </p>
            {total > 1 && (
              <small>
                Strona {filters.page} z {total}
              </small>
            )}
          </div>
          {!result.products.length ? (
            <div className="empty">
              <PackageSearch size={34} />
              <h2>Nie znaleziono produktów spełniających kryteria</h2>
              <Button asChild variant="secondary">
                <Link href={base}>Wyczyść filtry</Link>
              </Button>
            </div>
          ) : (
            <ProductGrid products={result.products} isNew={recent} />
          )}
          {total > 1 && (
            <nav aria-label="Strony katalogu" className="pagination">
              {filters.page > 1 && (
                <Link
                  href={pageLink(filters.page - 1)}
                  aria-label="Poprzednia strona"
                >
                  <ChevronLeft size={18} />
                </Link>
              )}
              {Array.from(
                { length: Math.min(total, 5) },
                (_, i) => i + start,
              ).map((page) => (
                <Link
                  key={page}
                  href={pageLink(page)}
                  aria-label={`Strona ${page}`}
                  aria-current={page === filters.page ? "page" : undefined}
                >
                  {page}
                </Link>
              ))}
              {filters.page < total && (
                <Link
                  href={pageLink(filters.page + 1)}
                  aria-label="Następna strona"
                >
                  <ChevronRight size={18} />
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
