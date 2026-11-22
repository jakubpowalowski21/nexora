export function CatalogLoading() {
  return (
    <div
      className="wrap page-space"
      aria-busy="true"
      aria-label="Ładowanie katalogu"
    >
      <div className="skeleton heading-skeleton" />
      <div className="product-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton card-skeleton" />
        ))}
      </div>
    </div>
  );
}
