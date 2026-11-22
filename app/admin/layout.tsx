import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth";
import { logout } from "@/src/features/account/auth-actions";
import { Brand } from "@/src/components/layout/brand";
import { Button } from "@/src/components/ui/button";
const links = [
  ["", "Przegląd"],
  ["produkty", "Produkty"],
  ["kategorie", "Kategorie"],
  ["zamowienia", "Zamówienia"],
  ["klienci", "Klienci"],
  ["magazyn", "Magazyn"],
  ["promocje", "Promocje"],
  ["opinie", "Opinie"],
  ["wiadomosci", "Wiadomości i zwroty"],
  ["statystyki", "Statystyki"],
  ["ustawienia", "Ustawienia"],
];
export const metadata = {
  title: "Administracja",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div className="admin-bg">
      <header className="admin-top">
        <div className="wrap">
          <div>
            <Brand footer />
            <span>Administracja</span>
          </div>
          <Link href="/konto" className="button button-outline button-sm">
            Moje konto
          </Link>
        </div>
      </header>
      <main id="main" className="wrap page-space">
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar panel">
            <h2>Panel sklepu</h2>
            <nav aria-label="Panel administratora">
              {links.map(([slug, label]) => (
                <Link key={slug} href={slug ? `/admin/${slug}` : "/admin"}>
                  {label}
                </Link>
              ))}
            </nav>
            <p className="subtle">{admin.name}</p>
            <form action={logout}>
              <Button type="submit" variant="secondary" size="small">
                Wyloguj się
              </Button>
            </form>
          </aside>
          <div className="dashboard-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
