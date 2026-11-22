import Link from "next/link";
import { ChevronRight } from "lucide-react";
export function Breadcrumbs({
  items,
}: {
  items: { name: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Ścieżka nawigacji">
      <ol>
        <li>
          <Link href="/">Strona główna</Link>
        </li>
        {items.map(({ name, href }) => (
          <li key={name}>
            <ChevronRight size={14} />
            {href ? (
              <Link href={href}>{name}</Link>
            ) : (
              <span aria-current="page">{name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
