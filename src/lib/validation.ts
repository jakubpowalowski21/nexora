import { z } from "zod";

export const email = z
  .email("Podaj poprawny adres e-mail.")
  .transform((value) => value.toLowerCase());
export const password = z
  .string()
  .min(10, "Hasło musi mieć co najmniej 10 znaków.")
  .max(128);
const text = (min: number, max: number) =>
  z.string().trim().min(min, "Uzupełnij to pole.").max(max);
export const credentials = z.object({
  email,
  password: z.string().min(1).max(128),
});
export const registration = z
  .object({
    name: text(2, 100),
    email,
    password,
    confirmation: z.string(),
    terms: z.literal(true, "Zaakceptuj regulamin."),
  })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "Hasła nie są takie same.",
  });
export const address = z.object({
  name: text(2, 100),
  street: text(3, 160),
  zip: text(3, 12),
  city: text(2, 80),
  country: z.literal("Polska"),
  phone: text(7, 25).regex(/^[+0-9 ()-]+$/, "Podaj poprawny numer telefonu."),
  company: z.string().trim().max(120).optional(),
  nip: z
    .string()
    .trim()
    .regex(/^(?:\d{10})?$/, "NIP musi zawierać 10 cyfr.")
    .optional(),
});
export const contact = address.extend({ email });
export const line = z.object({
  id: z.string().max(80).min(1),
  quantity: z.number().int().min(1).max(99),
});
export const shippingMethod = z.enum(["pickup", "courier", "express"]);
const coupon = z
  .string()
  .trim()
  .max(40)
  .transform((value) => value.toUpperCase())
  .optional();
export const quoteInput = z.object({
  items: z.array(line).max(80),
  shipping: shippingMethod.default("pickup"),
  coupon,
});
export const checkoutForm = contact.extend({
  shipping: shippingMethod,
  payment: z.enum(["transfer", "stripe"]),
  coupon,
  terms: z.literal(true, "Zaakceptuj regulamin."),
});
export const checkoutInput = checkoutForm.extend({
  items: z.array(line).min(1).max(80),
  requestId: z.uuid(),
});
export const contactMessage = z.object({
  email,
  subject: text(3, 150),
  body: text(10, 4000),
});
export const reviewInput = z.object({
  productId: z.string().max(80),
  rating: z.coerce.number().int().min(1).max(5),
  title: text(3, 100),
  body: text(10, 2500),
});
export type CartLine = z.infer<typeof line>;
export type CheckoutFields = z.input<typeof checkoutForm>;
export type Address = z.infer<typeof address>;
