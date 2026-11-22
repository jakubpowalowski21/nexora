export function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM?.trim() || user;

  if (
    !host ||
    !user ||
    !pass ||
    !from ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return undefined;
  }

  return { host, port, user, pass, from };
}
