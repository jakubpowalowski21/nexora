import { AuthPage } from "@/src/components/account/auth-page";
export const metadata = { title: "Zaloguj się", robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ powrot?: string }>;
}) {
  return <AuthPage kind="login" returnTo={(await searchParams).powrot} />;
}
