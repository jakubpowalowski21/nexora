"use client";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useCommerce } from "@/src/features/cart/client";
import { money } from "@/src/lib/format";
import {
  AddToCart,
  FavoriteButton,
} from "@/src/components/products/card-actions";
import { Button } from "@/src/components/ui/button";
type Favorite = {
  id: string;
  name: string;
  slug: string;
  image: string;
  variant?: string;
  stock: number;
  price: number;
};
export function GuestFavorites() {
  const { favorites, ready, favorite } = useCommerce();
  const key = JSON.stringify({ ids: favorites });
  const [result, setResult] = useState<{
    key: string;
    rows?: Favorite[];
    error?: boolean;
  }>();
  useEffect(() => {
    if (!ready || !favorites.length) return;
    const abort = new AbortController();
    fetch("/api/ulubione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
      signal: abort.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw Error();
        setResult({ key, rows: await res.json() });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, error: true });
      });
    return () => abort.abort();
  }, [key, ready, favorites.length]);
  if (!ready) return <p>Ładuję ulubione…</p>;
  if (!favorites.length)
    return (
      <div className="empty">
        <Heart size={36} />
        <h2>Ulubione jest puste</h2>
        <Button asChild>
          <Link href="/produkty">Odkryj produkty</Link>
        </Button>
      </div>
    );
  if (result?.key !== key || !result.rows)
    return (
      <p role="status">
        {result?.error ? "Nie udało się pobrać produktów." : "Ładuję produkty…"}
      </p>
    );
  return (
    <div className="product-grid">
      {result.rows.map((p) => (
        <article className="product-card" key={p.id}>
          <div className="product-image">
            <Link href={`/produkt/${p.slug}`}>
              <Image src={p.image} alt={p.name} fill sizes="300px" />
            </Link>
            <FavoriteButton id={p.id} />
          </div>
          <div className="product-content">
            <h3>
              <Link href={`/produkt/${p.slug}`}>{p.name}</Link>
            </h3>
            <span className={`availability ${p.stock ? "" : "unavailable"}`}>
              {p.stock ? "Dostępny" : "Niedostępny"}
            </span>
            <div className="product-price">
              <strong>{money(p.price)}</strong>
              {p.variant && (
                <AddToCart id={p.variant} stock={p.stock} compact />
              )}
            </div>
          </div>
        </article>
      ))}
      {favorites
        .filter((id) => !result.rows?.some((p) => p.id === id))
        .map((id) => (
          <div key={id} className="panel">
            <p>Produkt wycofany</p>
            <Button variant="secondary" onClick={() => favorite(id, false)}>
              Usuń
            </Button>
          </div>
        ))}
    </div>
  );
}
