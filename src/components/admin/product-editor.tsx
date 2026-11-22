"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Submit } from "@/src/components/ui/forms";
import { saveProduct } from "@/src/features/admin/products";
import type { loadProductAdmin } from "@/src/features/admin/products";
import { slugify } from "@/src/lib/format";

type Existing = NonNullable<Awaited<ReturnType<typeof loadProductAdmin>>>;
type DraftVariant = {
  key: string;
  id?: string;
  expectedStock?: number;
  name: string;
  sku: string;
  color: string;
  connection: string;
  price: string;
  salePrice: string;
  saleStart: string;
  saleEnd: string;
  image: string;
  stock: string;
};
type Photo = { url: string; alt: string };
const fresh = (key: string): DraftVariant => ({
  key,
  name: "Standard",
  sku: "",
  color: "Czarny",
  connection: "Przewodowa",
  price: "",
  salePrice: "",
  saleStart: "",
  saleEnd: "",
  image: "",
  stock: "0",
});
const date = (value: Date | null, exclusive = false) =>
  value
    ? new Date(new Date(value).getTime() - (exclusive ? 86400000 : 0))
        .toISOString()
        .slice(0, 10)
    : "";
const names = [
  ["name", "Nazwa wariantu"],
  ["sku", "SKU"],
  ["color", "Kolor"],
  ["connection", "Łączność"],
  ["price", "Cena regularna (gr)"],
  ["salePrice", "Cena promocyjna (gr)"],
  ["saleStart", "Początek promocji"],
  ["saleEnd", "Ostatni dzień promocji"],
  ["image", "Zdjęcie wariantu"],
  ["stock", "Stan fizyczny"],
] as const;
export function ProductEditor({
  product,
  categories,
}: {
  product?: Existing;
  categories: { id: string; name: string; facets: string[] }[];
}) {
  const [state, action] = useActionState(
    saveProduct.bind(null, product?.id || null),
    {},
  );
  const [name, setName] = useState(product?.name || ""),
    [slug, setSlug] = useState(product?.slug || ""),
    [autoslug, setAuto] = useState(!product);
  const [category, setCategory] = useState(
    product?.categoryId || categories[0]?.id || "",
  );
  const initialFacets =
    categories.find(
      (entry) => entry.id === (product?.categoryId || categories[0]?.id),
    )?.facets || [];
  const [specifications, setSpecifications] = useState(
    product?.specifications || {},
  );
  const [extraSpecs, setExtraSpecs] = useState(
    Object.entries(product?.specifications || {})
      .filter(([field]) => !initialFacets.includes(field))
      .map(([field, value]) => `${field}=${value}`)
      .join("\n"),
  );
  const facets =
    categories.find((entry) => entry.id === category)?.facets || [];
  const [variantRows, setVariants] = useState<DraftVariant[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          ...v,
          key: v.id,
          expectedStock: v.stock,
          price: String(v.price),
          salePrice: v.salePrice ? String(v.salePrice) : "",
          saleStart: date(v.saleStart),
          saleEnd: date(v.saleEnd, true),
          image: v.image || "",
          stock: String(v.stock),
        }))
      : [fresh("default")],
  );
  const [photos, setPhotos] = useState<Photo[]>(
    product?.images.map((photo) => ({
      url: photo.url,
      alt: photo.alt,
    })) || [],
  );
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const reorder = (index: number, shift: number) =>
    setPhotos((current) => {
      const updated = [...current],
        [photo] = updated.splice(index, 1);
      updated.splice(index + shift, 0, photo);
      return updated;
    });
  return (
    <form action={action} className="panel form-stack">
      <input type="hidden" name="images" value={JSON.stringify(photos)} />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(variantRows)}
      />
      <fieldset className="admin-form-group">
        <legend>Dane podstawowe</legend>
        <div className="form-grid">
          <label>
            Nazwa
            <input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (autoslug) setSlug(slugify(e.target.value));
              }}
              required
              maxLength={140}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setAuto(false);
              }}
              required
              maxLength={96}
            />
          </label>
          <label>
            Marka
            <input
              name="brand"
              defaultValue={product?.brand || "NEXORA"}
              required
              maxLength={60}
            />
          </label>
          <label>
            Kategoria
            <select
              name="categoryId"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={product?.status || "draft"}>
              <option value="draft">Szkic</option>
              <option value="active">Aktywny</option>
              <option value="archived">Archiwalny</option>
            </select>
          </label>
          <label>
            Stawka VAT (%)
            <input
              name="tax"
              type="number"
              min={0}
              max={100}
              defaultValue={product?.tax ?? 23}
              required
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured}
          />
          Wyróżnij produkt
        </label>
        <label>
          Krótki opis
          <input
            name="summary"
            defaultValue={product?.summary}
            minLength={10}
            maxLength={320}
            required
          />
        </label>
        <label>
          Pełny opis
          <textarea
            name="description"
            defaultValue={product?.description}
            minLength={10}
            maxLength={8000}
            required
          />
        </label>
        <label>
          Zawartość opakowania
          <input
            name="box"
            defaultValue={product?.box || "Produkt, dokumentacja"}
            maxLength={400}
            required
          />
        </label>
      </fieldset>
      <fieldset className="admin-form-group">
        <legend>Warianty i ceny</legend>
        <div className="admin-product-rows">
          {variantRows.map((v, i) => (
            <div key={v.key}>
              <div className="price-row">
                <strong>Wariant {i + 1}</strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Usuń wariant ${i + 1}`}
                  disabled={variantRows.length === 1}
                  onClick={() =>
                    setVariants(variantRows.filter((row) => row.key !== v.key))
                  }
                >
                  <Trash2 size={18} />
                </Button>
              </div>
              <div className="form-grid">
                {names.map(([id, label]) => (
                  <label key={id}>
                    {label}
                    {id === "connection" ? (
                      <select
                        value={v[id]}
                        onChange={(e) =>
                          setVariants(
                            variantRows.map((row) =>
                              row.key === v.key
                                ? { ...row, [id]: e.target.value }
                                : row,
                            ),
                          )
                        }
                      >
                        <option>Przewodowa</option>
                        <option>Bezprzewodowa</option>
                      </select>
                    ) : (
                      <input
                        value={v[id]}
                        type={
                          id === "price" || id === "salePrice" || id === "stock"
                            ? "number"
                            : id === "saleStart" || id === "saleEnd"
                              ? "date"
                              : "text"
                        }
                        min={id === "stock" ? 0 : 1}
                        max={id === "stock" ? 500000 : 10000000}
                        onChange={(e) =>
                          setVariants(
                            variantRows.map((row) =>
                              row.key === v.key
                                ? { ...row, [id]: e.target.value }
                                : row,
                            ),
                          )
                        }
                        required={[
                          "name",
                          "sku",
                          "color",
                          "price",
                          "stock",
                        ].includes(id)}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={variantRows.length >= 24}
          onClick={() =>
            setVariants([...variantRows, fresh(crypto.randomUUID())])
          }
        >
          <Plus size={17} />
          Dodaj wariant
        </Button>
      </fieldset>
      <fieldset className="admin-form-group">
        <legend>Zdjęcia</legend>
        <p className="subtle">
          Pierwsze zdjęcie jest główne. Wybierz plik lub podaj ścieżkę zdjęcia
          z katalogu /media.
        </p>
        <div className="admin-product-rows">
          {photos.map((photo, i) => (
            <div key={i}>
              <div className="actions-row">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`Przenieś zdjęcie ${i + 1} wyżej`}
                  disabled={i === 0}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowUp size={17} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`Przenieś zdjęcie ${i + 1} niżej`}
                  disabled={i === photos.length - 1}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowDown size={17} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`Usuń zdjęcie ${i + 1}`}
                  onClick={() =>
                    setPhotos(photos.filter((_, index) => index !== i))
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
              <div className="form-grid">
                <label>
                  Adres zdjęcia
                  <input
                    value={photo.url}
                    onChange={(e) =>
                      setPhotos(
                        photos.map((p, index) =>
                          index === i
                            ? { ...p, url: e.target.value }
                            : p,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Tekst alternatywny
                  <input
                    value={photo.alt}
                    onChange={(e) =>
                      setPhotos(
                        photos.map((p, index) =>
                          index === i ? { ...p, alt: e.target.value } : p,
                        ),
                      )
                    }
                    required
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={photos.length >= 20}
          onClick={() => setPhotos([...photos, { url: "", alt: name }])}
        >
          Dodaj adres zdjęcia
        </Button>
        <label>
          Prześlij zdjęcia
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || photos.length >= 20}
            onChange={async (e) => {
              const files = Array.from(e.currentTarget.files || []).slice(
                0,
                20 - photos.length,
              );
              e.currentTarget.value = "";
              setUploading(true);
              setError("");
              try {
                for (const file of files) {
                  const upload = new FormData();
                  upload.set("file", file);
                  const res = await fetch("/api/admin/upload", {
                      method: "POST",
                      body: upload,
                    }),
                    data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setPhotos((current) =>
                    [
                      ...current,
                      {
                        url: data.url,
                        alt: name || file.name,
                      },
                    ].slice(0, 20),
                  );
                }
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {uploading && <p role="status">Przesyłanie…</p>}
        {error && <p className="alert alert-error">{error}</p>}
      </fieldset>
      <fieldset className="admin-form-group">
        <legend>Specyfikacja i SEO</legend>
        <input
          type="hidden"
          name="specifications"
          value={[
            extraSpecs,
            ...facets
              .filter((key) => specifications[key]?.trim())
              .map((key) => `${key}=${specifications[key]}`),
          ]
            .filter(Boolean)
            .join("\n")}
        />
        {!!facets.length && (
          <div className="form-grid">
            {facets.map((facet) => (
              <label key={facet}>
                {facet}
                <input
                  value={specifications[facet] || ""}
                  maxLength={200}
                  onChange={(event) =>
                    setSpecifications({
                      ...specifications,
                      [facet]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
        <label>
          Dodatkowe parametry (jedna para parametr=wartość w wierszu)
          <textarea
            value={extraSpecs}
            onChange={(event) => setExtraSpecs(event.target.value)}
            maxLength={8000}
          />
        </label>
        <div className="form-grid">
          <label>
            Tytuł SEO
            <input
              name="metaTitle"
              defaultValue={product?.metaTitle || ""}
              maxLength={90}
            />
          </label>
          <label>
            Opis SEO
            <input
              name="metaDescription"
              defaultValue={product?.metaDescription || ""}
              maxLength={180}
            />
          </label>
          <label>
            Zdjęcie Open Graph
            <input name="ogImage" defaultValue={product?.ogImage || ""} />
          </label>
        </div>
      </fieldset>
      {state.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="alert alert-success" role="status">
          {state.message}
        </p>
      )}
      <Submit disabled={uploading}>
        {product ? "Zapisz zmiany" : "Dodaj produkt"}
      </Submit>
    </form>
  );
}
