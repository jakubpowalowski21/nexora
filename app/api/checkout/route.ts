import { createOrder } from "@/src/features/orders/service";
import { OrderError } from "@/src/features/orders/quote";
import { checkoutInput } from "@/src/lib/validation";
import { viewer } from "@/src/lib/auth";
import { rateLimit, requestIP } from "@/src/features/account/security";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Wymagany jest JSON." }, { status: 415 });
  const parsed = checkoutInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  try {
    const user = await viewer();
    if (
      !(await rateLimit(
        `checkout:${user?.id || requestIP(request.headers)}`,
        24,
        60,
      ))
    )
      return Response.json(
        { error: "Zbyt wiele prób. Spróbuj później." },
        { status: 429 },
      );
    return Response.json(
      await createOrder(
        { ...parsed.data, email: user?.email || parsed.data.email },
        user?.id,
      ),
    );
  } catch (error) {
    if (error instanceof OrderError)
      return Response.json({ error: error.message }, { status: 409 });
    console.error(
      "NEXORA: nie udało się utworzyć zamówienia.",
      (error as { code?: string; cause?: { code?: string } }).cause?.code ||
        (error as { code?: string }).code ||
        "internal",
    );
    return Response.json(
      { error: "Nie udało się zapisać zamówienia. Spróbuj ponownie." },
      { status: 503 },
    );
  }
}
