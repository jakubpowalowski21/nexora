import { eq } from "drizzle-orm";
import { db, hasDb } from "@/src/db";
import { uploadedImages } from "@/src/db/schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  const digest = /^([a-f0-9]{64})\.webp$/.exec(asset)?.[1];
  if (!digest || !hasDb) return new Response(null, { status: 404 });

  const [image] = await db()
    .select({ bytes: uploadedImages.bytes })
    .from(uploadedImages)
    .where(eq(uploadedImages.digest, digest))
    .limit(1);
  if (!image) return new Response(null, { status: 404 });

  const etag = `"${digest}"`;
  const headers = {
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(new Uint8Array(image.bytes), { headers });
}
