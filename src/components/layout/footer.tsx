import Link from "next/link";
import { Code } from "lucide-react";
import { Brand } from "./brand";
import { getSettings } from "@/src/features/catalog/data";
const groups = [
  [
    "Zakupy",
    [
      ["Produkty", "/produkty"],
      ["Promocje", "/promocje"],
      ["Nowości", "/nowosci"],
    ],
  ],
  [
    "Pomoc",
    [
      ["Dostawa i płatności", "/dostawa-i-platnosci"],
      ["Zwroty i reklamacje", "/zwroty-i-reklamacje"],
      ["Kontakt", "/kontakt"],
    ],
  ],
  [
    "Informacje",
    [
      ["O nas", "/o-nas"],
      ["Regulamin", "/regulamin"],
      ["Polityka prywatności", "/polityka-prywatnosci"],
      ["Demo panelu", "/demo-admin"],
    ],
  ],
] as const;
export async function Footer() {
  const store = await getSettings();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Brand footer name={store.name} />
            <p>{store.description}</p>
            <a
              className="icon-button"
              href="https://github.com/jakubpowalowski21/nexora"
              aria-label="Repozytorium projektu NEXORA"
            >
              <Code size={19} />
            </a>
          </div>
          {groups.map(([heading, links]) => (
            <nav key={heading} aria-label={heading}>
              <h2>{heading}</h2>
              {links.map(([label, href]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="footer-base">
          <span>
            © {new Date().getFullYear()} {store.name}
          </span>
          <span>
            Projekt demonstracyjny. Produkty i zamówienia mają charakter
            przykładowy.
          </span>
        </div>
      </div>
    </footer>
  );
}
