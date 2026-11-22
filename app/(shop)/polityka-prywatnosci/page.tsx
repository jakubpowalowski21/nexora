import Link from "next/link";
import { InfoPage } from "@/src/components/layout/info-page";
export const metadata = {
  title: "Polityka prywatności",
  alternates: { canonical: "/polityka-prywatnosci" },
};
export default function Page() {
  return (
    <InfoPage title="Prywatność w demonstracji">
      <section>
        <h2>Jakie dane zapisuje aplikacja?</h2>
        <p>
          Aplikacja zapisuje dane potrzebne do obsługi konta, zamówienia, zwrotu
          lub wiadomości. Hasła są przechowywane jako skróty. Stripe obsługuje
          testowe dane kart na własnej stronie płatności.
        </p>
      </section>
      <section>
        <h2>Zapisy w przeglądarce</h2>
        <p>
          Sesja logowania wykorzystuje ciasteczko. Koszyk i ulubione gościa
          zapisujemy w pamięci przeglądarki. Dane demo panelu są przypisane do
          karty, w której je utworzono.
        </p>
      </section>
      <section>
        <h2>Wiadomości i newsletter</h2>
        <p>
          Powiadomienia transakcyjne wynikają z aktywności w aplikacji. Zapis do
          newslettera następuje po wyrażeniu osobnej zgody. W sprawie dostępu do
          danych, korekty lub usunięcia danych użyj{" "}
          <Link className="text-link" href="/kontakt">
            formularza kontaktowego
          </Link>
          .
        </p>
      </section>
    </InfoPage>
  );
}
