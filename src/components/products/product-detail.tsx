"use client";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Share2,
  Star,
  Truck,
  ZoomIn,
} from "lucide-react";
import { useRef, useState } from "react";
import { type Product } from "@/src/features/catalog/data";
import { money } from "@/src/lib/format";
import { Button } from "@/src/components/ui/button";
import {
  DialogContent,
  DialogRoot,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { AddToCart, FavoriteButton } from "./card-actions";

export function ProductDetail({
  product,
  prices,
}: {
  product: Product;
  prices: Record<string, number>;
}) {
  const [id, setId] = useState(
    product.variants.find((v) => v.stock)?.id || product.variants[0]?.id,
  );
  const [active, setActive] = useState(0),
    [qty, setQty] = useState(1),
    [shared, setShared] = useState("");
  const touch = useRef<number | null>(null);
  const variant = product.variants.find((v) => v.id === id);
  const gallery = variant?.image
    ? [
        { url: variant.image, alt: `${product.name} — ${variant.name}` },
        ...product.images.filter((i) => i.url !== variant.image),
      ]
    : product.images.length
      ? product.images
      : [{ url: "/media/audio.webp", alt: product.name }];
  const picture = gallery[active] || gallery[0];
  const turn = (step: number) =>
    setActive((active + step + gallery.length) % gallery.length);
  const price = variant ? prices[variant.id] : 0;
  const stock = Math.min(99, variant?.stock || 0);
  return (
    <div className="detail-grid">
      <div className="gallery">
        <DialogRoot>
          <DialogTrigger asChild>
            <button
              type="button"
              className="gallery-main"
              aria-label="Powiększ zdjęcie produktu"
              onTouchStart={(e) => {
                touch.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                if (touch.current === null) return;
                const delta =
                  (e.changedTouches[0]?.clientX ?? touch.current) -
                  touch.current;
                if (Math.abs(delta) > 35) {
                  e.preventDefault();
                  turn(delta < 0 ? 1 : -1);
                }
                touch.current = null;
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  turn(e.key === "ArrowLeft" ? -1 : 1);
                }
              }}
            >
              <Image
                src={picture.url}
                alt={picture.alt}
                fill
                sizes="(max-width: 740px) 100vw, 620px"
                preload
              />
              <span className="icon-button">
                <ZoomIn size={20} />
              </span>
            </button>
          </DialogTrigger>
          <DialogContent
            title={product.name}
            description="Powiększone zdjęcie produktu"
          >
            <div className="gallery-expanded">
              <Image src={picture.url} alt={picture.alt} fill sizes="500px" />
            </div>
          </DialogContent>
        </DialogRoot>
        {gallery.length > 1 && (
          <div className="thumbnails">
            <button
              type="button"
              className="icon-button"
              onClick={() => turn(-1)}
              aria-label="Poprzednie zdjęcie"
            >
              <ChevronLeft size={19} />
            </button>
            {gallery.map((pic, i) => (
              <button
                type="button"
                key={pic.url + i}
                aria-label={`Zdjęcie ${i + 1}`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
              >
                <Image src={pic.url} alt="" width={63} height={63} />
              </button>
            ))}
            <button
              type="button"
              className="icon-button"
              onClick={() => turn(1)}
              aria-label="Następne zdjęcie"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        )}
      </div>
      <div className="detail-copy">
        <p className="detail-brand">{product.brand}</p>
        <h1>{product.name}</h1>
        {!!product.reviewCount && (
          <a href="#opinie" className="rating">
            <Star size={16} fill="currentColor" />
            {product.rating.toLocaleString("pl-PL", {
              maximumFractionDigits: 1,
            })}{" "}
            <span>· {product.reviewCount} ocen</span>
          </a>
        )}
        <p className="detail-lead">{product.summary}</p>
        {variant && (
          <>
            <p className="detail-price">
              <strong>{money(price)}</strong>
              {price < variant.price && <s>{money(variant.price)}</s>}
            </p>
            <p className={`availability ${stock ? "" : "unavailable"}`}>
              {stock ? `Dostępny · ${stock} szt.` : "Niedostępny"}
            </p>
            <p className="subtle">SKU {variant.sku}</p>
            <fieldset className="variant-field">
              <legend>Wariant</legend>
              {product.variants.map((v) => (
                <label className="variant-pill" key={v.id}>
                  <input
                    type="radio"
                    name="variant"
                    checked={id === v.id}
                    onChange={() => {
                      setId(v.id);
                      setActive(0);
                      setQty(1);
                    }}
                  />
                  <span>{v.name}</span>
                </label>
              ))}
            </fieldset>
            <div className="product-buy">
              <div className="quantity" aria-label="Ilość">
                <button
                  aria-label="Zmniejsz ilość"
                  disabled={qty <= 1}
                  onClick={() => setQty(qty - 1)}
                >
                  <Minus size={16} />
                </button>
                <output>{qty}</output>
                <button
                  aria-label="Zwiększ ilość"
                  disabled={qty >= stock}
                  onClick={() => setQty(qty + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <AddToCart
                key={variant.id}
                id={variant.id}
                stock={stock}
                quantity={qty}
              />
            </div>
          </>
        )}
        <div className="product-secondary">
          <FavoriteButton id={product.id} full />
          <Button
            variant="secondary"
            size="icon"
            aria-label="Udostępnij produkt"
            onClick={async () => {
              try {
                if (navigator.share)
                  await navigator.share({
                    title: product.name,
                    url: location.href,
                  });
                else {
                  await navigator.clipboard.writeText(location.href);
                  setShared("Skopiowano link.");
                }
              } catch {
                setShared("Link do produktu znajdziesz w pasku adresu.");
              }
            }}
          >
            <Share2 size={19} />
          </Button>
        </div>
        {!!shared && (
          <p className="subtle" role="status">
            <Check size={15} /> {shared}
          </p>
        )}
        {stock > 0 && (
          <p className="dispatch">
            <Truck size={19} /> Wysyłka w 1–2 dni robocze
          </p>
        )}
      </div>
    </div>
  );
}
