import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, CircleX } from "lucide-react";
import { z } from "zod";
import { viewer } from "@/src/lib/auth";
import { date, money, paymentLabels } from "@/src/lib/format";
import { orderDetails, orderNumber } from "@/src/features/orders/service";
import { Button } from "@/src/components/ui/button";
import { ActionForm } from "@/src/components/ui/forms";
import { cancelGuestOrder } from "@/src/features/account/actions";
import { ClearGuestCart } from "./checkout";
export async function Confirmation({
  params,
  failed,
}: {
  params: { id?: string; klucz?: string };
  failed?: boolean;
}) {
  if (!z.uuid().safeParse(params.id).success || !params.id) notFound();
  const user = await viewer();
  const result = await orderDetails(params.id, {
    userId: user?.id,
    token: params.klucz,
  });
  if (!result) notFound();
  const { order, items } = result;
  const paid = order.payment === "paid",
    transfer = order.paymentMethod === "transfer",
    cancelled = order.fulfillment === "cancelled";
  const heading =
    order.payment === "refunded"
      ? "Płatność zwrócona"
      : order.payment === "partially_refunded"
        ? "Płatność częściowo zwrócona"
        : cancelled
          ? "Zamówienie anulowane"
          : paid
            ? "Płatność potwierdzona"
            : failed
              ? "Płatność przerwana"
              : transfer
                ? "Zamówienie przyjęte"
                : "Czekamy na potwierdzenie płatności";
  const Icon =
    paid || (!cancelled && transfer)
      ? CheckCircle2
      : failed || cancelled
        ? CircleX
        : Clock3;
  return (
    <section className="wrap page-space">
      <div className="panel confirmation">
        <Icon size={43} />
        <h1>{heading}</h1>
        <p>
          {orderNumber(order)} · {date(order.createdAt)}
        </p>
        <div className="price-row">
          <span>Kwota zamówienia</span>
          <strong>{money(order.total)}</strong>
        </div>
        <div className="price-row">
          <span>Status płatności</span>
          <strong>{paymentLabels[order.payment]}</strong>
        </div>
        {transfer && !cancelled && (
          <p>To przelew demonstracyjny. Nie wysyłaj pieniędzy.</p>
        )}
        {order.payment === "pending" && !transfer && (
          <p>Po potwierdzeniu przez Stripe status pojawi się na tej stronie.</p>
        )}
        {!failed && (paid || (!cancelled && transfer)) && (
          <ClearGuestCart
            requestId={order.requestId}
            lines={items.map((item) => ({
              id: item.variantId,
              quantity: item.quantity,
            }))}
          />
        )}
        <div className="actions-row">
          <Button asChild>
            <Link href={failed ? "/koszyk" : "/produkty"}>
              {failed ? "Wróć do koszyka" : "Wróć do zakupów"}
            </Link>
          </Button>
          {!cancelled && order.payment === "pending" && (
            <Button asChild variant="secondary">
              <a
                href={`/zamowienie/sukces?id=${order.id}${params.klucz ? `&klucz=${encodeURIComponent(params.klucz)}` : ""}`}
              >
                Sprawdź status
              </a>
            </Button>
          )}
        </div>
        {order.payment === "pending" && order.fulfillment === "new" && (
          <ActionForm
            action={cancelGuestOrder}
            submit="Anuluj zamówienie"
            variant="secondary"
          >
            <input type="hidden" name="id" value={order.id} />
            {params.klucz && (
              <input type="hidden" name="token" value={params.klucz} />
            )}
          </ActionForm>
        )}
      </div>
    </section>
  );
}
