import Link from "next/link";
import { KeyRound, MailCheck, UserRound } from "lucide-react";
import { ActionForm } from "@/src/components/ui/forms";
import { smtpConfig } from "@/src/lib/mail-config";
import {
  login,
  recover,
  register,
  reset,
  verify,
} from "@/src/features/account/auth-actions";

export function AuthPage({
  kind,
  token,
  returnTo,
}: {
  kind: "login" | "register" | "recover" | "verify";
  token?: string;
  returnTo?: string;
}) {
  const resetting = kind === "recover" && !!token;
  const mailEnabled = !!smtpConfig();
  const recoveryUnavailable = kind === "recover" && !resetting && !mailEnabled;
  const title =
    kind === "login"
      ? "Zaloguj się"
      : kind === "register"
        ? "Załóż konto"
        : kind === "verify"
          ? "Potwierdź adres e-mail"
          : resetting
            ? "Ustaw nowe hasło"
            : "Odzyskaj dostęp";
  const copy =
    kind === "login"
      ? "Sprawdź zamówienia, adresy i ulubione produkty."
      : kind === "register"
        ? mailEnabled
          ? "Zapisuj ulubione i szybciej wracaj do zamówień."
          : "Konto demonstracyjne będzie dostępne od razu po rejestracji."
        : kind === "verify"
          ? "Zatwierdź adres, aby aktywować konto."
          : resetting
            ? "Wpisz nowe hasło do konta."
            : recoveryUnavailable
              ? "Odzyskiwanie hasła będzie dostępne po podłączeniu poczty."
              : "Wyślemy Ci link do zresetowania hasła.";
  const action =
    kind === "login"
      ? login
      : kind === "register"
        ? register
        : kind === "verify"
          ? verify
          : resetting
            ? reset
            : recover;
  const Icon =
    kind === "verify" ? MailCheck : kind === "recover" ? KeyRound : UserRound;
  return (
    <div className="wrap page-space">
      <section className="panel auth-card">
        <span className="benefit-icon">
          <Icon size={23} />
        </span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {!recoveryUnavailable && (
          <ActionForm
            action={action}
            submit={
              kind === "verify"
                ? "Potwierdź"
                : kind === "recover"
                  ? resetting
                    ? "Zmień hasło"
                    : "Wyślij link"
                  : title
            }
          >
            {token && <input type="hidden" name="token" value={token} />}
            {returnTo && (
              <input type="hidden" name="returnTo" value={returnTo} />
            )}
            {kind === "register" && (
              <label>
                Imię i nazwisko
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            {kind !== "verify" && !resetting && (
              <label>
                Adres e-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {(kind === "login" || kind === "register" || resetting) && (
              <label>
                Hasło
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    kind === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={kind === "login" ? 1 : 10}
                  maxLength={128}
                />
              </label>
            )}
            {(kind === "register" || resetting) && (
              <label>
                Powtórz hasło
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
            )}
            {kind === "register" && (
              <label className="checkbox">
                <input type="checkbox" name="terms" required />
                <span>
                  Akceptuję{" "}
                  <Link className="text-link" href="/regulamin">
                    regulamin
                  </Link>{" "}
                  i zapoznałem się z{" "}
                  <Link className="text-link" href="/polityka-prywatnosci">
                    polityką prywatności
                  </Link>
                  .
                </span>
              </label>
            )}
          </ActionForm>
        )}
        <div className="auth-links">
          {kind === "login" ? (
            <>
              {mailEnabled && (
                <Link href="/odzyskaj-haslo">Nie pamiętam hasła</Link>
              )}
              <Link href="/rejestracja">Załóż konto</Link>
            </>
          ) : (
            <Link href="/logowanie">Przejdź do logowania</Link>
          )}
        </div>
      </section>
    </div>
  );
}
