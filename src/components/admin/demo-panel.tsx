"use client";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { money } from "@/src/lib/format";

type Item = {
  id: string;
  name: string;
  price: number;
  status: "Aktywny" | "Szkic";
};
const initial: Item[] = [
  { id: "1", name: "Studio Pro Wireless", price: 39900, status: "Aktywny" },
  { id: "2", name: "Keyboard K75", price: 28900, status: "Aktywny" },
  { id: "3", name: "Mouse Air X", price: 17900, status: "Szkic" },
];
const demoOrders = [
  { id: "NX-DEMO-001", product: "Studio Pro Wireless", total: 39900 },
  { id: "NX-DEMO-002", product: "Keyboard K75", total: 28900 },
];
const statuses = ["Nowe", "W przygotowaniu", "Wysłane", "Dostarczone"];
type State = {
  items: Item[];
  orders: Record<string, number>;
  updatedAt?: number;
};
const defaultState: State = {
  items: initial,
  orders: { "NX-DEMO-001": 1, "NX-DEMO-002": 0 },
};
const key = "nexora-admin-demo-v1";
export function DemoPanel() {
  const [state, setState] = useState(defaultState),
    [ready, setReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const row = JSON.parse(
          sessionStorage.getItem(key) || "null",
        ) as State | null;
        if (row?.updatedAt && Date.now() - row.updatedAt < 86400000)
          setState(row);
      } catch {
        /* Start with the fixtures if the session value cannot be read. */
      }
      setReady(true);
    });
  }, []);
  const update = (value: State) => {
    const draft = { ...value, updatedAt: Date.now() };
    setState(draft);
    sessionStorage.setItem(key, JSON.stringify(draft));
  };
  return (
    <div className="detail-sections">
      <div className="metrics">
        <div className="panel metric">
          <span>Przychód przykładowy</span>
          <strong>{money(68800)}</strong>
        </div>
        <div className="panel metric">
          <span>Przykładowe zamówienia</span>
          <strong>{demoOrders.length}</strong>
        </div>
        <div className="panel metric">
          <span>Produkty w demo</span>
          <strong>{state.items.length}</strong>
        </div>
      </div>
      <section className="panel">
        <h2>Dodaj przykładowy produkt</h2>
        <form
          className="admin-query"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget),
              name = String(form.get("name") || "").trim(),
              price = Math.round(Number(form.get("price")) * 100);
            if (
              name.length < 2 ||
              price < 1 ||
              price > 1000000 ||
              state.items.length >= 30
            )
              return;
            update({
              ...state,
              items: [
                ...state.items,
                { id: crypto.randomUUID(), name, price, status: "Szkic" },
              ],
            });
            event.currentTarget.reset();
          }}
        >
          <label>
            Nazwa
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label>
            Cena w zł
            <input
              name="price"
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              required
            />
          </label>
          <Button disabled={!ready || state.items.length >= 30}>Dodaj</Button>
        </form>
      </section>
      <section className="panel">
        <h2>Produkty</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Cena</th>
                <th>Status</th>
                <th>Edycja</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{money(item.price)}</td>
                  <td>{item.status}</td>
                  <td>
                    <form
                      className="admin-query"
                      key={item.price + item.status}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget),
                          price = Math.round(Number(form.get("price")) * 100),
                          status =
                            form.get("status") === "Aktywny"
                              ? "Aktywny"
                              : "Szkic";
                        if (price < 1 || price > 1000000) return;
                        update({
                          ...state,
                          items: state.items.map((row) =>
                            row.id === item.id
                              ? { ...row, price, status }
                              : row,
                          ),
                        });
                      }}
                    >
                      <label>
                        Cena produktu w zł
                        <input
                          name="price"
                          type="number"
                          defaultValue={item.price / 100}
                          min="0.01"
                          max="10000"
                          step="0.01"
                          required
                        />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={item.status}>
                          <option>Aktywny</option>
                          <option>Szkic</option>
                        </select>
                      </label>
                      <Button size="small" disabled={!ready}>
                        Zapisz
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Zamówienia</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numer</th>
                <th>Pozycja</th>
                <th>Kwota</th>
                <th>Status</th>
                <th>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {demoOrders.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.product}</td>
                  <td>{money(row.total)}</td>
                  <td>{statuses[state.orders[row.id]]}</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={!ready || state.orders[row.id] >= 3}
                      onClick={() =>
                        update({
                          ...state,
                          orders: {
                            ...state.orders,
                            [row.id]: state.orders[row.id] + 1,
                          },
                        })
                      }
                    >
                      {state.orders[row.id] >= 3
                        ? "Zakończono"
                        : `Przejdź do: ${statuses[state.orders[row.id] + 1]}`}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div>
        <Button
          variant="secondary"
          disabled={!ready}
          onClick={() => update(defaultState)}
        >
          Przywróć dane przykładowe
        </Button>
      </div>
    </div>
  );
}
