import Link from "next/link";
import { InfoPage } from "@/src/components/layout/info-page";
import { Button } from "@/src/components/ui/button";
import { getSettings } from "@/src/features/catalog/data";
export const metadata = { title: "O nas", alternates: { canonical: "/o-nas" } };
export default async function Page() {
  const store = await getSettings();
  return (
    <InfoPage title={`O ${store.name}`} description={store.description}>
      <section>
        <h2>Sprzęt wybrany z myślą o codzienności</h2>
        <p>
          Stawiamy na wygodę, czytelne parametry i wyposażenie, które łatwo
          dopasować do własnego biurka. W katalogu znajdziesz audio, klawiatury,
          myszy, monitory, ładowarki i akcesoria do pracy.
        </p>
      </section>
      <section>
        <h2>Projekt demonstracyjny</h2>
        <p>
          {store.name} to fikcyjna marka stworzona na potrzeby portfolio. Możesz
          przetestować zakupy od wyboru wariantu po potwierdzenie zamówienia.
          Zdjęcia mają charakter poglądowy, a produkty i płatności są
          przykładowe.
        </p>
      </section>
      <Button asChild>
        <Link href="/produkty">Przeglądaj katalog</Link>
      </Button>
    </InfoPage>
  );
}
