# NEXORA · Premium Tech Store

Polski sklep demonstracyjny z 48 produktami w sześciu kategoriach. Projekt obejmuje katalog, koszyk, zakupy gościa, konto klienta i panel administracyjny. Produkty, recenzje przykładowe, zamówienia i płatności służą do demonstracji.

Publiczne wdrożenie działa pod adresem [nexora-neon-pi.vercel.app](https://nexora-neon-pi.vercel.app).

## Uruchomienie

Wymagany jest Node.js 22.12+ lub 24 oraz PostgreSQL. Projekt korzysta z Next.js 16, TypeScript, Tailwind CSS, komponentów opartych na Radix UI, Drizzle, Auth.js, Zustand, Zod i React Hook Form.

```powershell
npm ci
npm run dev
```

Otwórz [localhost:3000](http://localhost:3000). W przygotowanym katalogu projektu istnieje już plik `.env.local`, baza Neon ma wykonane migracje i załadowany katalog. Hasło administratora jest zapisane lokalnie pod `ADMIN_PASSWORD`, a adres pod `ADMIN_EMAIL`. Logowanie jest dostępne pod [localhost:3000/logowanie](http://localhost:3000/logowanie), a panel pod [localhost:3000/admin](http://localhost:3000/admin).

Kod **NEXORA10** daje 10% rabatu od koszyka o wartości 200 zł. Testowy przelew można potwierdzić ręcznie w szczegółach zamówienia jako administrator. Publiczne [demo panelu](http://localhost:3000/demo-admin) używa danych przykładowych zapisanych w bieżącej karcie przeglądarki.

### Świeża baza

1. Skopiuj `.env.example` do `.env.local`. Jeżeli plik już istnieje, uzupełnij w nim brakujące klucze.
2. W konsoli Neon wybierz projekt i gałąź dla NEXORA. W sekcji **Connect** skopiuj bezpośredni adres połączenia do `DATABASE_URL` oraz adres z poolerem do `DATABASE_URL_POOLED`. Przy migracji skrypt korzysta z `DATABASE_URL_UNPOOLED`, jeśli go podasz, albo z `DATABASE_URL`.
3. Wygeneruj osobną losową wartość dla `AUTH_SECRET` i `CRON_SECRET`, uruchamiając poniższą komendę dwukrotnie. Dodaj wartości do `.env.local`.

   ```powershell
   node -p "require('node:crypto').randomBytes(48).toString('base64url')"
   ```

4. Ustaw `ADMIN_EMAIL` i `ADMIN_PASSWORD` na czas tworzenia konta. Hasło musi mieć przynajmniej 14 znaków. Wykonaj migrację i załaduj dane.

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

   Seed uzupełnia fikstury i tworzy zweryfikowane konto tylko pod wolnym adresem. Zapisane konto zachowuje dotychczasowe hasło i rolę po kolejnym uruchomieniu seeda. W nowej konfiguracji możesz przenieść dane dostępowe do menedżera haseł i usunąć `ADMIN_EMAIL` oraz `ADMIN_PASSWORD` z pliku.

## Usługi wymagające Twojego konta

### Stripe w trybie testowym

1. Włącz sandbox lub tryb testowy w Stripe. Zapisz testowy klucz zaczynający się od `sk_test_` w `STRIPE_SECRET_KEY`.
2. Uruchom lokalny nasłuch w osobnym terminalu. Skrypt korzysta z klucza testowego, zapisuje `STRIPE_WEBHOOK_SECRET` w `.env.local` i przekazuje zdarzenia do aplikacji na porcie 3000. Na tym komputerze użyje istniejącego `.stripe-cli/stripe.exe`. Na innym komputerze zainstaluj Stripe CLI zgodnie z instrukcją dostawcy. [Instrukcja Stripe CLI](https://docs.stripe.com/stripe-cli)

   ```powershell
   npm run stripe:listen
   ```

3. Uruchom `npm run dev` w drugim terminalu. Jeżeli nasłuch zmienił sekret przy uruchomionej aplikacji, uruchom ją ponownie. W checkoutcie wybierz kartę. Użyj testowego numeru `4242 4242 4242 4242`, przyszłej daty ważności i dowolnego trzycyfrowego CVC. Zamówienie zmieni status po odebraniu zweryfikowanego webhooka.
4. Dla opublikowanej aplikacji zarejestruj w Stripe osobny testowy webhook na `https://TWOJ-ADRES/api/webhooks/stripe` z tymi samymi zdarzeniami i dodaj jego sekret w Vercel. Lokalny sekret z CLI dotyczy lokalnego nasłuchu.

### Opcjonalna poczta SMTP

W trybie demonstracyjnym rejestracja i logowanie działają bez potwierdzania skrzynki. Powiadomienia, zmiana adresu e-mail i reset hasła przez link są dostępne po skonfigurowaniu SMTP.

1. Wybierz skrzynkę z dostępem SMTP. W Gmail włącz weryfikację dwuetapową i wygeneruj hasło aplikacji, jeśli ta opcja jest dostępna dla konta. [Hasła do aplikacji Google](https://support.google.com/accounts/answer/185833)
2. Ustaw `SMTP_HOST` na `smtp.gmail.com`, `SMTP_PORT` na `465`, `SMTP_USER` na adres Gmail i `SMTP_PASSWORD` na hasło aplikacji. `MAIL_FROM` jest opcjonalny i domyślnie przyjmuje wartość `SMTP_USER`. Dla innego dostawcy użyj jego ustawień SMTP.
3. Po włączeniu poczty nowe konta potwierdzają adres e-mail. Właściciele kont demonstracyjnych mogą potwierdzić adres i ustawić nowe hasło przez formularz odzyskiwania. Kolejka poczty jest zapisana w tabeli `email_outbox`.

### Zdjęcia produktów

Administrator może przesyłać JPEG, PNG lub WebP do 3 MB na plik. Aplikacja zmniejsza duże zdjęcia, zapisuje je w Neon jako WebP i udostępnia pod adresem `/media/uploads/…`. Zapisane zdjęcia można porządkować i uzupełniać o tekst alternatywny. Pierwsze zdjęcie jest główne.

Katalog startowy używa plików z `public/media`. Część modeli z tej samej kategorii korzysta ze wspólnego ujęcia poglądowego.

### Publikacja na Vercel

1. Wypchnij zmiany do swojego repozytorium, a następnie zaimportuj je w [Vercel](https://vercel.com/new) jako projekt Next.js.
2. W **Settings → Environment Variables** dodaj adresy Neon, `AUTH_SECRET`, `CRON_SECRET`, `SITE_URL` z publicznym adresem HTTPS i skonfigurowane klucze usług. Dane `ADMIN_EMAIL` i `ADMIN_PASSWORD` służą tylko lokalnemu seedowi.
3. Upewnij się, że gałąź Neon dla tego wdrożenia ma wykonane migracje i dane demo. Wdróż aplikację i zarejestruj testowy webhook Stripe dla przypisanej domeny. Sprawdź stronę główną, zakup demonstracyjny i stan w panelu.
4. `vercel.json` uruchamia `/api/maintenance` raz na dobę o 03:00 UTC. Endpoint wymaga nagłówka `Authorization: Bearer <CRON_SECRET>` i obsługuje wygasłe rezerwacje oraz ponawianie poczty. Dla częstszych uruchomień ustaw harmonogram zgodny z planem Vercel lub wywołuj ten endpoint z własnego harmonogramu. Wygaśnięcie sesji Stripe może też zwolnić rezerwację od razu przez webhook.

## Weryfikacja i testy

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

- Testy Vitest sprawdzają ceny w groszach, dostawę, statusy zamówień i walidację. Aby włączyć testy PostgreSQL, ustaw `TEST_DATABASE_URL` na bezpośredni adres bazy testowej z prawem tworzenia schematów. Test tworzy i usuwa losowo nazwany schemat. Scenariusze obejmują współbieżne rezerwacje ostatniej sztuki, limit kuponu, scalenie koszyka, dostęp do zamówień, powtórzone zdarzenia Stripe i wygaśnięcie rezerwacji.
- Przeglądarkowy Playwright sprawdza katalog, wyszukiwarkę, warianty, koszyk, dostęp do administracji i szerokość 320 px. Ustaw `E2E_DATABASE=1` w środowisku testowym, aby wykonać zakup testowy z anulowaniem oraz logowanie kontem z `.env.local`. Na Windows można ustawić `PLAYWRIGHT_CHANNEL=msedge`, aby użyć zainstalowanego Edge.
- Testy webhooka sprawdzają logikę aplikacji na zdarzeniach testowych. Pełna próba w Stripe Checkout oraz dostarczenie wiadomości wymagają aktywnej konfiguracji opisanej wyżej.

## Dane i logika sklepu

- `src/db/schema.ts` i `drizzle/` definiują model PostgreSQL, indeksy, ograniczenia i migracje.
- `src/features/catalog` obsługuje zapytania Drizzle, filtry z URL, paginację, podpowiedzi i dane demonstracyjne. Lokalny podgląd katalogu może użyć fikstur, gdy PostgreSQL jest chwilowo niedostępny.
- `src/features/orders` odpowiada za przeliczenie koszyka na serwerze, rezerwacje, płatności, realizację i zwroty. Zamówienie zachowuje ceny, SKU i adres z chwili zakupu.
- `src/features/account`, `src/features/cart` i `src/features/admin` obsługują role, sesje, koszyk, ulubione, zarządzanie sklepem i raporty.
- `src/features/mail/outbox.ts` odpowiada za wysyłkę i ponowienia poza transakcją zamówienia.
