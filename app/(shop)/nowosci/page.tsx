import { CatalogPage } from "@/src/components/products/catalog";
import type { Search } from "@/src/features/catalog/data";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return {
    title: "Nowości",
    alternates: { canonical: "/nowosci" },
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
  return <CatalogPage query={await searchParams} base="/nowosci" recent />;
}
