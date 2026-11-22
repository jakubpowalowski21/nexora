import Link from "next/link";
import {
  Heart,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Package,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { requireCustomer } from "@/src/lib/auth";
import { logout } from "@/src/features/account/auth-actions";
import { Button } from "@/src/components/ui/button";
const links = [
  ["/konto", "Przegląd", LayoutDashboard],
  ["/konto/zamowienia", "Zamówienia", Package],
  ["/konto/ulubione", "Ulubione", Heart],
  ["/konto/adresy", "Adresy", MapPin],
  ["/konto/dane", "Moje dane", UserRound],
  ["/konto/bezpieczenstwo", "Bezpieczeństwo", LockKeyhole],
  ["/konto/zwroty", "Zwroty i reklamacje", RotateCcw],
] as const;
export const metadata = { title: "Moje konto", robots: { index: false } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCustomer();
  return (
    <div className="wrap page-space">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar panel">
          <h2>Moje konto</h2>
          <nav aria-label="Panel klienta">
            {links.map(([href, title, Icon]) => (
              <Link href={href} key={href}>
                <Icon size={18} />
                {title}
              </Link>
            ))}
            {user.role === "admin" && (
              <Link href="/admin">
                <LayoutDashboard size={18} />
                Administracja
              </Link>
            )}
          </nav>
          <form action={logout}>
            <Button type="submit" variant="secondary" size="small">
              Wyloguj się
            </Button>
          </form>
        </aside>
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
}
