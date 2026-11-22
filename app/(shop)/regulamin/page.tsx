import Link from "next/link";
import { InfoPage } from "@/src/components/layout/info-page";
export const metadata = {
  title: "Regulamin",
  alternates: { canonical: "/regulamin" },
};
export default function Page() {
  return (
    <InfoPage title="Regulamin demonstracji">
      <section>
        <h2>Zakres projektu</h2>
        <p>
          NEXORA to projekt edukacyjny i portfolio. Oferta, ceny i dostawy służą
          do demonstracji oprogramowania. Złożenie zamówienia w tym środowisku
          uruchamia symulację procesu zakupu.
        </p>
      </section>
      <section>
        <h2>Konto i zamówienia</h2>
        <p>
          Przy aktywnej wysyłce poczty konto wymaga potwierdzenia adresu e-mail.
          Przy zakupie można pozostać gościem. W formularzach adresowych podawaj
          dane testowe. Do płatności Stripe używaj kart testowych. Symulowany
          przelew nie wymaga wpłaty.
        </p>
      </section>
      <section>
        <h2>Kontakt i zgłoszenia</h2>
        <p>
          Formularze{" "}
          <Link className="text-link" href="/kontakt">
            kontaktu
          </Link>{" "}
          oraz{" "}
          <Link className="text-link" href="/zwroty-i-reklamacje">
            zwrotów i reklamacji
          </Link>{" "}
          zapisują zgłoszenia w systemie demonstracyjnym.
        </p>
      </section>
    </InfoPage>
  );
}
