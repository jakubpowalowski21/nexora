import { test, expect } from "@playwright/test";

test("katalog, wyszukiwanie i paginacja", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Technologia,.*która robi różnicę/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Szukaj produktów" }).click();
  await page
    .getByRole("textbox", { name: "Nazwa, marka lub kategoria" })
    .fill("studio pro");
  await expect(
    page.getByRole("dialog").getByRole("link", { name: /Studio Pro Wireless/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/produkty?cenaOd=100&cenaDo=500&sortowanie=cena-rosnaco");
  await expect(
    page.getByRole("heading", { name: "Wszystkie produkty" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.getByRole("link", { name: "Strona 2", exact: true }).click();
  await expect(page).toHaveURL(/strona=2/);
  await expect(page.getByText("Strona 2 z", { exact: false })).toBeVisible();
});

test("wariant, koszyk i dane po odświeżeniu", async ({ page }) => {
  await page.goto("/produkt/studio-pro-wireless");
  await expect(
    page.getByRole("heading", { name: "Studio Pro Wireless", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Fioletowy" }).check();
  await expect(
    page.getByRole("button", { name: "Dodaj do koszyka", exact: true }).first(),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Biały" }).check();
  await page.getByRole("button", { name: "Zwiększ ilość" }).click();
  await page
    .getByRole("button", { name: "Dodaj do koszyka", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByText("Biały · 2 szt."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Zobacz pełny koszyk" }).click();
  await expect(page).toHaveURL(/\/koszyk$/);
  await expect(
    page.getByRole("heading", { name: "Twój koszyk" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Studio Pro Wireless" }),
  ).toBeVisible();
  await expect(page.locator(".basket-item output")).toHaveText("2");
  await page.getByRole("textbox", { name: "Kod rabatowy" }).fill("NEXORA10");
  await page.getByRole("button", { name: "Zastosuj", exact: true }).click();
  await expect(page.getByText("Rabat", { exact: true })).toBeVisible();
});

test("niezalogowany odwiedzający nie otwiera panelu", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/logowanie/);
  await expect(
    page.getByRole("heading", { name: "Zaloguj się" }),
  ).toBeVisible();
  await expect((await request.get("/api/admin/raport")).status()).toBe(403);
});

test("gość składa i anuluje zamówienie z przelewem demo", async ({ page }) => {
  test.skip(
    !process.env.E2E_DATABASE,
    "Wymaga uruchomionej bazy demonstracyjnej.",
  );
  await page.goto("/produkt/studio-pro-wireless");
  await page
    .getByRole("button", { name: "Dodaj do koszyka", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Przejdź do zamówienia" }).click();
  for (const [label, value] of [
    ["Imię i nazwisko", "Jan Testowy"],
    ["Adres e-mail", "checkout-e2e@example.com"],
    ["Telefon", "123456789"],
    ["Ulica i numer", "Testowa 1"],
    ["Kod pocztowy", "00-001"],
    ["Miejscowość", "Warszawa"],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("radio", { name: /Przelew demonstracyjny/ }).check();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.getByRole("checkbox", { name: /Akceptuję/ }).check();
  await page.getByRole("button", { name: "Złóż zamówienie testowe" }).click();
  await expect(
    page.getByRole("heading", { name: "Zamówienie przyjęte" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anuluj zamówienie" }).click();
  await expect(
    page.getByRole("heading", { name: "Zamówienie anulowane" }),
  ).toBeVisible();
});

test("zweryfikowany administrator otwiera raport i zarządzanie produktami", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_DATABASE ||
      !process.env.ADMIN_EMAIL ||
      !process.env.ADMIN_PASSWORD,
    "Wymaga konta administratora w bazie demo.",
  );
  await page.goto("/admin");
  await page
    .getByRole("textbox", { name: "Adres e-mail" })
    .fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Hasło", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Przegląd sklepu" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Panel administratora" })
    .getByRole("link", { name: "Produkty", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Dodaj produkt" })).toBeVisible();
  await page
    .getByRole("link", { name: "Studio Pro Wireless", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edytuj produkt" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nazwa", { exact: true })).toHaveValue(
    "Studio Pro Wireless",
  );
});

test("karta 320 px wyświetla menu, a demo panelu nie zmienia oferty", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole("button", { name: "Otwórz menu" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Audio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zamknij" }).click();
  await page.goto("/demo-admin");
  await page
    .getByLabel("Nazwa", { exact: true })
    .fill("Produkt w karcie testowej");
  await page.getByLabel("Cena w zł", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(
    page.getByText("Produkt w karcie testowej", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Produkt w karcie testowej", { exact: true }),
  ).toBeVisible();
  await page.goto("/produkty?szukaj=warek854demo");
  await expect(
    page.getByRole("heading", {
      name: "Nie znaleziono produktów spełniających kryteria",
      exact: true,
    }),
  ).toBeVisible();
});
