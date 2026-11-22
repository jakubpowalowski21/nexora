import { DemoPanel } from "@/src/components/admin/demo-panel";
export const metadata = {
  title: "Demo panelu administratora",
  robots: { index: false },
};
export default function Page() {
  return (
    <div className="wrap page-space">
      <div className="page-heading">
        <h1>Demo panelu administratora</h1>
        <p>
          Dodaj produkt, zmień cenę lub zrealizuj przykładowe zamówienie. Zmiany
          zapisują się w tej karcie przez maksymalnie 24 godziny.
        </p>
      </div>
      <DemoPanel />
    </div>
  );
}
