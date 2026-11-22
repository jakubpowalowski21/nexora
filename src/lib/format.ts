export const siteName = "NEXORA";
export const shipping = [
  { id: "pickup", name: "Punkt odbioru", price: 999, time: "1–2 dni robocze" },
  { id: "courier", name: "Kurier", price: 1499, time: "1–2 dni robocze" },
  {
    id: "express",
    name: "Kurier ekspresowy",
    price: 2499,
    time: "Następny dzień roboczy",
  },
] as const;

export const money = (grosze: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
    grosze / 100,
  );
export const date = (value: Date | string) =>
  new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    dateStyle: "medium",
  }).format(new Date(value));

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const fulfillmentLabels = {
  new: "Nowe",
  processing: "W przygotowaniu",
  shipped: "Wysłane",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
} as const;
export const paymentLabels = {
  pending: "Oczekuje na płatność",
  paid: "Opłacone",
  failed: "Nieopłacone",
  refunded: "Zwrócone",
  partially_refunded: "Częściowo zwrócone",
} as const;

export function shippingCost(
  method: (typeof shipping)[number]["id"],
  subtotal: number,
  threshold = 19900,
  methods: Array<{ id: string; price: number }> = [...shipping],
) {
  const option = methods.find((entry) => entry.id === method);
  if (!option) throw new Error("Wybrana metoda dostawy jest niedostępna.");
  return method !== "express" && subtotal >= threshold ? 0 : option.price;
}

export function siteUrl() {
  return (
    process.env.SITE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
