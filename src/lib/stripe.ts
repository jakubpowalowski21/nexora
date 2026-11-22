import Stripe from "stripe";

let client: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_") && !key?.startsWith("rk_test_"))
    return undefined;
  return (client ??= new Stripe(key, { timeout: 9000, maxNetworkRetries: 1 }));
}
