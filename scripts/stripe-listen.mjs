import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const key = process.env.STRIPE_SECRET_KEY;
if (!/^(?:sk|rk)_test_/.test(key ?? "")) {
  console.error("Ustaw klucz testowy w STRIPE_SECRET_KEY w pliku .env.local.");
  process.exit(1);
}

const port = process.env.NEXORA_STRIPE_PORT ?? "3000";
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error("NEXORA_STRIPE_PORT musi być poprawnym numerem portu.");
  process.exit(1);
}

const windowsCli = resolve(".stripe-cli", "stripe.exe");
const binary =
  process.platform === "win32" && existsSync(windowsCli)
    ? windowsCli
    : "stripe";
const events = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "charge.refunded",
];
const args = [
  "listen",
  "--events",
  events.join(","),
  "--forward-to",
  `http://localhost:${port}/api/webhooks/stripe`,
];
const env = { ...process.env, STRIPE_API_KEY: key };
const signing = spawnSync(binary, [...args, "--print-secret"], {
  env,
  encoding: "utf8",
  timeout: 25_000,
  windowsHide: true,
});
const secret = signing.stdout?.match(/\bwhsec_[a-zA-Z0-9]+\b/)?.[0];
if (signing.error?.code === "ENOENT") {
  console.error(
    "Zainstaluj oficjalne Stripe CLI lub umieść stripe.exe w .stripe-cli.",
  );
  process.exit(1);
}
if (signing.status !== 0 || !secret) {
  console.error(
    "Nie udało się pobrać sekretu webhooka. Sprawdź testowy klucz API i połączenie ze Stripe.",
  );
  process.exit(1);
}

const file = resolve(".env.local");
const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
const entry = /^\s*STRIPE_WEBHOOK_SECRET[ \t]*=.*$/m;
const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
if (!previous.split(/\r?\n/).includes(line)) {
  const updated = entry.test(previous)
    ? previous.replace(entry, line)
    : `${previous.trimEnd()}${previous ? "\n" : ""}${line}\n`;
  writeFileSync(file, updated, "utf8");
  console.log(
    "Zapisano sekret w .env.local. Jeżeli sklep jest uruchomiony, wczytaj ponownie konfigurację.",
  );
}

const listener = spawn(binary, args, {
  env,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
for (const [source, destination] of [
  [listener.stdout, process.stdout],
  [listener.stderr, process.stderr],
]) {
  source.setEncoding("utf8");
  // Buffer complete lines so a signing secret split across chunks is redacted.
  let buffer = "";
  source.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const entry of lines)
      destination.write(
        `${entry.replace(/\b(?:whsec|sk_test|rk_test)_[a-zA-Z0-9]+\b/g, "[sekret]")}\n`,
      );
  });
}
listener.on("error", () => {
  console.error("Nie udało się uruchomić lokalnego nasłuchu Stripe.");
  process.exitCode = 1;
});
listener.on("exit", (code, signal) => {
  process.exitCode =
    code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => listener.kill());
}
