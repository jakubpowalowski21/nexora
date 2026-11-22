import { ActionForm } from "@/src/components/ui/forms";
import type { addresses } from "@/src/db/schema";
import { saveAddress, deleteAddress } from "@/src/features/account/actions";
const fields = [
  ["name", "Imię i nazwisko"],
  ["street", "Ulica i numer"],
  ["zip", "Kod pocztowy"],
  ["city", "Miasto"],
  ["phone", "Telefon"],
  ["company", "Firma (opcjonalnie)"],
  ["nip", "NIP (opcjonalnie)"],
] as const;
export function AddressForm({
  entry,
}: {
  entry?: typeof addresses.$inferSelect;
}) {
  return (
    <div className="panel">
      <h2>{entry?.label || "Dodaj adres"}</h2>
      <ActionForm action={saveAddress} submit="Zapisz adres">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        <div className="form-grid">
          <label>
            Nazwa adresu
            <input
              required
              name="label"
              defaultValue={entry?.label}
              maxLength={45}
            />
          </label>
          {fields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                name={field}
                defaultValue={entry?.data[field]}
                required={field !== "company" && field !== "nip"}
              />
            </label>
          ))}
          <label>
            Kraj
            <select name="country">
              <option>Polska</option>
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={entry?.isDefault}
          />
          Domyślny adres dostawy
        </label>
      </ActionForm>
      {entry && (
        <ActionForm
          action={deleteAddress}
          submit="Usuń adres"
          variant="secondary"
        >
          <input type="hidden" name="id" value={entry.id} />
        </ActionForm>
      )}
    </div>
  );
}
