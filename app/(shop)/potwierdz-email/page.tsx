import { AuthPage } from "@/src/components/account/auth-page";
export const metadata = {
  title: "Potwierdź adres e-mail",
  robots: { index: false },
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <AuthPage kind="verify" token={(await searchParams).token} />;
}
