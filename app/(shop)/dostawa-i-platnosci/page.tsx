import { InfoPage } from "@/src/components/layout/info-page";
import { getSettings } from "@/src/features/catalog/data";
import { money, shipping } from "@/src/lib/format";
export const metadata = {
  title: "Dostawa i płatności",
  alternates: { canonical: "/dostawa-i-platnosci" },
};
export default async function Page() {
  const store = await getSettings();
  return (
    <InfoPage
      title="Dostawa i płatności"
      description="Metody i ceny używane w demonstracyjnym checkoutcie."
    >
      <section>
        <h2>Dostawa w Polsce</h2>
        <p>
          Standardowa dostawa jest bezpłatna od {money(store.freeShipping)} po
          uwzględnieniu rabatów.
        </p>
        <dl className="specs">
          {shipping.flatMap((m) => {
            const option = store.shippingOptions.find((row) => row.id === m.id);
            return option
              ? [
                  <div key={m.id}>
                    <dt>{m.name}</dt>
                    <dd>
                      {money(option.price)} · {m.time}
                    </dd>
                  </div>,
                ]
              : [];
          })}
        </dl>
      </section>
      <section>
        <h2>Metody płatności</h2>
        <p>
          Checkout obsługuje Stripe w trybie testowym i symulowany przelew
          tradycyjny. Używaj wyłącznie danych testowych oraz przykładowych
          adresów. Zamówienia i przesyłki w NEXORA są symulowane.
        </p>
      </section>
    </InfoPage>
  );
}
