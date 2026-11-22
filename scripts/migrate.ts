import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
loadEnvConfig(process.cwd(), true);
async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Skonfiguruj DATABASE_URL_UNPOOLED lub bezpośrednie DATABASE_URL.",
    );
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("Migracje NEXORA wykonane.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(
    "Migracja nie powiodła się:",
    error.cause?.code || error.code || error.message,
  );
  process.exitCode = 1;
});
