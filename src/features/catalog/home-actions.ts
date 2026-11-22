"use server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, hasDb } from "@/src/db";
import { messages, newsletter, settings } from "@/src/db/schema";
import { contactMessage, email } from "@/src/lib/validation";
import { rateLimit, requestIP } from "@/src/features/account/security";
import type { FormState } from "@/src/features/account/auth-actions";
import { queueMail } from "@/src/features/mail/outbox";
export async function subscribe(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const parsed = email.safeParse(data.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (data.get("consent") !== "on")
    return { error: "Wyraź zgodę na otrzymywanie newslettera." };
  if (!hasDb) return { error: "Newsletter jest chwilowo niedostępny." };
  try {
    if (!(await rateLimit(`newsletter:${requestIP(await headers())}`, 15, 60)))
      return { error: "Spróbuj ponownie później." };
    const [store] = await db()
      .select()
      .from(settings)
      .where(eq(settings.id, 1));
    if (store?.newsletterEnabled === false)
      return { error: "Zapisy są chwilowo zamknięte." };
    await db()
      .insert(newsletter)
      .values({ email: parsed.data, consentVersion: "newsletter-v1" })
      .onConflictDoNothing();
    return { message: "Adres jest zapisany na liście newslettera." };
  } catch {
    return { error: "Newsletter jest chwilowo niedostępny." };
  }
}
export async function contactShop(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const parsed = contactMessage.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!hasDb) return { error: "Formularz jest chwilowo niedostępny." };
  try {
    if (!(await rateLimit(`contact:${requestIP(await headers())}`, 10, 60)))
      return { error: "Spróbuj ponownie później." };
    await db().transaction(async (tx) => {
      const [record] = await tx
        .insert(messages)
        .values(parsed.data)
        .returning();
      if (process.env.CONTACT_NOTIFICATION_EMAIL)
        await queueMail(
          tx,
          `contact:${record.id}`,
          process.env.CONTACT_NOTIFICATION_EMAIL,
          "Nowe zgłoszenie w NEXORA",
          "W panelu wiadomości oczekuje nowe zgłoszenie.",
        );
    });
    return { message: "Wiadomość została zapisana. Dziękujemy za kontakt." };
  } catch {
    return { error: "Wysyłka chwilowo niedostępna." };
  }
}
