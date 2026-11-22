import { InfoPage } from "@/src/components/layout/info-page";
import { ActionForm } from "@/src/components/ui/forms";
import { contactShop } from "@/src/features/catalog/home-actions";
import { getSettings } from "@/src/features/catalog/data";
export const metadata = {
  title: "Kontakt",
  alternates: { canonical: "/kontakt" },
};
export default async function Page() {
  const store = await getSettings();
  return (
    <InfoPage
      title="Kontakt"
      description="Masz pytanie o sprzęt, zamówienie albo zwrot? Napisz do nas."
    >
      <section className="panel">
        <ActionForm action={contactShop} submit="Wyślij wiadomość">
          <label>
            Twój adres e-mail
            <input type="email" name="email" required maxLength={254} />
          </label>
          <label>
            Temat
            <input name="subject" required minLength={3} maxLength={150} />
          </label>
          <label>
            Wiadomość
            <textarea name="body" required minLength={10} maxLength={4000} />
          </label>
        </ActionForm>
      </section>
      {!store.email.endsWith(".example") && (
        <p>
          Adres kontaktowy{" "}
          <a className="text-link" href={`mailto:${store.email}`}>
            {store.email}
          </a>
          .
        </p>
      )}
    </InfoPage>
  );
}
