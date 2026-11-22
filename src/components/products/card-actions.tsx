"use client";
import { Heart, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { useCommerce } from "@/src/features/cart/client";
export function FavoriteButton({
  id,
  full = false,
}: {
  id: string;
  full?: boolean;
}) {
  const { favorites, favorite, ready } = useCommerce();
  const path = usePathname(),
    router = useRouter();
  const [failure, setFailure] = useState("");
  const selected = favorites.includes(id),
    label = selected ? "Usuń z ulubionych" : "Dodaj do ulubionych";
  return (
    <>
      <button
        type="button"
        className={
          full ? "button button-secondary" : "card-favorite icon-button"
        }
        aria-label={label}
        aria-pressed={selected}
        disabled={!ready}
        onClick={() =>
          favorite(id, !selected)
            .then(() => {
              setFailure("");
              if (path === "/konto/ulubione") router.refresh();
            })
            .catch((error) => setFailure(error.message))
        }
      >
        <Heart size={19} fill={selected ? "currentColor" : "none"} />
        {full && label}
      </button>
      {failure && (
        <span className="sr-only" role="alert">
          {failure}
        </span>
      )}
    </>
  );
}
export function AddToCart({
  id,
  stock,
  quantity = 1,
  compact = false,
}: {
  id: string;
  stock: number;
  quantity?: number;
  compact?: boolean;
}) {
  const { ready, change, setCartOpen } = useCommerce();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className={compact ? "compact-add" : "add-action"}>
      <Button
        type="button"
        variant={compact ? "secondary" : "primary"}
        size={compact ? "icon" : "default"}
        aria-label="Dodaj do koszyka"
        disabled={!ready || !stock || busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await change(id, quantity, "add", stock);
            setCartOpen(true);
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {compact ? (
          <Plus size={20} />
        ) : (
          <>
            <ShoppingBag size={19} />
            {stock ? "Dodaj do koszyka" : "Chwilowo niedostępny"}
          </>
        )}
      </Button>
      {message && (
        <span className="small-error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
