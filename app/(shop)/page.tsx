import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Headphones,
  Headset,
  Keyboard,
  Mail,
  Monitor,
  Mouse,
  MoveUpRight,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  Zap,
  Laptop,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ActionForm } from "@/src/components/ui/forms";
import { ProductGrid } from "@/src/components/products/card";
import {
  catalog,
  getCategories,
  getReviews,
  getSettings,
  parseFilters,
} from "@/src/features/catalog/data";
import { subscribe } from "@/src/features/catalog/home-actions";
import { money } from "@/src/lib/format";

const icons = {
  audio: Headphones,
  klawiatury: Keyboard,
  myszy: Mouse,
  monitory: Monitor,
  stanowisko: Laptop,
  ladowanie: Zap,
};
const benefits = [
  ["Darmowa dostawa", "Od {threshold} na standardową dostawę", Truck],
  ["Bezpieczne płatności", "Testowy checkout Stripe", ShieldCheck],
  ["14 dni na zwrot", "Czas na spokojną decyzję", RotateCcw],
  ["Pomoc w wyborze", "Porozmawiaj z nami o sprzęcie", Headset],
] as const;
export async function generateMetadata() {
  const store = await getSettings();
  return {
    title: { absolute: `${store.name} — Premium Tech Store` },
    description: store.seo || store.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: store.name,
      description: store.seo || store.description,
      images: ["/media/studio-hero.webp"],
    },
  };
}
export default async function Home() {
  const [categories, best, recent, reviews, store] = await Promise.all([
    getCategories(),
    catalog(parseFilters({}, { size: 4 })),
    catalog(parseFilters({}, { size: 4, sort: "najnowsze" })),
    getReviews(),
    getSettings(),
  ]);
  return (
    <>
      <section className="hero wrap" aria-labelledby="hero-title">
        <Image
          src="/media/studio-hero.webp"
          alt="Czarne słuchawki Studio Pro Wireless w świetle indygo"
          fill
          preload
          quality={85}
          sizes="(max-width: 1328px) 100vw, 1280px"
          className="hero-image"
        />
        <div className="hero-copy">
          <p className="hero-label">
            <span /> PREMIUM TECH STORE
          </p>
          <h1 id="hero-title">
            {store.heroTitle === "Technologia, która robi różnicę." ? (
              <>
                Technologia,
                <br />
                która robi <em>różnicę.</em>
              </>
            ) : (
              store.heroTitle
            )}
          </h1>
          <p className="hero-description">{store.heroText}</p>
          <div className="hero-buttons">
            <Button asChild>
              <Link href="/produkty">
                Odkryj produkty <ArrowRight size={17} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/nowosci">Sprawdź nowości</Link>
            </Button>
          </div>
        </div>
        <Link className="hero-product" href="/produkt/studio-pro-wireless">
          <AudioLines size={18} />
          <span>
            <strong>Studio Pro Wireless</strong>
            <small>Kolekcja audio</small>
          </span>
          <MoveUpRight size={15} />
        </Link>
      </section>
      <section className="benefits wrap" aria-label="Zalety zakupów">
        {benefits.map(([title, description, Icon]) => (
          <div className="benefit" key={title}>
            <span className="benefit-icon">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>
                {description.replace(
                  "{threshold}",
                  money(store.freeShipping).replace(",00", ""),
                )}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section
        className="wrap home-section category-section"
        aria-labelledby="category-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="category-title">Przeglądaj według kategorii</h2>
            <p>Znajdź sprzęt, który pasuje do Twojego stylu.</p>
          </div>
          <Link className="text-link" href="/produkty">
            Wszystkie produkty <ArrowRight size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((c) => {
            const Icon = icons[c.id as keyof typeof icons] || Zap;
            return (
              <Link
                href={`/kategorie/${c.slug}`}
                key={c.id}
                className="category-card"
              >
                <div className="category-photo">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 200px"
                  />
                </div>
                <div>
                  <Icon size={18} />
                  <h3>{c.name}</h3>
                  <MoveUpRight className="category-arrow" size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {!!best.products.length && (
        <section className="wrap home-section" aria-labelledby="best-title">
          <div className="section-heading">
            <div>
              <h2 id="best-title">Bestsellery</h2>
              <p>Najchętniej wybierany sprzęt, od audio po monitory.</p>
            </div>
            <Link className="text-link" href="/produkty?sortowanie=popularnosc">
              Zobacz wszystkie <ArrowRight size={17} />
            </Link>
          </div>
          <ProductGrid products={best.products} carousel />
        </section>
      )}
      <section className="wrap campaign">
        <div>
          <span className="hero-label">
            <AudioLines size={17} /> KOLEKCJA AUDIO
          </span>
          <h2>
            Odkryj nowy
            <br />
            wymiar dźwięku.
          </h2>
          <p>Skup się na tym, czego chcesz słuchać.</p>
          <Button asChild variant="secondary">
            <Link href="/kategorie/audio">
              Zobacz kolekcję <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
        <Image
          src="/media/studio-hero.webp"
          alt="Słuchawki z kolekcji NEXORA Audio"
          fill
          sizes="(max-width: 1328px) 100vw, 1280px"
        />
      </section>
      {!!recent.products.length && (
        <section className="wrap home-section" aria-labelledby="new-title">
          <div className="section-heading">
            <div>
              <h2 id="new-title">Nowości</h2>
              <p>Ostatnio dodane do oferty NEXORA.</p>
            </div>
            <Link className="text-link" href="/nowosci">
              Zobacz nowości <ArrowRight size={17} />
            </Link>
          </div>
          <ProductGrid products={recent.products} isNew carousel />
        </section>
      )}
      <section className="wrap why">
        <div className="why-icon">
          <Zap size={26} />
        </div>
        <div>
          <h2>Dlaczego NEXORA?</h2>
          <p>
            Wybieramy sprzęt, który wygodnie sprawdza się na co dzień. W
            katalogu możesz porównać parametry, a przed zakupem zapytać nas o
            swój wybór.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/o-nas">Poznaj markę</Link>
        </Button>
      </section>
      {!!reviews.length && (
        <section className="wrap home-section">
          <div className="section-heading">
            <div>
              <h2>Opinie o produktach</h2>
              <p>Przykładowe recenzje pokazują, jak działa sekcja opinii.</p>
            </div>
          </div>
          <div className="reviews-grid">
            {reviews.map((r) => (
              <article key={r.id}>
                <p
                  className="rating stars"
                  aria-label={`Ocena ${r.rating} na 5`}
                >
                  {Array.from({ length: r.rating }, (_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </p>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <small>
                  {r.author} ·{" "}
                  {r.sample ? "Opinia przykładowa" : "Potwierdzony zakup"}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      {store.newsletterEnabled && (
        <section className="newsletter">
          <div className="wrap newsletter-inner">
            <div>
              <span className="benefit-icon">
                <Mail size={23} />
              </span>
              <h2>Nowości prosto na Twój adres</h2>
              <p>
                Zapisz się, aby otrzymywać informacje o premierach i promocjach.
              </p>
            </div>
            <ActionForm
              action={subscribe}
              submit="Zapisz się"
              className="form-stack newsletter-form"
            >
              <label className="sr-only" htmlFor="newsletter">
                Adres e-mail
              </label>
              <input
                id="newsletter"
                type="email"
                name="email"
                placeholder="Twój adres e-mail"
                required
              />
              <label className="checkbox">
                <input type="checkbox" name="consent" required />
                <span>
                  Chcę otrzymywać newsletter NEXORA.{" "}
                  <Link href="/polityka-prywatnosci">Polityka prywatności</Link>
                </span>
              </label>
            </ActionForm>
          </div>
        </section>
      )}
    </>
  );
}
