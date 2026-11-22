import { and, asc, isNull, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, type Transaction } from "@/src/db";
import { outbox } from "@/src/db/schema";
import { siteUrl } from "@/src/lib/format";
import { smtpConfig } from "@/src/lib/mail-config";

export async function queueMail(
  tx: Transaction,
  key: string,
  to: string,
  subject: string,
  body: string,
) {
  await tx
    .insert(outbox)
    .values({ key, to, subject, body })
    .onConflictDoNothing();
}

export async function deliverOutbox() {
  const config = smtpConfig();
  if (!config) return 0;
  const entries = await db().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outbox)
      .where(and(isNull(outbox.sentAt), lte(outbox.nextAt, new Date())))
      .orderBy(asc(outbox.nextAt))
      .limit(12)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      await tx
        .update(outbox)
        .set({
          attempts: row.attempts + 1,
          nextAt: new Date(
            Date.now() + Math.min(360, Math.pow(2, row.attempts) * 2) * 60_000,
          ),
        })
        .where(sql`${outbox.id} = ${row.id}`);
    }
    return rows;
  });
  if (!entries.length) return 0;
  const transport = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 6_000,
    greetingTimeout: 6_000,
    socketTimeout: 10_000,
  });
  const hostname = new URL(siteUrl()).hostname;
  try {
    await Promise.all(
      entries.map(async (mail) => {
        try {
          await transport.sendMail({
            from: config.from,
            to: mail.to,
            subject: mail.subject,
            text: mail.body,
            messageId: `<${mail.id}@${hostname}>`,
          });
          await db()
            .update(outbox)
            .set({ sentAt: new Date() })
            .where(sql`${outbox.id} = ${mail.id}`);
        } catch {
          console.warn("NEXORA: dostawa SMTP zostanie ponowiona.");
        }
      }),
    );
  } finally {
    transport.close();
  }
  return entries.length;
}
