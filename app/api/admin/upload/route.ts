import { createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "@/src/db";
import { uploadedImages } from "@/src/db/schema";
import { viewer } from "@/src/lib/auth";

const maxUploadBytes = 3_000_000;
const formats = new Set(["jpeg", "png", "webp"]);

export async function POST(request: Request) {
  const user = await viewer();
  if (user?.role !== "admin") {
    return Response.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const file = (await request.formData().catch(() => null))?.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > maxUploadBytes
  ) {
    return Response.json(
      { error: "Wybierz zdjęcie JPEG, PNG lub WebP do 3 MB." },
      { status: 400 },
    );
  }

  let bytes: Buffer;
  try {
    const original = Buffer.from(await file.arrayBuffer());
    const image = sharp(original, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format || !formats.has(metadata.format)) {
      return Response.json(
        { error: "Dozwolone formaty to JPEG, PNG i WebP." },
        { status: 400 },
      );
    }
    bytes = await image
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return Response.json(
      {
        error:
          "Nie udało się odczytać obrazu. Maksymalna rozdzielczość to 25 megapikseli.",
      },
      { status: 400 },
    );
  }

  if (bytes.length > maxUploadBytes) {
    return Response.json(
      { error: "Obraz jest za duży po przetworzeniu." },
      { status: 400 },
    );
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  try {
    await db()
      .insert(uploadedImages)
      .values({ digest, bytes })
      .onConflictDoNothing();
    return Response.json({ url: `/media/uploads/${digest}.webp` });
  } catch {
    return Response.json(
      { error: "Nie udało się zapisać zdjęcia." },
      { status: 503 },
    );
  }
}
