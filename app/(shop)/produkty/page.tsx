import { CatalogPage } from "@/src/components/products/catalog";
import type { Search } from "@/src/features/catalog/data";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const query = await searchParams;
  return {
    title: "Produkty",
    alternates: { canonical: "/produkty" },
    robots: Object.keys(query).length
      ? { index: false, follow: true }
      : undefined,
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return <CatalogPage query={await searchParams} />;
}
