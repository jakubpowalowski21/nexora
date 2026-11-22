import Link from "next/link";
import { requireCustomer } from "@/src/lib/auth";
import { smtpConfig } from "@/src/lib/mail-config";
import { requestEmailChange } from "@/src/features/account/auth-actions";
import { saveProfile } from "@/src/features/account/actions";
import { ActionForm } from "@/src/components/ui/forms";
export default async function Page() {
  const user = await requireCustomer();
  return (
    <>
      <div className="page-heading">
        <h1>Moje dane</h1>
      </div>
      <section className="panel">
        <ActionForm action={saveProfile}>
          <label>
            Imię i nazwisko
            <input
              name="name"
              required
              defaultValue={user.name}
              maxLength={100}
            />
          </label>
          <label>
            Telefon
            <input
              name="phone"
              type="tel"
              defaultValue={user.phone || ""}
              maxLength={25}
            />
          </label>
          <label>
            Obecny adres e-mail
            <input type="email" readOnly value={user.email} />
          </label>
        </ActionForm>
        <h3>Zmiana adresu e-mail</h3>
        {smtpConfig() ? (
          <ActionForm
            action={requestEmailChange}
            submit="Wyślij link weryfikacyjny"
            variant="secondary"
          >
            <label>
              Nowy adres e-mail
              <input type="email" name="email" required maxLength={254} />
            </label>
            <label>
              Obecne hasło
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
          </ActionForm>
        ) : (
          <p className="subtle">
            Zmiana adresu wymaga aktywnej wysyłki poczty.
          </p>
        )}
        <p className="subtle dashboard-gap">
          W sprawie eksportu lub usunięcia danych{" "}
          <Link className="text-link" href="/kontakt">
            skontaktuj się z nami
          </Link>
          .
        </p>
      </section>
    </>
  );
}
