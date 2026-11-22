import Link from "next/link";
import type { orders } from "@/src/db/schema";
import {
  date,
  fulfillmentLabels,
  money,
  paymentLabels,
} from "@/src/lib/format";
import { orderNumber } from "@/src/features/orders/service";
export function OrderTable({
  rows,
  admin = false,
}: {
  rows: (typeof orders.$inferSelect)[];
  admin?: boolean;
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Zamówienie</th>
            {admin && <th scope="col">E-mail</th>}
            <th scope="col">Data</th>
            <th scope="col">Kwota</th>
            <th scope="col">Płatność</th>
            <th scope="col">Realizacja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/${admin ? "admin" : "konto"}/zamowienia/${o.id}`}>
                  {orderNumber(o)}
                </Link>
              </td>
              {admin && <td>{o.email}</td>}
              <td>{date(o.createdAt)}</td>
              <td>{money(o.total)}</td>
              <td>
                <span
                  className={`badge ${o.payment === "paid" ? "badge-positive" : ""}`}
                >
                  {paymentLabels[o.payment]}
                </span>
              </td>
              <td>{fulfillmentLabels[o.fulfillment]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="panel">
      <p>Nie ma jeszcze zamówień do wyświetlenia.</p>
    </div>
  );
}
export function OrderInformation({
  detail,
}: {
  detail: NonNullable<
    Awaited<
      ReturnType<typeof import("@/src/features/orders/service").orderDetails>
    >
  >;
}) {
  const { order, items, history, shipment } = detail;
  return (
    <div className="detail-sections">
      <section className="panel">
        <h2>Pozycje zamówienia</h2>
        <div className="order-lines-mini">
          {items.map((i) => (
            <div className="price-row" key={i.id}>
              <span>
                {i.name} · {i.variant}
                <small>
                  {i.sku} · {i.quantity} × {money(i.unitPrice)}
                </small>
              </span>
              <strong>{money(i.quantity * i.unitPrice)}</strong>
            </div>
          ))}
        </div>
        <div className="price-row">
          <span>Dostawa</span>
          <strong>{money(order.shippingCost)}</strong>
        </div>
        <div className="price-row">
          <span>Rabat</span>
          <strong>−{money(order.discount)}</strong>
        </div>
        <div className="price-row total">
          <span>Razem</span>
          <strong>{money(order.total)}</strong>
        </div>
        {order.refundedTotal > 0 && (
          <div className="price-row">
            <span>Zwrócona kwota</span>
            <strong>{money(order.refundedTotal)}</strong>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Dostawa i płatność</h2>
        <p>
          {order.address.name}
          <br />
          {order.address.street}
          <br />
          {order.address.zip} {order.address.city}, {order.address.country}
          <br />
          {order.address.phone}
          <br />
          {order.email}
        </p>
        {order.address.company && (
          <p>
            {order.address.company} {order.address.nip}
          </p>
        )}
        <p>
          {order.paymentMethod === "stripe"
            ? "Stripe test"
            : "Przelew demonstracyjny"}{" "}
          · {paymentLabels[order.payment]}
        </p>
        {shipment && (
          <p>
            Numer przesyłki <strong>{shipment.tracking}</strong>
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Historia</h2>
        <ol className="history">
          {history.map((event) => (
            <li key={event.id}>
              <span>{event.label}</span>
              <small>{date(event.createdAt)}</small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
