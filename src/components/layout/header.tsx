import Link from "next/link";
import { ChevronDown, Truck } from "lucide-react";
import { money } from "@/src/lib/format";
import { getCategories, getSettings } from "@/src/features/catalog/data";
import { Brand } from "./brand";
import { HeaderTools, SearchDialog } from "./header-tools";
export async function Header() {
  const [categories, store] = await Promise.all([
    getCategories(),
    getSettings(),
  ]);
  const navigation = categories.map(({ slug, name }) => ({ slug, name }));
  return (
    <header className="site-header">
      <div className="announcement">
        <Truck size={15} strokeWidth={1.7} />
        Darmowa dostawa od {money(store.freeShipping).replace(",00", "")}
      </div>
      <div className="header-main">
        <div className="wrap header-inner">
          <Brand name={store.name} />
          <nav className="header-nav" aria-label="Menu główne">
            <Link href="/produkty">Produkty</Link>
            <details className="category-menu">
              <summary>
                Kategorie <ChevronDown size={14} />
              </summary>
              <div>
                {navigation.map((c) => (
                  <Link href={`/kategorie/${c.slug}`} key={c.slug}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </details>
            <Link href="/promocje">Promocje</Link>
            <Link href="/nowosci">Nowości</Link>
          </nav>
          <div className="header-actions">
            <SearchDialog />
            <HeaderTools categories={navigation} />
          </div>
        </div>
      </div>
    </header>
  );
}
