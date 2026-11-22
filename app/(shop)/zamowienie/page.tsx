import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/src/db";
import { addresses } from "@/src/db/schema";
import { viewer } from "@/src/lib/auth";
import { getSettings } from "@/src/features/catalog/data";
import { Breadcrumbs } from "@/src/components/ui/breadcrumbs";
import { Checkout } from "@/src/components/cart/checkout";
import type { CheckoutFields } from "@/src/lib/validation";
export const metadata = { title: "Zamówienie", robots: { index: false } };
export default async function Page() {
  const [user, store] = await Promise.all([viewer(), getSettings()]);
  const saved = user
    ? (
        await db()
          .select()
          .from(addresses)
          .where(eq(addresses.userId, user.id))
          .orderBy(desc(addresses.isDefault))
          .limit(1)
      )[0]
    : undefined;
  const initial: Partial<CheckoutFields> = user
    ? {
        name: user.name,
        phone: user.phone || "",
        ...saved?.data,
        email: user.email,
      }
    : {};
  const stripeEnabled =
    /^(?:sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || "") &&
    !!process.env.STRIPE_WEBHOOK_SECRET;
  return (
    <div className="wrap page-space">
      <Breadcrumbs
        items={[{ name: "Koszyk", href: "/koszyk" }, { name: "Zamówienie" }]}
      />
      <div className="page-heading">
        <h1>Zamówienie</h1>
        {!user && (
          <p>
            Możesz kupić jako gość lub{" "}
            <Link className="text-link" href="/logowanie?powrot=/zamowienie">
              zalogować się
            </Link>
            .
          </p>
        )}
      </div>
      <Checkout
        initial={initial}
        stripeEnabled={stripeEnabled}
        methods={store.shippingOptions}
        accountEmail={!!user}
      />
    </div>
  );
}
