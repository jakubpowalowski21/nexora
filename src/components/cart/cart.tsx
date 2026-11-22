"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useCommerce, useCartQuote } from "@/src/features/cart/client";
import type { Quote } from "@/src/features/orders/quote";
import { money } from "@/src/lib/format";

export function EmptyCart() {
  return (
    <div className="empty">
      <ShoppingBag size={39} />
      <h2>Twój koszyk jest pusty</h2>
      <p>Wróć do katalogu i znajdź sprzęt dla siebie.</p>
      <Button asChild>
        <Link href="/produkty">Przeglądaj produkty</Link>
      </Button>
    </div>
  );
}
export function Totals({
  quote,
  children,
}: {
  quote: Quote;
  children?: React.ReactNode;
}) {
  return (
    <aside className="panel totals">
      <h2>Podsumowanie</h2>
      <div className="price-row">
        <span>Produkty</span>
        <strong>{money(quote.subtotal)}</strong>
      </div>
      {!!quote.discount && (
        <div className="price-row">
          <span>Rabat</span>
          <strong>−{money(quote.discount)}</strong>
        </div>
      )}
      <div className="price-row">
        <span>Dostawa</span>
        <strong>{quote.delivery ? money(quote.delivery) : "Bezpłatna"}</strong>
      </div>
      <div className="price-row total">
        <span>Razem</span>
        <strong>{money(quote.total)}</strong>
      </div>
      {children}
    </aside>
  );
}
export function Cart() {
  const commerce = useCommerce();
  const [typed, setTyped] = useState(""),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  const [noted, setNoted] = useState(new Set<string>());
  const { quote, error } = useCartQuote(true, "pickup", code);
  useEffect(() => {
    const saved = sessionStorage.getItem("nexora-coupon") || "";
    if (saved)
      queueMicrotask(() => {
        setTyped(saved);
        setCode(saved);
      });
  }, []);
  useEffect(() => {
    if (!quote) return;
    try {
      const prior = JSON.parse(
        sessionStorage.getItem("nexora-price-history") || "{}",
      ) as Record<string, number>;
      const changes = quote.items
        .filter((i) => prior[i.id] !== undefined && prior[i.id] !== i.price)
        .map((i) => i.id);
      if (changes.length)
        queueMicrotask(() => setNoted((old) => new Set([...old, ...changes])));
      sessionStorage.setItem(
        "nexora-price-history",
        JSON.stringify(
          Object.fromEntries(quote.items.map((i) => [i.id, i.price])),
        ),
      );
    } catch {
      /* Prices always come from the server quote. */
    }
  }, [quote]);
  const update = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy("");
    }
  };
  if (!commerce.ready)
    return (
      <p className="panel" aria-live="polite">
        Otwieram koszyk…
      </p>
    );
  if (!commerce.items.length) return <EmptyCart />;
  if (!quote)
    return (
      <p className={error ? "alert alert-error" : "panel"} role="status">
        {error || "Przeliczam koszyk…"}
      </p>
    );
  return (
    <div className="basket-layout">
      <section>
        <p className="basket-postage">
          <Truck size={20} />
          {quote.remaining
            ? `Do darmowej standardowej dostawy brakuje ${money(quote.remaining)}.`
            : "Standardowa dostawa jest bezpłatna."}
        </p>
        {message && (
          <p className="alert alert-error" role="alert">
            {message}
          </p>
        )}
        {quote.issues.map((issue, i) => (
          <p className="alert alert-error" key={i}>
            {issue}
          </p>
        ))}
        <div className="basket-lines">
          {quote.items
            .slice()
            .reverse()
            .map((i) => (
              <article key={i.id} className="basket-item">
                <Link href={`/produkt/${i.slug}`}>
                  <Image src={i.image} alt={i.name} width={92} height={92} />
                </Link>
                <div>
                  <h3>
                    <Link href={`/produkt/${i.slug}`}>{i.name}</Link>
                  </h3>
                  <p className="subtle">
                    {i.variant} · {money(i.price)} / szt.
                  </p>
                  {noted.has(i.id) && (
                    <p className="small-error">Cena uległa zmianie.</p>
                  )}
                  <div className="basket-controls">
                    <div className="quantity">
                      <button
                        aria-label="Zmniejsz ilość"
                        disabled={i.quantity <= 1 || busy === i.id}
                        onClick={() =>
                          update(i.id, () =>
                            commerce.change(
                              i.id,
                              i.quantity - 1,
                              "set",
                              i.stock,
                            ),
                          )
                        }
                      >
                        <Minus size={15} />
                      </button>
                      <output>{i.quantity}</output>
                      <button
                        aria-label="Zwiększ ilość"
                        disabled={
                          i.quantity >= Math.min(i.stock, 99) || busy === i.id
                        }
                        onClick={() =>
                          update(i.id, () =>
                            commerce.change(
                              i.id,
                              i.quantity + 1,
                              "set",
                              i.stock,
                            ),
                          )
                        }
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Przenieś do ulubionych"
                      disabled={busy === i.id}
                      onClick={() =>
                        update(i.id, async () => {
                          await commerce.favorite(i.productId, true);
                          await commerce.change(i.id, 0, "set", 0);
                        })
                      }
                    >
                      <Heart size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Usuń z koszyka"
                      disabled={busy === i.id}
                      onClick={() =>
                        update(i.id, () => commerce.change(i.id, 0, "set", 0))
                      }
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>
                </div>
                <strong>{money(i.price * i.quantity)}</strong>
              </article>
            ))}
          {quote.missing.map((id) => (
            <div className="panel price-row" key={id}>
              <span>Produkt wycofany</span>
              <Button
                size="small"
                variant="secondary"
                onClick={() =>
                  update(id, () => commerce.change(id, 0, "set", 0))
                }
              >
                Usuń
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Totals quote={quote}>
        <form
          className="form-stack coupon"
          onSubmit={(e) => {
            e.preventDefault();
            const value = typed.trim().toUpperCase();
            setCode(value);
            sessionStorage.setItem("nexora-coupon", value);
          }}
        >
          <label>
            Kod rabatowy
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Kod rabatowy"
              maxLength={40}
            />
          </label>
          <Button type="submit" variant="secondary">
            Zastosuj
          </Button>
        </form>
        {quote.couponError && (
          <p className="small-error" role="alert">
            {quote.couponError}
          </p>
        )}
        {quote.issues.length ? (
          <Button disabled>Przejdź do zamówienia</Button>
        ) : (
          <Button asChild>
            <Link href="/zamowienie">
              Przejdź do zamówienia <ArrowRight size={18} />
            </Link>
          </Button>
        )}
        <Link className="text-link" href="/produkty">
          Kontynuuj zakupy
        </Link>
      </Totals>
    </div>
  );
}
