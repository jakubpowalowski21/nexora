import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "./globals.css";
import "./pages.css";
import { siteUrl } from "@/src/lib/format";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "NEXORA — Premium Tech Store", template: "%s | NEXORA" },
  description:
    "Elektronika i akcesoria do pracy, grania i odpoczynku. Audio, klawiatury, myszy, monitory i więcej.",
  openGraph: { siteName: "NEXORA", locale: "pl_PL", type: "website" },
  referrer: "strict-origin-when-cross-origin",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>
        <a className="skip" href="#main">
          Przejdź do treści
        </a>
        {children}
      </body>
    </html>
  );
}
