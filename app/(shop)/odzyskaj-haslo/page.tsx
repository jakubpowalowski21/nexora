import { AuthPage } from "@/src/components/account/auth-page";
export const metadata = {
  title: "Odzyskaj hasło",
  robots: { index: false },
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <AuthPage kind="recover" token={(await searchParams).token} />;
}
