import { z } from "zod";
import { currentPrice, getProductsById } from "@/src/features/catalog/data";
const input = z.object({ ids: z.array(z.string().max(80)).max(100) });
export async function POST(req: Request) {
  const data = input.safeParse(await req.json().catch(() => null));
  if (!data.success) return Response.json([], { status: 400 });
  return Response.json(
    (await getProductsById(data.data.ids)).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.images[0]?.url || "/media/audio.webp",
      variant: p.variants[0]?.id,
      stock: p.variants[0]?.stock || 0,
      price: p.variants[0] ? currentPrice(p.variants[0]) : 0,
    })),
  );
}
