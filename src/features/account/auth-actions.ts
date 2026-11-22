"use server";

import { AuthError } from "next-auth";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, hasDb } from "@/src/db";
import { tokens, users } from "@/src/db/schema";
import { signIn, signOut, requireCustomer } from "@/src/lib/auth";
import { siteUrl } from "@/src/lib/format";
import { smtpConfig } from "@/src/lib/mail-config";
import {
  credentials,
  email,
  password,
  registration,
} from "@/src/lib/validation";
import { deliverOutbox, queueMail } from "@/src/features/mail/outbox";
import {
  checkPassword,
  consumeToken,
  hashPassword,
  makeToken,
  rateLimit,
  requestIP,
} from "./security";

export type FormState = { error?: string; message?: string };
const invalid = (error: z.ZodError): FormState => ({
  error: error.issues[0].message,
});
const mailLink = (route: string, token: string) =>
  `${siteUrl()}/${route}?token=${token}`;
const ready = () => hasDb && !!process.env.AUTH_SECRET;
const unavailable = {
  error: "Konta wymagają skonfigurowania bazy danych i AUTH_SECRET.",
};
const hiddenResponse = {
  message: "Jeśli podany adres może otrzymać wiadomość, wysłaliśmy instrukcje.",
};
const unavailableMail = {
  error: "Ta funkcja wymaga aktywnej wysyłki poczty.",
};

