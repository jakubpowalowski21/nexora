import { Header } from "@/src/components/layout/header";
import { Footer } from "@/src/components/layout/footer";
import { CommerceProvider } from "@/src/features/cart/client";
export const dynamic = "force-dynamic";
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommerceProvider>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </CommerceProvider>
  );
}
