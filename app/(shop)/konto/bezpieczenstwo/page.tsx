import { ActionForm } from "@/src/components/ui/forms";
import { changePassword } from "@/src/features/account/auth-actions";
import { requireCustomer } from "@/src/lib/auth";
import { date } from "@/src/lib/format";
export default async function Page() {
  const user = await requireCustomer();
  return (
    <>
      <div className="page-heading">
        <h1>Bezpieczeństwo</h1>
        <p>Zmiana hasła kończy dotychczasowe sesje logowania.</p>
        {user.lastLoginAt && (
          <p>Ostatnie logowanie {date(user.lastLoginAt)}.</p>
        )}
      </div>
      <section className="panel">
        <ActionForm action={changePassword} submit="Zmień hasło">
          <label>
            Obecne hasło
            <input
              name="old"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Nowe hasło
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <label>
            Powtórz nowe hasło
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </label>
        </ActionForm>
      </section>
    </>
  );
}
