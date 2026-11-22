"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLine } from "@/src/lib/validation";
import type { Quote } from "@/src/features/orders/quote";
type State = { items: CartLine[]; favorites: string[] };
type Guest = State & { mergeId?: string };
const empty: State = { items: [], favorites: [] };
const guest = create<Guest>()(
  persist(() => empty, {
    name: "nexora-guest-v1",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);
type Commerce = State & {
  ready: boolean;
  signedIn: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  change: (
    id: string,
    quantity: number,
    mode: "add" | "set",
    cap: number,
  ) => Promise<void>;
  favorite: (id: string, enabled: boolean) => Promise<void>;
  clearGuest: (lines: CartLine[]) => void;
};
const context = createContext<Commerce | null>(null);
export const useCommerce = () => useContext(context)!;
async function send(data: unknown): Promise<State> {
  const res = await fetch("/api/commerce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Nie zapisano zmiany.");
  return result;
}
export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<State | null>(null);
  const [ready, setReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const local = guest();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const init = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (init.current) return;
    init.current = (async () => {
      try {
        await guest.persist.rehydrate();
        const response = await fetch("/api/commerce", { cache: "no-store" });
        if (!response.ok) return;
        const current = (await response.json()) as State | null;
        if (!current) return;
        setStored(current);
        const { items, favorites, mergeId } = guest.getState();
        if (items.length || favorites.length) {
          const requestId = mergeId || crypto.randomUUID();
          guest.setState({ mergeId: requestId });
          const merged = await send({
            op: "merge",
            requestId,
            items,
            favorites,
          });
          guest.setState({ ...empty, mergeId: undefined });
          setStored(merged);
        }
      } catch {
        /* Keep the guest data available for retry. */
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const sync = useCallback((data: unknown) => {
    const pending = queue.current
      .catch(() => undefined)
      .then(async () => setStored(await send(data)));
    queue.current = pending;
    return pending;
  }, []);
  const signedIn = stored !== null;
  const change = useCallback(
    async (id: string, quantity: number, mode: "add" | "set", cap: number) => {
      if (!ready) throw new Error("Koszyk się ładuje. Spróbuj ponownie.");
      if (signedIn) return sync({ op: "cart", id, quantity, mode });
      const { items } = guest.getState();
      const previous = items.find((item) => item.id === id)?.quantity || 0;
      const next = Math.max(
        0,
        Math.min(cap, 99, (mode === "add" ? previous : 0) + quantity),
      );
      if (mode === "add" && next <= previous)
        throw new Error("Osiągnięto maksymalną dostępną ilość.");
      const rest = items.filter((item) => item.id !== id);
      if (next && !previous && rest.length >= 80)
        throw new Error("Koszyk zawiera maksymalną liczbę pozycji.");
      guest.setState({
        items: next ? [...rest, { id, quantity: next }] : rest,
        mergeId: undefined,
      });
    },
    [ready, signedIn, sync],
  );
  const favorite = useCallback(
    async (id: string, enabled: boolean) => {
      if (!ready) return;
      if (signedIn) return sync({ op: "favorite", id, enabled });
      const items = guest.getState().favorites.filter((item) => item !== id);
      if (enabled && items.length >= 100)
        throw new Error("Lista ulubionych jest pełna.");
      guest.setState({
        favorites: enabled ? [...items, id] : items,
        mergeId: undefined,
      });
    },
    [ready, signedIn, sync],
  );
  const clearGuest = useCallback(
    (lines: CartLine[]) =>
      guest.setState(({ items }) => ({
        items: items.flatMap((item) => {
          const quantity =
            item.quantity -
            (lines.find((line) => line.id === item.id)?.quantity || 0);
          return quantity > 0 ? [{ ...item, quantity }] : [];
        }),
        mergeId: undefined,
      })),
    [],
  );
  return (
    <context.Provider
      value={{
        ...(stored || local),
        ready,
        signedIn,
        cartOpen,
        setCartOpen,
        change,
        favorite,
        clearGuest,
      }}
    >
      {children}
    </context.Provider>
  );
}
export function useCartQuote(active = true, shipping = "pickup", coupon = "") {
  const { items, ready } = useCommerce();
  const body = useMemo(
    () => JSON.stringify({ items, shipping, coupon: coupon || undefined }),
    [items, shipping, coupon],
  );
  const [state, setState] = useState<{
    body: string;
    quote?: Quote;
    error?: string;
  }>();
  useEffect(() => {
    if (!active || !ready || !items.length) return;
    const controller = new AbortController();
    fetch("/api/koszyk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setState({ body, quote: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            body,
            error: error.message || "Koszyk jest chwilowo niedostępny.",
          });
      });
    return () => controller.abort();
  }, [active, ready, items.length, body]);
  return state?.body === body && active && items.length
    ? state
    : { quote: undefined, error: undefined };
}
