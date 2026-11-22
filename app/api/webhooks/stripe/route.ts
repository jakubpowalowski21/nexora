import { processStripeEvent } from "@/src/features/orders/service";
import { getStripe } from "@/src/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret)
    return new Response("Integracja jest nieaktywna.", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Brak podpisu.", { status: 400 });
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("Niepoprawny podpis.", { status: 400 });
  }
  if (event.livemode)
    return new Response("Tylko tryb testowy.", { status: 400 });
  try {
    await processStripeEvent(event);
  } catch {
    return new Response("Przetwarzanie zostanie ponowione.", { status: 500 });
  }
  return Response.json({ received: true });
}
