import { CatalogPage } from "@/src/components/products/catalog";
import type { Search } from "@/src/features/catalog/data";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return {
    title: "Promocje",
    alternates: { canonical: "/promocje" },
    robots: Object.keys(await searchParams).length
      ? { index: false, follow: true }
      : undefined,
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return <CatalogPage query={await searchParams} base="/promocje" sale />;
}
