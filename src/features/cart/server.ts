import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  cartItems,
  cartMerges,
  favorites,
  products,
  users,
} from "@/src/db/schema";
import { normalizeLines, purchasable } from "@/src/features/orders/quote";
import type { CartLine } from "@/src/lib/validation";

export async function commerceState(userId: string) {
  const [items, saved] = await Promise.all([
    db()
      .select({ id: cartItems.variantId, quantity: cartItems.quantity })
      .from(cartItems)
      .where(eq(cartItems.userId, userId)),
    db()
      .select({ id: favorites.productId })
      .from(favorites)
      .where(eq(favorites.userId, userId)),
  ]);
  return { items, favorites: saved.map((item) => item.id) };
}

export async function updateCommerce(
  userId: string,
  input:
    | { op: "merge"; requestId: string; items: CartLine[]; favorites: string[] }
    | { op: "cart"; id: string; quantity: number; mode: "add" | "set" }
    | { op: "favorite"; id: string; enabled: boolean },
) {
  await db().transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (input.op === "favorite") {
      if (!input.enabled)
        return tx
          .delete(favorites)
          .where(
            and(
              eq(favorites.userId, userId),
              eq(favorites.productId, input.id),
            ),
          );
      const [exists] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.id), eq(products.status, "active")));
      if (exists)
        await tx
          .insert(favorites)
          .values({ userId, productId: exists.id })
          .onConflictDoNothing();
      return;
    }
    if (input.op === "merge") {
      const [claim] = await tx
        .insert(cartMerges)
        .values({ userId, requestId: input.requestId })
        .onConflictDoNothing()
        .returning();
      if (!claim) return;
      const valid = input.favorites.length
        ? await tx
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                inArray(products.id, input.favorites),
                eq(products.status, "active"),
              ),
            )
        : [];
      if (valid.length)
        await tx
          .insert(favorites)
          .values(valid.map(({ id }) => ({ userId, productId: id })))
          .onConflictDoNothing();
    }
    const lines =
      input.op === "merge"
        ? normalizeLines(input.items)
        : [{ id: input.id, quantity: input.quantity }];
    const valid = await purchasable(lines, tx);
    for (const line of lines) {
      const cap = Math.min(
        99,
        valid.find((row) => row.variant.id === line.id)?.stock ?? 0,
      );
      const [current] = await tx
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.userId, userId), eq(cartItems.variantId, line.id)),
        )
        .for("update");
      const add = input.op === "merge" || input.mode === "add";
      const quantity = Math.min(
        cap,
        Math.max(0, line.quantity + (add ? current?.quantity || 0 : 0)),
      );
      if (
        input.op === "cart" &&
        line.quantity > 0 &&
        (!quantity || (add && quantity <= (current?.quantity || 0)))
      )
        throw new Error("Osiągnięto maksymalną dostępną ilość.");
      if (quantity) {
        await tx
          .insert(cartItems)
          .values({ userId, variantId: line.id, quantity })
          .onConflictDoUpdate({
            target: [cartItems.userId, cartItems.variantId],
            set: { quantity: sql`excluded.quantity` },
          });
      } else if (current) {
        await tx
          .delete(cartItems)
          .where(
            and(eq(cartItems.userId, userId), eq(cartItems.variantId, line.id)),
          );
      }
    }
  });
  return commerceState(userId);
}
