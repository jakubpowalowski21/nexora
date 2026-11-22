import type { MetadataRoute } from "next";
import { siteUrl } from "@/src/lib/format";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/konto",
        "/api",
        "/zamowienie",
        "/koszyk",
        "/logowanie",
        "/rejestracja",
        "/odzyskaj-haslo",
        "/potwierdz-email",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
