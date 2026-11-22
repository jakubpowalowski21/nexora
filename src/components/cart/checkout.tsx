"use client";
import Link from "next/link";
import { Banknote, CreditCard, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/src/components/ui/button";
import { useCommerce, useCartQuote } from "@/src/features/cart/client";
import {
  checkoutForm,
  type CartLine,
  type CheckoutFields,
} from "@/src/lib/validation";
import { money, shipping } from "@/src/lib/format";
import { EmptyCart, Totals } from "./cart";

const stages = ["Dane", "Dostawa", "Płatność", "Podsumowanie"];
const addressFields = [
  "name",
  "email",
  "phone",
  "street",
  "zip",
  "city",
  "country",
  "company",
  "nip",
] as const;
const fields = [
  ["name", "Imię i nazwisko", "name"],
  ["email", "Adres e-mail", "email"],
  ["phone", "Telefon", "tel"],
  ["street", "Ulica i numer", "street-address"],
  ["zip", "Kod pocztowy", "postal-code"],
  ["city", "Miejscowość", "address-level2"],
  ["company", "Firma (opcjonalnie)", "organization"],
  ["nip", "NIP (opcjonalnie)", "off"],
] as const;
export function Checkout({
  initial,
  stripeEnabled,
  methods,
  accountEmail,
}: {
  initial: Partial<CheckoutFields>;
  stripeEnabled: boolean;
  methods: { id: string; price: number }[];
  accountEmail?: boolean;
}) {
  const { ready, items } = useCommerce();
  const [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef<{ id: string; body: string } | null>(null);
  const enabled = shipping.filter((method) =>
    methods.some((m) => m.id === method.id),
  );
  const form = useForm<CheckoutFields, unknown, z.infer<typeof checkoutForm>>({
    resolver: zodResolver(checkoutForm),
    shouldUnregister: false,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      street: "",
      zip: "",
      city: "",
      country: "Polska",
      shipping: enabled[0]?.id || "pickup",
      payment: stripeEnabled ? "stripe" : "transfer",
      ...initial,
    },
  });
  useEffect(() => {
    const code = sessionStorage.getItem("nexora-coupon");
    if (code) form.setValue("coupon", code);
  }, [form]);
  const [method, coupon] = useWatch({
    control: form.control,
    name: ["shipping", "coupon"],
  });
  const quoteState = useCartQuote(true, method, coupon);
  const quote = quoteState.quote;
  const go = async () => {
    const byStep: ReadonlyArray<readonly FieldPath<CheckoutFields>[]> = [
      addressFields,
      ["shipping"],
      ["payment"],
    ];
    if (await form.trigger([...byStep[step]], { shouldFocus: true }))
      setStep(step + 1);
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) =>
    form.handleSubmit(
      async (values) => {
        if (!quote || quote.issues.length || quote.couponError) return;
        setError("");
        setBusy(true);
        try {
          const payload = { ...values, items };
          const body = JSON.stringify(payload);
          if (!request.current || request.current.body !== body)
            request.current = { id: crypto.randomUUID(), body };
          try {
            const saved = JSON.parse(
              sessionStorage.getItem("nexora-pending-checkout") || "null",
            ) as { id: string; digest: string } | null;
            const digest = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(body),
                ),
              ),
            )
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("");
            if (saved?.digest === digest) request.current.id = saved.id;
            sessionStorage.setItem(
              "nexora-pending-checkout",
              JSON.stringify({ id: request.current.id, digest }),
            );
          } catch {
            /* The in-memory request ID still covers retries on this page. */
          }
          const res = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, requestId: request.current.id }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          location.assign(result.url);
        } catch (error) {
          setError(
            (error as Error).message || "Nie udało się złożyć zamówienia.",
          );
          setBusy(false);
        }
      },
      (errors) => {
        if (addressFields.some((key) => errors[key])) setStep(0);
      },
    )(event);
  if (!ready) return <p className="panel">Ładuję zamówienie…</p>;
  if (!items.length) return <EmptyCart />;
  const v = form.getValues();
  return (
    <div className="basket-layout checkout">
      <section>
        <ol className="checkout-steps">
          {stages.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                aria-current={i === step ? "step" : undefined}
                disabled={i > step || busy}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                <b>{label}</b>
              </button>
            </li>
          ))}
        </ol>
        <form
          className="panel checkout-panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) void go();
            else void submit(e);
          }}
        >
          <h2>
            {
              [
                "Dane do zamówienia",
                "Wybierz dostawę",
                "Wybierz płatność",
                "Sprawdź zamówienie",
              ][step]
            }
          </h2>
          {step === 0 && (
            <div className="form-grid">
              {fields.map(([id, label, autocomplete]) => (
                <label key={id}>
                  {label}
                  <input
                    {...form.register(id)}
                    type={
                      id === "email" ? "email" : id === "phone" ? "tel" : "text"
                    }
                    autoComplete={autocomplete}
                    readOnly={id === "email" && accountEmail}
                    aria-invalid={!!form.formState.errors[id]}
                  />
                  {!!form.formState.errors[id] && (
                    <span className="small-error">
                      {form.formState.errors[id]?.message}
                    </span>
                  )}
                </label>
              ))}
              <label>
                Kraj
                <select {...form.register("country")}>
                  <option>Polska</option>
                </select>
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="option-list">
              {enabled.map((m) => {
                const base = methods.find((row) => row.id === m.id)?.price || 0;
                return (
                  <label key={m.id} className="option">
                    <input
                      type="radio"
                      value={m.id}
                      {...form.register("shipping")}
                    />
                    <span>
                      <strong>{m.name}</strong>
                      <small>{m.time}</small>
                    </span>
                    <b>
                      {quote &&
                      quote.subtotal - quote.discount >= quote.threshold &&
                      m.id !== "express"
                        ? "0,00 zł"
                        : money(base)}
                    </b>
                  </label>
                );
              })}
            </div>
          )}
          {step === 2 && (
            <div className="option-list">
              <label className="option">
                <input
                  type="radio"
                  value="stripe"
                  disabled={!stripeEnabled}
                  {...form.register("payment")}
                />
                <CreditCard size={20} />
                <span>
                  <strong>Karta przez Stripe</strong>
                  <small>
                    {stripeEnabled
                      ? "Płatność w trybie testowym"
                      : "Wymaga konfiguracji Stripe"}
                  </small>
                </span>
              </label>
              <label className="option">
                <input
                  type="radio"
                  value="transfer"
                  {...form.register("payment")}
                />
                <Banknote size={20} />
                <span>
                  <strong>Przelew demonstracyjny</strong>
                  <small>Potwierdzenie testowe w panelu zamówień</small>
                </span>
              </label>
            </div>
          )}
          {step === 3 && (
            <>
              <div className="summary-address">
                <p>
                  <strong>{v.name}</strong>
                  <br />
                  {v.street}
                  <br />
                  {v.zip} {v.city}, {v.country}
                </p>
                <p>
                  {v.email}
                  <br />
                  {v.phone}
                  <br />
                  {enabled.find((m) => m.id === v.shipping)?.name} ·{" "}
                  {v.payment === "stripe" ? "Stripe test" : "Przelew demo"}
                </p>
              </div>
              <div className="order-lines-mini">
                {quote?.items.map((item) => (
                  <div className="price-row" key={item.id}>
                    <span>
                      {item.name} · {item.variant}
                      <small>
                        {item.quantity} × {money(item.price)}
                      </small>
                    </span>
                    <strong>{money(item.quantity * item.price)}</strong>
                  </div>
                ))}
              </div>
              <label className="checkbox">
                <input type="checkbox" {...form.register("terms")} />
                <span>
                  Akceptuję{" "}
                  <Link className="text-link" href="/regulamin" target="_blank">
                    regulamin
                  </Link>{" "}
                  i składam zamówienie demonstracyjne.
                </span>
              </label>
              {form.formState.errors.terms && (
                <p className="small-error" role="alert">
                  {form.formState.errors.terms.message}
                </p>
              )}
            </>
          )}
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions-row">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setStep(step - 1)}
              >
                Wstecz
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                busy ||
                (step === 3 &&
                  (!quote ||
                    !!quote.issues.length ||
                    !!quote.couponError ||
                    quote.preview))
              }
            >
              {busy
                ? "Zapisuję…"
                : step < 3
                  ? "Dalej"
                  : "Złóż zamówienie testowe"}
            </Button>
          </div>
        </form>
      </section>
      {quote ? (
        <Totals quote={quote}>
          {quote.preview && (
            <p className="alert">
              Podgląd koszyka. Zapis zamówień wymaga połączenia z bazą.
            </p>
          )}
          {quote.issues.map((issue, i) => (
            <p className="small-error" key={i}>
              {issue}
            </p>
          ))}
          {quote.couponError && (
            <p className="small-error">
              {quote.couponError}{" "}
              <Link className="text-link" href="/koszyk">
                Wróć do koszyka
              </Link>
            </p>
          )}
          <small className="secure">
            <LockKeyhole size={15} /> Zamówienie demonstracyjne
          </small>
        </Totals>
      ) : (
        <p className="panel" role="status">
          {quoteState.error || "Przeliczam zamówienie…"}
        </p>
      )}
    </div>
  );
}

export function ClearGuestCart({
  requestId,
  lines,
}: {
  requestId: string;
  lines: CartLine[];
}) {
  const { ready, signedIn, clearGuest } = useCommerce();
  useEffect(() => {
    if (!ready) return;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("nexora-pending-checkout") || "null",
      ) as { id: string } | null;
      if (saved?.id !== requestId) return;
      if (!signedIn) clearGuest(lines);
      sessionStorage.removeItem("nexora-coupon");
      sessionStorage.removeItem("nexora-pending-checkout");
    } catch {
      /* Checkout remains complete when session storage is unavailable. */
    }
  }, [ready, signedIn, clearGuest, requestId, lines]);
  return null;
}
