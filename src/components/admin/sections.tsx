import Link from "next/link";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  categories,
  coupons,
  inventory,
  messages,
  movements,
  orderItems,
  orders,
  products,
  returns,
  returnItems,
  reviews,
  users,
  variants,
} from "@/src/db/schema";
import { correctStock, saveCategory } from "@/src/features/admin/products";
import {
  moderateReview,
  promoteCategory,
  saveCoupon,
  saveSettings,
  updateTicket,
} from "@/src/features/admin/actions";
import { getSettings } from "@/src/features/catalog/data";
import { ActionForm } from "@/src/components/ui/forms";
import { Button } from "@/src/components/ui/button";
import { OrderTable } from "@/src/components/account/order-table";
import { date, money, shipping } from "@/src/lib/format";
import { orderNumber } from "@/src/features/orders/service";

export async function Categories() {
  const all = await db()
    .select()
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name));
  function editor(entry?: typeof categories.$inferSelect) {
    return (
      <ActionForm action={saveCategory} submit="Zapisz kategorię">
        {entry && <input name="id" type="hidden" value={entry.id} />}
        <div className="form-grid">
          <label>
            Nazwa
            <input
              name="name"
              defaultValue={entry?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              defaultValue={entry?.slug}
              required
              maxLength={96}
            />
          </label>
          <label>
            Zdjęcie
            <input
              name="image"
              defaultValue={entry?.image || "/media/audio.webp"}
              required
            />
          </label>
          <label>
            Kolejność
            <input
              name="position"
              type="number"
              min="0"
              max="9999"
              defaultValue={entry?.position || 0}
              required
            />
          </label>
          <label>
            Kategoria nadrzędna
            <select name="parentId" defaultValue={entry?.parentId || ""}>
              <option value="">Brak</option>
              {all
                .filter((c) => c.id !== entry?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Filtry specyfikacji (oddziel przecinkiem)
            <input
              name="facets"
              defaultValue={entry?.facets.join(", ")}
              maxLength={500}
            />
          </label>
        </div>
        <label>
          Opis
          <textarea
            name="description"
            defaultValue={entry?.description}
            required
            minLength={5}
            maxLength={400}
          />
        </label>
        <label className="checkbox">
          <input
            name="active"
            type="checkbox"
            defaultChecked={entry?.active ?? true}
          />
          Widoczna w sklepie
        </label>
      </ActionForm>
    );
  }
  return (
    <div className="detail-sections">
      <section className="panel">
        <h2>Dodaj kategorię</h2>
        {editor()}
      </section>
      {all.map((c) => (
        <details className="panel" key={c.id}>
          <summary>
            {c.name} · {c.active ? "Widoczna" : "Ukryta"}
          </summary>
          {editor(c)}
        </details>
      ))}
    </div>
  );
}

export async function Stock() {
  const available = sql<number>`${inventory.stock} - ${inventory.reserved}`;
  const [rows, history] = await Promise.all([
    db()
      .select({
        item: variants,
        product: products.name,
        stock: inventory.stock,
        reserved: inventory.reserved,
        available,
      })
      .from(inventory)
      .innerJoin(variants, eq(variants.id, inventory.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(variants.active, true))
      .orderBy(asc(available), asc(products.name))
      .limit(300),
    db()
      .select({ movement: movements, sku: variants.sku, admin: users.name })
      .from(movements)
      .innerJoin(variants, eq(variants.id, movements.variantId))
      .leftJoin(users, eq(movements.actorId, users.id))
      .orderBy(desc(movements.createdAt))
      .limit(45),
  ]);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Wariant</th>
              <th>Fizycznie</th>
              <th>Rezerwacje</th>
              <th>Dostępne</th>
              <th>Korekta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, product, stock, reserved, available }) => (
              <tr key={item.id}>
                <th scope="row">
                  {product} · {item.name}
                  <br />
                  <small>{item.sku}</small>
                </th>
                <td>{stock}</td>
                <td>{reserved}</td>
                <td>
                  <span
                    className={`badge ${available >= 5 ? "badge-positive" : ""}`}
                  >
                    {available}
                    {available < 5 ? " · Niski stan" : ""}
                  </span>
                </td>
                <td>
                  <details>
                    <summary>Skoryguj</summary>
                    <ActionForm action={correctStock} submit="Zapisz korektę">
                      <input type="hidden" name="id" value={item.id} />
                      <label>
                        Zmiana stanu
                        <input
                          type="number"
                          name="delta"
                          required
                          min={-500000}
                          max={500000}
                        />
                      </label>
                      <label>
                        Powód
                        <input
                          name="reason"
                          required
                          minLength={4}
                          maxLength={160}
                        />
                      </label>
                    </ActionForm>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="dashboard-gap">
        <h2>Ostatnie ruchy magazynowe</h2>
        <div className="table-wrap detail-sections">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>SKU</th>
                <th>Stan</th>
                <th>Rezerwacje</th>
                <th>Powód</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {history.map(({ movement: m, sku, admin }) => (
                <tr key={m.id}>
                  <td>{date(m.createdAt)}</td>
                  <td>{sku}</td>
                  <td>{m.delta}</td>
                  <td>{m.reservedDelta}</td>
                  <td>{m.reason}</td>
                  <td>{admin || "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length && (
            <p className="panel">Brak ruchów magazynowych.</p>
          )}
        </div>
      </section>
    </>
  );
}

export async function Promotions() {
  const [rows, all, items] = await Promise.all([
    db().select().from(coupons).orderBy(asc(coupons.code)),
    db()
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
    db()
      .select({ id: products.id, name: products.name })
      .from(products)
      .orderBy(asc(products.name))
      .limit(300),
  ]);
  function couponForm(c?: typeof coupons.$inferSelect) {
    return (
      <ActionForm action={saveCoupon} submit="Zapisz kod">
        <div className="form-grid">
          <label>
            Kod
            <input
              name="code"
              defaultValue={c?.code}
              readOnly={!!c}
              required
              pattern="[A-Za-z0-9-]{3,40}"
            />
          </label>
          <label>
            Typ
            <select name="kind" defaultValue={c?.kind || "percent"}>
              <option value="percent">Procentowy</option>
              <option value="fixed">Kwotowy</option>
            </select>
          </label>
          <label>
            Wartość (% lub gr)
            <input
              type="number"
              name="value"
              defaultValue={c?.value}
              required
              min={1}
            />
          </label>
          <label>
            Minimum koszyka (gr)
            <input
              type="number"
              name="minimum"
              defaultValue={c?.minimum ?? 0}
              required
              min={0}
            />
          </label>
          <label>
            Maksymalny rabat (gr)
            <input
              type="number"
              name="maximum"
              defaultValue={c?.maximum ?? ""}
              min={1}
            />
          </label>
          <label>
            Limit wszystkich użyć
            <input
              type="number"
              name="usageLimit"
              defaultValue={c?.usageLimit ?? ""}
              min={1}
            />
          </label>
          <label>
            Limit na adres e-mail
            <input
              type="number"
              name="customerLimit"
              defaultValue={c?.customerLimit ?? ""}
              min={1}
            />
          </label>
          <label>
            Ostatni dzień ważności
            <input
              type="date"
              name="expiresAt"
              defaultValue={
                c?.expiresAt
                  ? new Date(c.expiresAt.getTime() - 86400000)
                      .toISOString()
                      .slice(0, 10)
                  : ""
              }
            />
          </label>
          <label>
            Kategorie objęte kodem
            <select name="categoryIds" multiple defaultValue={c?.categoryIds}>
              {all.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Produkty objęte kodem
            <select name="productIds" multiple defaultValue={c?.productIds}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="subtle">
          Puste listy oznaczają, że kod obowiązuje w całym katalogu.
        </p>
        <label className="checkbox">
          <input
            name="active"
            type="checkbox"
            defaultChecked={c?.active ?? true}
          />
          Kod aktywny
        </label>
        <label className="checkbox">
          <input name="stack" type="checkbox" defaultChecked={c?.stack} />
          Obejmuje także przecenione pozycje
        </label>
      </ActionForm>
    );
  }
  return (
    <div className="detail-sections">
      <p>
        Przeceny produktów ustawisz w{" "}
        <Link className="text-link" href="/admin/produkty">
          edycji wariantów
        </Link>
        .
      </p>
      <section className="panel">
        <h2>Przecena kategorii</h2>
        <p className="subtle">
          Obejmuje aktywne warianty bez trwającej lub zaplanowanej przeceny.
        </p>
        <ActionForm action={promoteCategory} submit="Zastosuj przecenę">
          <div className="form-grid">
            <label>
              Kategoria
              <select name="id" required>
                <option value="">Wybierz kategorię</option>
                {all.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Obniżka (%)
              <input type="number" name="percent" min={1} max={90} required />
            </label>
            <label>
              Początek promocji
              <input type="date" name="start" />
            </label>
            <label>
              Ostatni dzień promocji
              <input type="date" name="end" />
            </label>
          </div>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Dodaj kod rabatowy</h2>
        {couponForm()}
      </section>
      {rows.map((c) => (
        <details className="panel" key={c.code}>
          <summary>
            {c.code} · {c.kind === "percent" ? `${c.value}%` : money(c.value)} ·{" "}
            {c.active ? "Aktywny" : "Wyłączony"}
          </summary>
          {couponForm(c)}
        </details>
      ))}
    </div>
  );
}
export async function Reviews() {
  const rows = await db()
    .select({ review: reviews, product: products.name, slug: products.slug })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .orderBy(asc(reviews.status), desc(reviews.createdAt))
    .limit(100);
  return (
    <div className="detail-sections">
      {!rows.length && <p>Brak opinii.</p>}
      {rows.map(({ review: r, product, slug }) => (
        <article className="panel" key={r.id}>
          <h2>
            {r.rating}/5 · {r.title}
          </h2>
          <p>{r.body}</p>
          <p className="subtle">
            {r.author} · {date(r.createdAt)} ·{" "}
            {r.sample ? "Przykładowa" : "Potwierdzony zakup"} ·{" "}
            <Link className="text-link" href={`/produkt/${slug}`}>
              {product}
            </Link>
          </p>
          <ActionForm
            action={moderateReview}
            submit="Zapisz status"
            variant="secondary"
          >
            <input type="hidden" name="id" value={r.id} />
            <label>
              Moderacja
              <select name="status" defaultValue={r.status}>
                <option value="pending">Oczekuje</option>
                <option value="published">Opublikowana</option>
                <option value="rejected">Odrzucona</option>
              </select>
            </label>
          </ActionForm>
        </article>
      ))}
    </div>
  );
}
const ticketLabels = {
  new: "Nowe",
  processing: "W trakcie",
  resolved: "Rozwiązane",
};
function ticketForm(
  id: string,
  kind: "message" | "return",
  status: keyof typeof ticketLabels,
) {
  return (
    <ActionForm
      action={updateTicket.bind(null, kind)}
      submit="Zapisz status"
      variant="secondary"
    >
      <input type="hidden" name="id" value={id} />
      <label>
        Status
        <select name="status" defaultValue={status}>
          {Object.entries(ticketLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </ActionForm>
  );
}
export async function Tickets() {
  const [inbox, requests] = await Promise.all([
    db()
      .select()
      .from(messages)
      .orderBy(asc(messages.status), desc(messages.createdAt))
      .limit(100),
    db()
      .select({
        ticket: returns,
        order: orders,
        positions: sql<
          string | null
        >`(select string_agg(${orderItems.name} || ' · ' || ${orderItems.variant}, ', ') from ${returnItems} join ${orderItems} on ${orderItems.id} = ${returnItems.itemId} where ${returnItems.returnId} = ${returns.id})`,
      })
      .from(returns)
      .innerJoin(orders, eq(orders.id, returns.orderId))
      .orderBy(asc(returns.status), desc(returns.createdAt))
      .limit(100),
  ]);
  return (
    <div className="detail-sections">
      <h2>Kontakt ze sklepem</h2>
      {!inbox.length && <p>Brak wiadomości.</p>}
      {inbox.map((m) => (
        <article className="panel" key={m.id}>
          <h2>{m.subject}</h2>
          <p className="subtle">
            {m.email} · {date(m.createdAt)}
          </p>
          <p className="whitespace-pre-wrap">{m.body}</p>
          {ticketForm(m.id, "message", m.status)}
        </article>
      ))}
      <h2>Zwroty i reklamacje</h2>
      {!requests.length && <p>Brak zgłoszeń.</p>}
      {requests.map(({ ticket: r, order, positions }) => (
        <article className="panel" key={r.id}>
          <h2>
            {r.type === "return" ? "Zwrot" : "Reklamacja"} ·{" "}
            {orderNumber(order)}
          </h2>
          <p>
            <Link className="text-link" href={`/admin/zamowienia/${order.id}`}>
              Otwórz zamówienie
            </Link>
          </p>
          <p className="subtle">
            {r.email} · {date(r.createdAt)}
            {positions && ` · ${positions}`}
          </p>
          <p className="whitespace-pre-wrap">{r.body}</p>
          {ticketForm(r.id, "return", r.status)}
        </article>
      ))}
    </div>
  );
}
export async function Settings() {
  const store = await getSettings();
  return (
    <section className="panel">
      <ActionForm action={saveSettings} submit="Zapisz ustawienia">
        <div className="form-grid">
          <label>
            Nazwa sklepu
            <input
              name="name"
              defaultValue={store.name}
              required
              maxLength={70}
            />
          </label>
          <label>
            Adres kontaktowy
            <input
              name="email"
              defaultValue={store.email}
              type="email"
              required
            />
          </label>
          <label>
            Próg darmowej dostawy (gr)
            <input
              name="freeShipping"
              defaultValue={store.freeShipping}
              type="number"
              min="0"
              max="1000000"
              required
            />
          </label>
          <label>
            Opis SEO
            <input name="seo" defaultValue={store.seo || ""} maxLength={200} />
          </label>
        </div>
        <label>
          Opis sklepu
          <textarea
            name="description"
            defaultValue={store.description}
            required
            maxLength={300}
          />
        </label>
        <label>
          Nagłówek strony głównej
          <input
            name="heroTitle"
            defaultValue={store.heroTitle}
            required
            maxLength={95}
          />
        </label>
        <label>
          Opis strony głównej
          <textarea
            name="heroText"
            defaultValue={store.heroText}
            required
            maxLength={350}
          />
        </label>
        <fieldset className="admin-form-group">
          <legend>Ceny dostawy (gr)</legend>
          <p className="subtle">Pozostaw puste pole, aby wyłączyć metodę.</p>
          <div className="form-grid">
            {shipping.map((m) => (
              <label key={m.id}>
                {m.name}
                <input
                  name={m.id}
                  type="number"
                  defaultValue={
                    store.shippingOptions.find((row) => row.id === m.id)
                      ?.price ?? ""
                  }
                  min={0}
                  max={100000}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="checkbox">
          <input
            name="newsletterEnabled"
            type="checkbox"
            defaultChecked={store.newsletterEnabled}
          />
          Przyjmuj zapisy na newsletter
        </label>
      </ActionForm>
    </section>
  );
}
export async function Customers({
  query,
}: {
  query: { q?: string; klient?: string };
}) {
  const q = typeof query.q === "string" ? query.q.slice(0, 120) : "";
  const rows = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      created: users.createdAt,
      purchases:
        sql<number>`(select count(*) from ${orders} where ${orders.userId} = ${users.id})`.mapWith(
          Number,
        ),
    })
    .from(users)
    .where(
      and(
        eq(users.role, "customer"),
        q
          ? sql`(${ilike(users.email, `%${q}%`)} or ${ilike(users.name, `%${q}%`)})`
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(160);
  const selected = rows.find((u) => u.id === query.klient);
  const [purchases, requests] = selected
    ? await Promise.all([
        db()
          .select()
          .from(orders)
          .where(eq(orders.userId, selected.id))
          .orderBy(desc(orders.createdAt))
          .limit(50),
        db()
          .select({
            id: returns.id,
            type: returns.type,
            createdAt: returns.createdAt,
            status: returns.status,
          })
          .from(returns)
          .innerJoin(orders, eq(orders.id, returns.orderId))
          .where(eq(orders.userId, selected.id))
          .orderBy(desc(returns.createdAt))
          .limit(30),
      ])
    : [[], []];
  return (
    <>
      <form className="admin-query">
        <label>
          Szukaj klienta
          <input name="q" defaultValue={q} />
        </label>
        <Button type="submit">Szukaj</Button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Klient</th>
              <th>E-mail</th>
              <th>Zarejestrowany</th>
              <th>Zamówienia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link
                    href={`/admin/klienci?${new URLSearchParams({ q, klient: u.id })}`}
                  >
                    {u.name}
                  </Link>
                </td>
                <td>{u.email}</td>
                <td>{date(u.created)}</td>
                <td>{u.purchases}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="panel">Brak wyników.</p>}
      </div>
      {selected && (
        <div className="detail-sections">
          <h2>{selected.name}</h2>
          <OrderTable rows={purchases} admin />
          <section className="panel">
            <h2>Zgłoszenia</h2>
            {requests.length ? (
              <ul className="history">
                {requests.map((r) => (
                  <li key={r.id}>
                    {r.type === "return" ? "Zwrot" : "Reklamacja"}
                    <small>
                      {date(r.createdAt)} · {ticketLabels[r.status]}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Brak zgłoszeń klienta.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
