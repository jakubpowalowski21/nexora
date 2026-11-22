import { notFound, permanentRedirect } from "next/navigation";
import { CatalogPage } from "@/src/components/products/catalog";
import {
  getCategory,
  getCategoryRedirect,
  type Search,
} from "@/src/features/catalog/data";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params,
    category = await getCategory(slug);
  return category
    ? {
        title: category.name,
        description: category.description,
        alternates: { canonical: `/kategorie/${slug}` },
        robots: Object.keys(await searchParams).length
          ? { index: false, follow: true }
          : undefined,
      }
    : {};
}
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params,
    category = await getCategory(slug);
  if (!category) {
    const target = await getCategoryRedirect(slug);
    if (target) permanentRedirect(`/kategorie/${target}`);
    notFound();
  }
  return (
    <CatalogPage
      query={await searchParams}
      category={category}
      base={`/kategorie/${slug}`}
    />
  );
}
