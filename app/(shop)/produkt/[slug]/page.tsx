import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { Breadcrumbs } from "@/src/components/ui/breadcrumbs";
import { ProductDetail } from "@/src/components/products/product-detail";
import { ProductGrid } from "@/src/components/products/card";
import {
  catalog,
  currentPrice,
  getCategories,
  getProduct,
  getReviews,
  parseFilters,
} from "@/src/features/catalog/data";
import { siteUrl } from "@/src/lib/format";
import { ActionForm } from "@/src/components/ui/forms";
import { reviewProduct, canReview } from "@/src/features/account/actions";
import { viewer } from "@/src/lib/auth";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  return {
    title: p.metaTitle || p.name,
    description: p.metaDescription || p.summary,
    alternates: { canonical: `/produkt/${p.slug}` },
    openGraph: {
      title: p.metaTitle || p.name,
      description: p.metaDescription || p.summary,
      images: [p.ogImage || p.images[0]?.url || "/media/audio.webp"],
    },
  };
}
export default async function Page({ params }: Props) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const [categories, reviews, user] = await Promise.all([
    getCategories(),
    getReviews(p.id),
    viewer(),
  ]);
  const c = categories.find((c) => c.id === p.categoryId);
  const [related, reviewAllowed] = await Promise.all([
    catalog(parseFilters({}, { category: c?.slug, size: 5 })),
    user ? canReview(user.id, p.id) : Promise.resolve(false),
  ]);
  const url = `${siteUrl()}/produkt/${p.slug}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.summary,
    image: p.images.map((i) => new URL(i.url, siteUrl()).href),
    brand: { "@type": "Brand", name: p.brand },
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      url,
      sku: v.sku,
      price: (currentPrice(v) / 100).toFixed(2),
      priceCurrency: "PLN",
      availability: `https://schema.org/${v.stock ? "InStock" : "OutOfStock"}`,
    })),
  };
  const crumbs = [
    { name: "Strona główna", url: siteUrl() },
    ...(c ? [{ name: c.name, url: `${siteUrl()}/kategorie/${c.slug}` }] : []),
    { name: p.name, url },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <div className="wrap page-space">
      {[structured, breadcrumbSchema].map((data) => (
        <script
          key={data["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data).replace(/</g, "\\u003c"),
          }}
        />
      ))}
      <Breadcrumbs
        items={[
          ...(c ? [{ name: c.name, href: `/kategorie/${c.slug}` }] : []),
          { name: p.name },
        ]}
      />
      <ProductDetail
        product={p}
        prices={Object.fromEntries(
          p.variants.map((v) => [v.id, currentPrice(v)]),
        )}
      />
      <div className="detail-sections">
        <section className="panel">
          <h2>O produkcie</h2>
          <p>{p.description}</p>
          <h3>W opakowaniu</h3>
          <p>{p.box}</p>
        </section>
        <section className="panel">
          <h2>Specyfikacja techniczna</h2>
          <dl className="specs">
            {Object.entries(p.specifications).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h2>Dostawa i zwroty</h2>
          <p>
            Sprawdź{" "}
            <Link className="text-link" href="/dostawa-i-platnosci">
              koszty dostawy
            </Link>{" "}
            oraz{" "}
            <Link className="text-link" href="/zwroty-i-reklamacje">
              zasady zgłoszeń
            </Link>
            .
          </p>
        </section>
        <section className="panel" id="opinie">
          <h2>Opinie</h2>
          {reviews.length ? (
            <div className="review-list">
              {reviews.map((r) => (
                <article key={r.id}>
                  <span className="rating">
                    <Star size={16} fill="currentColor" />
                    {r.rating}/5
                  </span>
                  <h3>{r.title}</h3>
                  <p>{r.body}</p>
                  <small>
                    {r.author} ·{" "}
                    {r.sample ? "Opinia przykładowa" : "Potwierdzony zakup"}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p>Brak opublikowanych opinii.</p>
          )}
          {reviewAllowed && (
            <ActionForm action={reviewProduct} submit="Wyślij opinię">
              <input type="hidden" name="productId" value={p.id} />
              <label>
                Ocena
                <select name="rating" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Tytuł
                <input name="title" required maxLength={100} />
              </label>
              <label>
                Opinia
                <textarea
                  name="body"
                  required
                  minLength={10}
                  maxLength={2500}
                />
              </label>
            </ActionForm>
          )}
        </section>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <h2>Podobne produkty</h2>
        </div>
        <ProductGrid
          products={related.products
            .filter((other) => other.id !== p.id)
            .slice(0, 4)}
          carousel
        />
      </section>
    </div>
  );
}
