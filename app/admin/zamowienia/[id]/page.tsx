import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/auth";
import { orderDetails, orderNumber } from "@/src/features/orders/service";
import { notifyOrder, updateOrder } from "@/src/features/admin/actions";
import { OrderInformation } from "@/src/components/account/order-table";
import { ActionForm } from "@/src/components/ui/forms";
import { date, fulfillmentLabels, paymentLabels } from "@/src/lib/format";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await orderDetails(id, { admin: true });
  if (!detail) notFound();
  const { order } = detail;
  const available =
    order.payment === "pending" && order.fulfillment === "new"
      ? [
          ...(order.paymentMethod === "transfer"
            ? [["paid", "Potwierdź przelew demonstracyjny"]]
            : []),
          ["cancelled", "Anuluj zamówienie"],
        ]
      : ["paid", "partially_refunded"].includes(order.payment)
        ? [
            ...(order.fulfillment === "new"
              ? [["processing", "Rozpocznij realizację"]]
              : order.fulfillment === "processing"
                ? [["shipped", "Oznacz jako wysłane"]]
                : order.fulfillment === "shipped"
                  ? [["delivered", "Oznacz jako dostarczone"]]
                  : []),
            ["refund", "Zwróć pozostałą kwotę"],
          ]
        : [];
  return (
    <>
      <div className="page-heading">
        <h1>{orderNumber(order)}</h1>
        <p>
          {date(order.createdAt)} · {paymentLabels[order.payment]} ·{" "}
          {fulfillmentLabels[order.fulfillment]}
        </p>
      </div>
      <section className="panel">
        <h2>Obsługa zamówienia</h2>
        {available.length > 0 && (
          <ActionForm action={updateOrder} submit="Zapisz zmianę">
            <input type="hidden" name="id" value={id} />
            <div className="form-grid">
              <label>
                Operacja
                <select name="action">
                  {available.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {available.some(([action]) => action === "shipped") && (
                <label>
                  Numer przesyłki
                  <input name="tracking" maxLength={100} />
                </label>
              )}
            </div>
          </ActionForm>
        )}
        <ActionForm
          action={notifyOrder}
          submit="Powiadom klienta"
          variant="secondary"
        >
          <input type="hidden" name="id" value={id} />
        </ActionForm>
      </section>
      <OrderInformation detail={detail} />
    </>
  );
}
