import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { currentPrice, type Product } from "@/src/features/catalog/data";
import { money } from "@/src/lib/format";
import { AddToCart, FavoriteButton } from "./card-actions";
export function ProductCard({
  product,
  isNew = false,
}: {
  product: Product;
  isNew?: boolean;
}) {
  const primary = [...product.variants].sort(
    (a, b) =>
      Number(b.stock > 0) - Number(a.stock > 0) ||
      currentPrice(a) - currentPrice(b),
  )[0];
  if (!primary) return null;
  const price = currentPrice(primary),
    cover = product.images[0];
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/produkt/${product.slug}`} aria-label={product.name}>
          <Image
            src={cover?.url || primary.image || "/media/audio.webp"}
            alt={cover?.alt || product.name}
            fill
            sizes="(max-width: 600px) 48vw, (max-width: 1050px) 30vw, 300px"
          />
        </Link>
        {price < primary.price ? (
          <span className="product-tag">
            −{Math.round((1 - price / primary.price) * 100)}%
          </span>
        ) : (
          isNew && <span className="product-tag new-tag">Nowość</span>
        )}
        <FavoriteButton id={product.id} />
      </div>
      <div className="product-content">
        <div className="product-meta">
          <span>{product.brand}</span>
          {product.reviewCount > 0 && (
            <span className="rating">
              <Star size={13} fill="currentColor" />
              {product.rating.toLocaleString("pl-PL", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              <span>({product.reviewCount})</span>
            </span>
          )}
        </div>
        <h3>
          <Link href={`/produkt/${product.slug}`}>{product.name}</Link>
        </h3>
        <span className={`availability ${primary.stock ? "" : "unavailable"}`}>
          {primary.stock ? "Dostępny" : "Niedostępny"}
        </span>
        <div className="product-price">
          <div>
            <strong>{money(price)}</strong>
            {price < primary.price && <s>{money(primary.price)}</s>}
          </div>
          <AddToCart id={primary.id} stock={primary.stock} compact />
        </div>
      </div>
    </article>
  );
}
export function ProductGrid({
  products,
  isNew = false,
  carousel = false,
}: {
  products: Product[];
  isNew?: boolean;
  carousel?: boolean;
}) {
  return (
    <div className={`product-grid${carousel ? " carousel" : ""}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} isNew={isNew} />
      ))}
    </div>
  );
}
