import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { orders, orderItems, returns } from "@/src/db/schema";
import { requireCustomer } from "@/src/lib/auth";
import { orderNumber } from "@/src/features/orders/service";
import { createReturn } from "@/src/features/account/actions";
import { ActionForm } from "@/src/components/ui/forms";
import { date } from "@/src/lib/format";
export default async function Page() {
  const user = await requireCustomer();
  const eligible = await db()
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, user.id),
        inArray(orders.payment, ["paid", "partially_refunded"]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(40);
  const items = eligible.length
    ? await db()
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            eligible.map((o) => o.id),
          ),
        )
    : [];
  const requests = await db()
    .select({ request: returns, order: orders })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .where(eq(orders.userId, user.id))
    .orderBy(desc(returns.createdAt));
  return (
    <>
      <div className="page-heading">
        <h1>Zwroty i reklamacje</h1>
      </div>
      <section className="panel">
        <h2>Moje zgłoszenia</h2>
        {requests.length ? (
          <ul className="history">
            {requests.map(({ request, order }) => (
              <li key={request.id}>
                <span>
                  {request.type === "return" ? "Zwrot" : "Reklamacja"} ·{" "}
                  {orderNumber(order)}
                </span>
                <small>
                  {date(request.createdAt)} ·{" "}
                  {
                    {
                      new: "Nowe",
                      processing: "W trakcie",
                      resolved: "Rozwiązane",
                    }[request.status]
                  }
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Brak zgłoszeń.</p>
        )}
      </section>
      <div className="detail-sections">
        {eligible.map((order) => (
          <details key={order.id} className="panel">
            <summary>Zgłoś sprawę dla {orderNumber(order)}</summary>
            <ActionForm action={createReturn} submit="Wyślij zgłoszenie">
              <input type="hidden" name="number" value={orderNumber(order)} />
              <label>
                Typ
                <select name="type">
                  <option value="return">Zwrot</option>
                  <option value="complaint">Reklamacja</option>
                </select>
              </label>
              <fieldset className="form-stack">
                <legend>Produkty</legend>
                {items
                  .filter((i) => i.orderId === order.id)
                  .map((i) => (
                    <label className="checkbox" key={i.id}>
                      <input type="checkbox" name="items" value={i.id} />
                      {i.name} · {i.variant}
                    </label>
                  ))}
              </fieldset>
              <label>
                Opis
                <textarea
                  name="body"
                  minLength={10}
                  maxLength={3000}
                  required
                />
              </label>
            </ActionForm>
          </details>
        ))}
      </div>
    </>
  );
}
