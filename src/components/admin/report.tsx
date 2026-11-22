import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth";
import { dateRange, overview, report } from "@/src/features/admin/reports";
import { fulfillmentLabels, money } from "@/src/lib/format";
import { OrderTable } from "@/src/components/account/order-table";
import { Button } from "@/src/components/ui/button";

export async function ReportPage({
  query,
  full = false,
}: {
  query: { okres?: string; od?: string; do?: string };
  full?: boolean;
}) {
  await requireAdmin();
  const range = dateRange(query);
  const [stats, store] = await Promise.all([
    report(range),
    full ? Promise.resolve(null) : overview(),
  ]);
  const max = Math.max(1, ...stats.chart.map((row) => row.revenue));
  const base = full ? "/admin/statystyki" : "/admin";
  return (
    <>
      <div className="section-heading">
        <div className="page-heading">
          <h1>{full ? "Statystyki" : "Przegląd sklepu"}</h1>
          <p>
            Wyniki od {range.from} do {range.to}.
          </p>
        </div>
        {full && (
          <Button asChild variant="secondary">
            <Link href={`/api/admin/raport?od=${range.from}&do=${range.to}`}>
              Pobierz CSV
            </Link>
          </Button>
        )}
      </div>
      <div className="actions-row">
        {[
          ["1", "Dzisiaj"],
          ["7", "7 dni"],
          ["30", "30 dni"],
        ].map(([value, label]) => (
          <Button asChild variant="secondary" size="small" key={value}>
            <Link href={`${base}?okres=${value}`}>{label}</Link>
          </Button>
        ))}
      </div>
      <form action={base} className="admin-query dashboard-gap">
        <label>
          Od
          <input type="date" name="od" defaultValue={range.from} required />
        </label>
        <label>
          Do
          <input type="date" name="do" defaultValue={range.to} required />
        </label>
        <Button type="submit">Pokaż okres</Button>
      </form>
      <div className="metrics">
        {[
          ["Przychód po zwrotach", money(stats.revenue)],
          ["Złożone zamówienia", stats.count],
          ["Nowi klienci", stats.newCustomers],
          ["Średnia wartość zakupu", money(stats.average)],
        ].map(([label, value]) => (
          <div className="panel metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel dashboard-gap">
        <h2>Przychód dzienny</h2>
        {stats.chart.length ? (
          <div className="bar-chart" aria-label="Wykres przychodu dziennego">
            {stats.chart.map((row) => (
              <div
                key={row.day}
                title={`${row.day}: ${money(row.revenue)}`}
                aria-label={`${row.day}, ${money(row.revenue)}`}
              >
                <span
                  style={{ height: Math.max(2, (row.revenue / max) * 125) }}
                />
                <small>{row.day.slice(5)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>Brak płatności w tym okresie.</p>
        )}
      </section>
      <div className="detail-sections">
        <section className="panel">
          <h2>Najczęściej kupowane produkty</h2>
          {stats.top.length ? (
            <ol className="history">
              {stats.top.map((p) => (
                <li key={p.id}>
                  <Link
                    className="text-link"
                    href={`/admin/produkty/${p.id}/edytuj`}
                  >
                    {p.name}
                  </Link>
                  <small>{p.quantity} szt.</small>
                </li>
              ))}
            </ol>
          ) : (
            <p>Brak opłaconych zamówień.</p>
          )}
        </section>
        {store && (
          <>
            <section className="panel">
              <h2>Niski stan magazynowy</h2>
              {store.low.length ? (
                <ul className="history">
                  {store.low.map((row) => (
                    <li key={row.id}>
                      {row.name} · {row.variant}
                      <small>{row.available} szt.</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Wszystkie dostępne warianty są powyżej progu.</p>
              )}
            </section>
            <section className="panel">
              <h2>Zgłoszenia do obsługi</h2>
              <Link className="text-link" href="/admin/wiadomosci">
                Otwarte zgłoszenia ({store.tickets})
              </Link>
            </section>
            <h2>Ostatnie zamówienia</h2>
            <OrderTable rows={store.recent} admin />
          </>
        )}
        {full && (
          <>
            <section className="panel">
              <h2>Sprzedaż wg kategorii</h2>
              <p className="subtle">
                Wartość pozycji przed rabatami koszykowymi i częściowymi
                zwrotami.
              </p>
              <ul className="history">
                {stats.byCategory.map((c) => (
                  <li key={c.name}>
                    <span>
                      {c.name} · {c.quantity} szt.
                    </span>
                    <strong>{money(c.value)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2>Statusy zamówień</h2>
              <ul className="history">
                {stats.statuses.map((s) => (
                  <li key={s.status}>
                    {fulfillmentLabels[s.status]}
                    <strong>{s.count}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2>Użycie kodów rabatowych</h2>
              {stats.discounts.length ? (
                <ul className="history">
                  {stats.discounts.map((d) => (
                    <li key={d.code}>
                      {d.code}
                      <strong>{d.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Brak użyć.</p>
              )}
            </section>
            <section className="panel">
              <h2>Kupujący</h2>
              <div className="price-row">
                <span>Nowi</span>
                <strong>{stats.newBuyers}</strong>
              </div>
              <div className="price-row">
                <span>Powracający</span>
                <strong>{stats.returningBuyers}</strong>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
