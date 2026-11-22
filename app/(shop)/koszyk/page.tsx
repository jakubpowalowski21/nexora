import { Breadcrumbs } from "@/src/components/ui/breadcrumbs";
import { Cart } from "@/src/components/cart/cart";
export const metadata = { title: "Koszyk", robots: { index: false } };
export default function Page() {
  return (
    <div className="wrap page-space">
      <Breadcrumbs items={[{ name: "Koszyk" }]} />
      <div className="page-heading">
        <h1>Twój koszyk</h1>
      </div>
      <Cart />
    </div>
  );
}
