import type { MetadataRoute } from "next";
import {
  catalog,
  getCategories,
  parseFilters,
} from "@/src/features/catalog/data";
import { siteUrl } from "@/src/lib/format";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [result, categories] = await Promise.all([
    catalog(parseFilters({}, { size: 5000 })),
    getCategories(),
  ]);
  const base = siteUrl();
  return [
    ...[
      "/",
      "/produkty",
      "/promocje",
      "/nowosci",
      "/kontakt",
      "/o-nas",
      "/dostawa-i-platnosci",
      "/zwroty-i-reklamacje",
      "/regulamin",
      "/polityka-prywatnosci",
    ].map((path) => ({ url: base + path })),
    ...categories.map((c) => ({ url: `${base}/kategorie/${c.slug}` })),
    ...result.products.map((p) => ({ url: `${base}/produkt/${p.slug}` })),
  ];
}
