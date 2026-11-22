import { searchSuggestions } from "@/src/features/catalog/data";

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams
    .get("q")
    ?.trim()
    .slice(0, 120);
  if (!value || value.length < 2) return Response.json([]);
  return Response.json(await searchSuggestions(value));
}
