import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
loadEnvConfig(process.cwd(), true);
async function main() {
  const { db, closeDb } = await import("@/src/db");
  const {
    categories,
    brands,
    products,
    variants,
    images,
    inventory,
    reviews,
    coupons,
    settings,
    users,
  } = await import("@/src/db/schema");
  const { demoCategories, demoProducts, demoReviews, defaultSettings } =
    await import("@/src/features/catalog/demo");
  const { hashPassword } = await import("@/src/features/account/security");
  try {
    await db().transaction(async (tx) => {
      await tx.insert(categories).values(demoCategories).onConflictDoNothing();
      await tx
        .insert(brands)
        .values(
          [...new Set(demoProducts.map((p) => p.brand))].map((name) => ({
            name,
          })),
        )
        .onConflictDoNothing();
      for (const entry of demoProducts) {
        const {
          variants: list,
          images: photos,
          rating,
          reviewCount,
          sold,
          ...product
        } = entry;
        void rating;
        void reviewCount;
        void sold;
        const [inserted] = await tx
          .insert(products)
          .values(product)
          .onConflictDoNothing()
          .returning({ id: products.id });
        if (!inserted) {
          const original = demoCategories.find((category) => category.id === product.categoryId)?.image;
          if (original && photos[0].url !== original) {
            await tx.update(images).set({ url: photos[0].url }).where(and(
              eq(images.productId, product.id), eq(images.position, 0), eq(images.url, original), eq(images.alt, product.name),
            ));
            for (const variant of list) {
              await tx.update(variants).set({image: variant.image}).where(and(eq(variants.id, variant.id), eq(variants.image, original)));
            }
          }
          continue;
        }
        await tx
          .insert(images)
          .values(photos.map((photo) => ({ ...photo, productId: product.id })));
        for (const { stock, ...variant } of list) {
          await tx.insert(variants).values(variant);
          await tx.insert(inventory).values({ variantId: variant.id, stock });
        }
      }
      for (const sample of demoReviews) {
        const [exists] = await tx
          .select({ id: reviews.id })
          .from(reviews)
          .where(
            and(
              eq(reviews.productId, sample.productId),
              eq(reviews.sample, true),
              eq(reviews.title, sample.title),
            ),
          );
        if (!exists)
          await tx.insert(reviews).values({ ...sample, id: undefined });
      }
      await tx
        .insert(coupons)
        .values({
          code: "NEXORA10",
          kind: "percent",
          value: 10,
          minimum: 20000,
          stack: true,
        })
        .onConflictDoNothing();
      await tx.insert(settings).values(defaultSettings).onConflictDoNothing();
    });
    console.log(
      "Katalog demo gotowy: 48 produktów, 6 kategorii i kod NEXORA10.",
    );
    if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
      const admin = z
        .object({
          email: z.email().transform((v) => v.toLowerCase()),
          password: z.string().min(14).max(128),
        })
        .parse({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        });
      const [inserted] = await db()
        .insert(users)
        .values({
          email: admin.email,
          name: "Administrator NEXORA",
          role: "admin",
          verifiedAt: new Date(),
          passwordHash: await hashPassword(admin.password),
        })
        .onConflictDoNothing()
        .returning({ id: users.id });
      console.log(
        inserted
          ? "Utworzono zweryfikowane konto administratora."
          : "Adres administratora istnieje. Pominięto zmianę istniejącego konta.",
      );
    }
  } finally {
    await closeDb();
  }
}
main().catch((error) => {
  console.error(
    "Seed nie powiódł się:",
    error.cause?.code || error.code || error.name,
  );
  process.exitCode = 1;
});
