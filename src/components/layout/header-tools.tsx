"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { useCommerce, useCartQuote } from "@/src/features/cart/client";
import { money } from "@/src/lib/format";

type Suggestion = { name: string; slug: string; price: number; image: string };
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Suggestion[]>([]),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/szukaj?q=${encodeURIComponent(query)}`, {
          signal: abort.signal,
        });
        if (!res.ok) throw new Error();
        const list = (await res.json()) as Suggestion[];
        setResults(list);
        setStatus(list.length ? "" : "Brak pasujących produktów.");
      } catch {
        if (!abort.signal.aborted)
          setStatus("Wyszukiwanie jest chwilowo niedostępne.");
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, open]);
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="header-search"
          aria-label="Szukaj produktów"
        >
          <Search size={19} />
          <span>Szukaj produktów</span>
        </button>
      </DialogTrigger>
      <DialogContent
        title="Szukaj w NEXORA"
        description="Wpisz nazwę, kategorię lub markę produktu."
      >
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!query.trim()) return;
            setOpen(false);
            router.push(`/produkty?szukaj=${encodeURIComponent(query.trim())}`);
          }}
        >
          <input
            aria-label="Nazwa, marka lub kategoria"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResults([]);
              setStatus(e.target.value.trim().length >= 2 ? "Szukam…" : "");
            }}
            placeholder="Np. słuchawki, klawiatura…"
            maxLength={120}
            autoComplete="off"
          />
          <Button type="submit" size="icon" aria-label="Pokaż wyniki">
            <Search size={19} />
          </Button>
        </form>
        <p aria-live="polite" className="subtle">
          {status}
        </p>
        <div className="suggestions">
          {results.map((p) => (
            <DialogClose asChild key={p.slug}>
              <Link href={`/produkt/${p.slug}`}>
                <Image src={p.image} alt="" width={48} height={48} />
                <strong>{p.name}</strong>
                <span>{money(p.price)}</span>
              </Link>
            </DialogClose>
          ))}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
export function HeaderTools({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const c = useCommerce(),
    { quote, error } = useCartQuote(c.cartOpen);
  const count = c.items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <>
      <Link
        href="/konto"
        className="icon-button desktop-tool"
        aria-label="Moje konto"
      >
        <UserRound size={21} />
      </Link>
      <Link
        href="/ulubione"
        className="icon-button desktop-tool"
        aria-label="Ulubione produkty"
      >
        <Heart size={21} />
      </Link>
      <DialogRoot open={c.cartOpen} onOpenChange={c.setCartOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="icon-button cart-icon"
            aria-label={`Koszyk, liczba produktów: ${count}`}
          >
            <ShoppingBag size={21} />
            <span>{count}</span>
          </button>
        </DialogTrigger>
        <DialogContent
          title="Twój koszyk"
          description="Produkty w koszyku oraz podsumowanie zamówienia."
          sheet
        >
          <div className="sheet-body">
            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}
            {!count ? (
              <div className="sheet-empty">
                <ShoppingBag size={32} />
                <p>Twój koszyk jest pusty.</p>
                <DialogClose asChild>
                  <Button asChild>
                    <Link href="/produkty">Odkryj produkty</Link>
                  </Button>
                </DialogClose>
              </div>
            ) : !quote && !error ? (
              <p aria-live="polite">Przeliczam koszyk…</p>
            ) : (
              <div className="suggestions">
                {quote?.items.map((i) => (
                  <DialogClose asChild key={i.id}>
                    <Link href={`/produkt/${i.slug}`}>
                      <Image src={i.image} alt="" width={54} height={54} />
                      <span>
                        <strong>{i.name}</strong>
                        <br />
                        <small>
                          {i.variant} · {i.quantity} szt.
                        </small>
                      </span>
                      <strong>{money(i.price * i.quantity)}</strong>
                    </Link>
                  </DialogClose>
                ))}
              </div>
            )}
          </div>
          {!!count && (
            <div className="sheet-footer">
              <div className="price-row">
                <span>Wartość produktów</span>
                <strong>{quote ? money(quote.subtotal) : "—"}</strong>
              </div>
              <DialogClose asChild>
                <Button asChild>
                  <Link href="/zamowienie">Przejdź do zamówienia</Link>
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button asChild variant="secondary">
                  <Link href="/koszyk">Zobacz pełny koszyk</Link>
                </Button>
              </DialogClose>
            </div>
          )}
        </DialogContent>
      </DialogRoot>
      <DialogRoot>
        <DialogTrigger asChild>
          <button
            type="button"
            className="icon-button mobile-tool"
            aria-label="Otwórz menu"
          >
            <Menu size={24} />
          </button>
        </DialogTrigger>
        <DialogContent title="Menu NEXORA" description="Nawigacja sklepu" sheet>
          <nav className="mobile-menu">
            {[
              ["/produkty", "Wszystkie produkty"],
              ["/nowosci", "Nowości"],
              ["/promocje", "Promocje"],
              ...categories.map((x) => [`/kategorie/${x.slug}`, x.name]),
              ["/konto", "Moje konto"],
              ["/ulubione", "Ulubione"],
            ].map(([href, label]) => (
              <DialogClose asChild key={href}>
                <Link href={href}>{label}</Link>
              </DialogClose>
            ))}
          </nav>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
