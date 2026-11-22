import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, type Transaction } from "@/src/db";
import { rateLimits, tokens, users } from "@/src/db/schema";

const derive = promisify(scrypt);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const value = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${value.toString("hex")}`;
}
export async function checkPassword(password: string, stored?: string) {
  const [, salt, raw] = stored?.split(":") || [];
  const value = (await derive(
    password,
    salt || "nexora-invalid-account",
    64,
  )) as Buffer;
  return !!raw && timingSafeEqual(value, Buffer.from(raw, "hex"));
}
export async function rateLimit(key: string, max: number, minutes = 15) {
  const now = new Date();
  const until = new Date(now.getTime() + minutes * 60_000);
  const [row] = await db()
    .insert(rateLimits)
    .values({ key: hash(key), count: 1, until })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.until} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
        until: sql`case when ${rateLimits.until} <= ${now} then ${until} else ${rateLimits.until} end`,
      },
    })
    .returning();
  return row.count <= max;
}
export async function makeToken(
  tx: Transaction,
  userId: string,
  type: "verify" | "reset" | "change",
  targetEmail?: string,
) {
  const raw = randomBytes(32).toString("base64url");
  await tx
    .insert(tokens)
    .values({
      hash: hash(raw),
      userId,
      type,
      targetEmail,
      expiresAt: new Date(Date.now() + (type === "verify" ? 24 : 1) * 3600_000),
    });
  return raw;
}
export async function consumeToken(tx: Transaction, raw: string, type: string) {
  const digest = hash(raw);
  const [candidate] = await tx
    .select({ userId: tokens.userId })
    .from(tokens)
    .where(and(eq(tokens.hash, digest), eq(tokens.type, type)));
  if (!candidate) return;
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, candidate.userId))
    .for("update");
  const [record] = await tx
    .delete(tokens)
    .where(
      and(
        eq(tokens.hash, digest),
        eq(tokens.type, type),
        gt(tokens.expiresAt, new Date()),
      ),
    )
    .returning();
  return record;
}
export function requestIP(headers: Headers) {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "localhost"
      : headers.get("x-real-ip")?.slice(0, 100) || "unknown")
  );
}
