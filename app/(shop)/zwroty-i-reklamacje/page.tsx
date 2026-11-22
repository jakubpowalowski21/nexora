import Link from "next/link";
import { InfoPage } from "@/src/components/layout/info-page";
import { ActionForm } from "@/src/components/ui/forms";
import { createReturn } from "@/src/features/account/actions";
import { viewer } from "@/src/lib/auth";
export const metadata = {
  title: "Zwroty i reklamacje",
  alternates: { canonical: "/zwroty-i-reklamacje" },
};
export default async function Page() {
  const user = await viewer();
  return (
    <InfoPage
      title="Zwroty i reklamacje"
      description="Sprawdź, jak złożyć zgłoszenie dotyczące zamówienia demonstracyjnego."
    >
      <section>
        <h2>Kiedy skorzystać z formularza?</h2>
        <p>
          W demonstracji możesz zgłosić chęć zwrotu albo reklamację. Przy
          rzeczywistych zakupach na odległość konsument ma co do zasady 14 dni
          na odstąpienie od umowy. Obsługa demonstracyjna zapisuje zgłoszenie do
          rozpatrzenia.
        </p>
      </section>
      <section className="panel">
        <h2>Zgłoś sprawę</h2>
        {user ? (
          <p>
            Wybierz zamówienie i pozycje w{" "}
            <Link className="text-link" href="/konto/zwroty">
              panelu klienta
            </Link>
            .
          </p>
        ) : (
          <ActionForm action={createReturn} submit="Wyślij zgłoszenie">
            <label>
              Numer zamówienia
              <input
                name="number"
                placeholder="NX-2026-000001"
                required
                maxLength={30}
              />
            </label>
            <label>
              Adres e-mail użyty przy zakupie
              <input name="email" type="email" required maxLength={254} />
            </label>
            <label>
              Rodzaj sprawy
              <select name="type">
                <option value="return">Zwrot</option>
                <option value="complaint">Reklamacja</option>
              </select>
            </label>
            <label>
              Opis i produkty, których dotyczy sprawa
              <textarea name="body" required minLength={10} maxLength={3000} />
            </label>
          </ActionForm>
        )}
      </section>
    </InfoPage>
  );
}
