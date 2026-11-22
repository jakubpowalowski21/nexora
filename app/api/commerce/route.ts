import { z } from "zod";
import { viewer } from "@/src/lib/auth";
import { line } from "@/src/lib/validation";
import { commerceState, updateCommerce } from "@/src/features/cart/server";

const id = z.string().min(1).max(80);
const input = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("merge"),
    requestId: z.uuid(),
    items: z.array(line).max(80),
    favorites: z.array(id).max(100),
  }),
  z.object({
    op: z.literal("cart"),
    id,
    quantity: z.number().int().min(0).max(99),
    mode: z.enum(["add", "set"]),
  }),
  z.object({ op: z.literal("favorite"), id, enabled: z.boolean() }),
]);
export async function GET() {
  const user = await viewer();
  if (!user) return Response.json(null);
  return Response.json(await commerceState(user.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Wymagany jest JSON." }, { status: 415 });
  const user = await viewer();
  if (!user)
    return Response.json({ error: "Zaloguj się ponownie." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Nieprawidłowe dane koszyka." },
      { status: 400 },
    );
  try {
    return Response.json(await updateCommerce(user.id, parsed.data));
  } catch {
    return Response.json(
      { error: "Nie udało się zapisać zmiany. Sprawdź dostępność produktu." },
      { status: 409 },
    );
  }
}
