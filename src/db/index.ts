import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
const singleton = globalThis as typeof globalThis & { nexoraPool?: Pool };

export const hasDb = !!connectionString;

export function db() {
  if (!connectionString)
    throw new Error("Brakuje konfiguracji PostgreSQL. Zobacz README.");
  if (!singleton.nexoraPool) {
    singleton.nexoraPool = new Pool({
      connectionString,
      max: 8,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 12000,
    });
    singleton.nexoraPool.on("error", () =>
      console.error("NEXORA: przerwano bezczynne połączenie PostgreSQL."),
    );
    if (process.env.VERCEL) attachDatabasePool(singleton.nexoraPool);
  }
  return drizzle(singleton.nexoraPool, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof db>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function closeDb() {
  await singleton.nexoraPool?.end();
  delete singleton.nexoraPool;
}
