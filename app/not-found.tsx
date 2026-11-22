import Link from "next/link";
import { Button } from "@/src/components/ui/button";
export default function NotFound() {
  return (
    <section className="wrap page-space empty">
      <h1>Nie znaleziono strony</h1>
      <p>Adres mógł się zmienić lub strona jest już niedostępna.</p>
      <Button asChild>
        <Link href="/produkty">Przejdź do katalogu</Link>
      </Button>
    </section>
  );
}