export async function login(_: FormState, data: FormData): Promise<FormState> {
  if (!ready()) return unavailable;
  const parsed = credentials.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(parsed.error);
  const target = String(data.get("returnTo") || "/konto");
  const redirectTo = /^\/(?:konto|admin|zamowienie)(?:\/[a-z0-9/-]*)?$/.test(
    target,
  )
    ? target
    : "/konto";
  try {
    await signIn("credentials", { ...parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        error:
          error.type === "CredentialsSignin"
            ? smtpConfig()
              ? "Sprawdź dane logowania i potwierdź adres e-mail. Przy wielu próbach odczekaj 15 minut."
              : "Sprawdź dane logowania. Przy wielu próbach odczekaj 15 minut."
            : "Logowanie jest chwilowo niedostępne.",
      };
    throw error;
  }
  return {};
}

export async function register(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  if (!ready()) return unavailable;
  const parsed = registration.safeParse({
    ...Object.fromEntries(data),
    terms: data.get("terms") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;
  const mailEnabled = !!smtpConfig();
  const ip = requestIP(await headers());
  if (!(await rateLimit(`register:${ip}`, 12, 60)))
    return { error: "Osiągnięto limit prób. Wróć za godzinę." };
  await db().transaction(async (tx) => {
    const passwordHash = await hashPassword(values.password);
    const [record] = await tx
      .insert(users)
      .values({ name: values.name, email: values.email, passwordHash })
      .onConflictDoNothing()
      .returning();
    if (!record || !mailEnabled) return;
    const token = await makeToken(tx, record.id, "verify");
    await queueMail(
      tx,
      `verify:${randomUUID()}`,
      record.email,
      "Potwierdź adres e-mail w NEXORA",
      `Potwierdź rejestrację w ciągu 24 godzin.\n\n${mailLink("potwierdz-email", token)}`,
    );
  });
  if (mailEnabled) {
    await deliverOutbox();
    return hiddenResponse;
  }
  return {
    message: "Jeśli adres był dostępny, konto demo jest gotowe do zalogowania.",
  };
}

export async function recover(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  if (!ready()) return unavailable;
  if (!smtpConfig()) return unavailableMail;
  const result = email.safeParse(data.get("email"));
  if (!result.success) return invalid(result.error);
  const ip = requestIP(await headers());
  if (
    !(await rateLimit(`recovery-ip:${ip}`, 20, 60)) ||
    !(await rateLimit(`recovery-mail:${result.data}`, 4, 60))
  )
    return hiddenResponse;
  await db().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(users)
      .where(eq(users.email, result.data))
      .for("update");
    if (!record) return;
    const token = await makeToken(tx, record.id, "reset");
    await queueMail(
      tx,
      `reset:${randomUUID()}`,
      record.email,
      "Ustaw nowe hasło w NEXORA",
      `Twój jednorazowy link.\n\n${mailLink("odzyskaj-haslo", token)}`,
    );
  });
  await deliverOutbox();
  return hiddenResponse;
}

export async function verify(_: FormState, data: FormData): Promise<FormState> {
  if (!ready()) return unavailable;
  const raw = String(data.get("token") || "");
  if (!/^[a-zA-Z0-9_-]{43}$/.test(raw)) return { error: "Nieprawidłowy link." };
  try {
    const ok = await db().transaction(async (tx) => {
      const record =
        (await consumeToken(tx, raw, "verify")) ||
        (await consumeToken(tx, raw, "change"));
      if (!record) return false;
      if (record.type === "change" && record.targetEmail) {
        await tx
          .update(users)
          .set({
            email: record.targetEmail,
            verifiedAt: new Date(),
            authVersion: sql`${users.authVersion}+1`,
          })
          .where(eq(users.id, record.userId));
        await tx.delete(tokens).where(eq(tokens.userId, record.userId));
      } else {
        await tx
          .update(users)
          .set({ verifiedAt: new Date() })
          .where(eq(users.id, record.userId));
        await tx
          .delete(tokens)
          .where(
            and(eq(tokens.userId, record.userId), eq(tokens.type, "verify")),
          );
      }
      return true;
    });
    return ok
      ? { message: "Adres został potwierdzony. Możesz się zalogować." }
      : { error: "Link wygasł lub został wcześniej użyty." };
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505")
      return { error: "Ten adres jest już używany." };
    return { error: "Nie udało się potwierdzić adresu." };
  }
}

export async function reset(_: FormState, data: FormData): Promise<FormState> {
  if (!ready()) return unavailable;
  const raw = String(data.get("token") || "");
  if (!/^[a-zA-Z0-9_-]{43}$/.test(raw)) return { error: "Nieprawidłowy link." };
  const pw = password.safeParse(data.get("password"));
  if (!pw.success) return invalid(pw.error);
  if (pw.data !== data.get("confirmation"))
    return { error: "Hasła nie są takie same." };
  const ip = requestIP(await headers());
  if (!(await rateLimit(`reset:${ip}`, 20, 60)))
    return { error: "Osiągnięto limit prób." };
  const ok = await db().transaction(async (tx) => {
    const record = await consumeToken(tx, raw, "reset");
    if (!record) return false;
    await tx
      .update(users)
      .set({
        passwordHash: await hashPassword(pw.data),
        verifiedAt: sql`coalesce(${users.verifiedAt}, now())`,
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, record.userId));
    await tx
      .delete(tokens)
      .where(and(eq(tokens.userId, record.userId), eq(tokens.type, "reset")));
    return true;
  });
  return ok
    ? { message: "Hasło zmieniono. Zaloguj się ponownie." }
    : { error: "Link wygasł lub został wcześniej użyty." };
}

export async function changePassword(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const pw = password.safeParse(data.get("password"));
  const old = z.string().min(1).max(128).safeParse(data.get("old"));
  if (!pw.success) return invalid(pw.error);
  if (!old.success || pw.data !== data.get("confirmation"))
    return { error: "Sprawdź wpisane hasła." };
  if (!(await rateLimit(`change-password:${user.id}`, 10)))
    return { error: "Osiągnięto limit prób." };
  const ok = await db().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .for("update");
    if (!(await checkPassword(old.data, record.passwordHash))) return false;
    await tx
      .update(users)
      .set({
        passwordHash: await hashPassword(pw.data),
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, user.id));
    await tx
      .delete(tokens)
      .where(and(eq(tokens.userId, user.id), eq(tokens.type, "reset")));
    return true;
  });
  if (!ok) return { error: "Obecne hasło jest nieprawidłowe." };
  await signOut({ redirectTo: "/logowanie" });
  return {};
}

export async function requestEmailChange(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  if (!smtpConfig()) return unavailableMail;
  const parsed = credentials.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.email === user.email)
    return { error: "Podaj nowy adres e-mail." };
  if (!(await rateLimit(`email-change:${user.id}`, 5, 60)))
    return { error: "Osiągnięto limit prób." };
  const changed = await db().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .for("update");
    if (
      !record ||
      record.authVersion !== user.version ||
      !(await checkPassword(parsed.data.password, record.passwordHash))
    )
      return false;
    await tx
      .delete(tokens)
      .where(and(eq(tokens.userId, user.id), eq(tokens.type, "change")));
    const token = await makeToken(tx, user.id, "change", parsed.data.email);
    await queueMail(
      tx,
      `change:${randomUUID()}`,
      parsed.data.email,
      "Potwierdź nowy adres e-mail w NEXORA",
      `Potwierdź zmianę adresu w ciągu godziny.\n\n${mailLink("potwierdz-email", token)}`,
    );
    return true;
  });
  if (!changed) return { error: "Sprawdź hasło do konta." };
  await deliverOutbox();
  return {
    message:
      "Link weryfikacyjny trafił na nowy adres. Po potwierdzeniu zaloguj się ponownie.",
  };
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
