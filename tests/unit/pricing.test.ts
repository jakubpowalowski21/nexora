import { describe, expect, it } from "vitest";
import { canAdvance, couponDiscount } from "@/src/features/orders/pricing";
import { shippingCost, slugify } from "@/src/lib/format";
import { checkoutInput } from "@/src/lib/validation";

describe("ceny i dostawa", () => {
  it("liczy procent w groszach i ogranicza rabat", () => {
    expect(
      couponDiscount({ kind: "percent", value: 10, maximum: null }, 39999),
    ).toBe(3999);
    expect(
      couponDiscount({ kind: "percent", value: 20, maximum: 2500 }, 39900),
    ).toBe(2500);
    expect(
      couponDiscount({ kind: "fixed", value: 5000, maximum: null }, 2500),
    ).toBe(2500);
  });
  it("zwalnia standardową dostawę od progu", () => {
    expect(shippingCost("pickup", 19899)).toBe(999);
    expect(shippingCost("pickup", 19900)).toBe(0);
    expect(shippingCost("express", 19900)).toBe(2499);
  });
  it("odrzuca metodę dostawy wyłączoną przez administratora", () => {
    expect(() =>
      shippingCost("pickup", 19900, 19900, [{ id: "courier", price: 1499 }]),
    ).toThrow();
  });
});

describe("zamówienie", () => {
  it("pozwala wysłać wyłącznie opłacone zamówienie w przygotowaniu", () => {
    expect(canAdvance("processing", "shipped", "paid")).toBe(true);
    expect(canAdvance("processing", "shipped", "pending")).toBe(false);
    expect(canAdvance("cancelled", "shipped", "paid")).toBe(false);
    expect(canAdvance("new", "delivered", "paid")).toBe(false);
  });
  it("waliduje liczbę sztuk, dane klienta i identyfikator", () => {
    const values = {
      name: "Jan Testowy",
      email: "JAN@EXAMPLE.COM",
      phone: "123456789",
      street: "Prosta 1",
      zip: "00-001",
      city: "Warszawa",
      country: "Polska",
      items: [{ id: "mysz", quantity: 1 }],
      payment: "transfer",
      shipping: "pickup",
      terms: true,
      requestId: crypto.randomUUID(),
    };
    expect(checkoutInput.parse(values).email).toBe("jan@example.com");
    expect(
      checkoutInput.safeParse({
        ...values,
        items: [{ id: "mysz", quantity: 100 }],
      }).success,
    ).toBe(false);
    expect(checkoutInput.safeParse({ ...values, terms: false }).success).toBe(
      false,
    );
  });
  it("buduje polski slug", () =>
    expect(slugify("  Słuchawki Białe + ANC ")).toBe("sluchawki-biale-anc"));
});
