import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/src/lib/auth";
import { orderDetails, orderNumber } from "@/src/features/orders/service";
import { cancelGuestOrder } from "@/src/features/account/actions";
import { OrderInformation } from "@/src/components/account/order-table";
import { ActionForm } from "@/src/components/ui/forms";
import { fulfillmentLabels } from "@/src/lib/format";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireCustomer(),
    detail = await orderDetails(id, { userId: user.id });
  if (!detail) notFound();
  return (
    <>
      <div className="page-heading">
        <h1>{orderNumber(detail.order)}</h1>
        <p>{fulfillmentLabels[detail.order.fulfillment]}</p>
      </div>
      {detail.order.payment === "pending" &&
        detail.order.fulfillment === "new" && (
          <ActionForm
            action={cancelGuestOrder}
            submit="Anuluj zamówienie"
            variant="secondary"
          >
            <input type="hidden" name="id" value={id} />
          </ActionForm>
        )}
      <OrderInformation detail={detail} />
    </>
  );
}
