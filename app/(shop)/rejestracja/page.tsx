import { AuthPage } from "@/src/components/account/auth-page";
export const metadata = { title: "Rejestracja", robots: { index: false } };
export default function Page() {
  return <AuthPage kind="register" />;
}
