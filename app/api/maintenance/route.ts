import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import { db } from "@/src/db";
import { rateLimits, tokens } from "@/src/db/schema";
import { expirePendingOrders } from "@/src/features/orders/service";
import { deliverOutbox } from "@/src/features/mail/outbox";

export const maxDuration = 60;
export async function GET(request: Request) {
  const configured = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${configured}`);
  if (
    !configured ||
    expected.length !== given.length ||
    !timingSafeEqual(expected, given)
  )
    return new Response("Unauthorized", { status: 401 });
  const [orders, mail] = await Promise.all([
    expirePendingOrders(),
    deliverOutbox(),
  ]);
  const now = new Date();
  await Promise.all([
    db().delete(rateLimits).where(lt(rateLimits.until, now)),
    db().delete(tokens).where(lt(tokens.expiresAt, now)),
  ]);
  return Response.json({ orders, mail });
}
