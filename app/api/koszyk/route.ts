import { quote, OrderError } from "@/src/features/orders/quote";
import { viewer } from "@/src/lib/auth";
import { quoteInput } from "@/src/lib/validation";

export async function POST(request: Request) {
  const result = quoteInput.safeParse(await request.json().catch(() => null));
  if (!result.success)
    return Response.json(
      { error: "Sprawdź pozycje koszyka." },
      { status: 400 },
    );
  try {
    const user = await viewer();
    return Response.json(await quote(result.data, user?.email));
  } catch (error) {
    if (error instanceof OrderError)
      return Response.json({ error: error.message }, { status: 400 });
    const code =
      (error as { code?: string; cause?: { code?: string } }).cause?.code ||
      (error as { code?: string }).code;
    if (
      !process.env.VERCEL &&
      [
        "42P01",
        "EAI_AGAIN",
        "ENOTFOUND",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "EACCES",
        "ECONNRESET",
      ].includes(code || "")
    ) {
      return Response.json(
        await quote(result.data, undefined, undefined, true),
      );
    }
    return Response.json(
      { error: "Nie udało się przeliczyć koszyka. Spróbuj ponownie." },
      { status: 503 },
    );
  }
}
