import Link from "next/link";
export function Brand({
  footer = false,
  name = "NEXORA",
}: {
  footer?: boolean;
  name?: string;
}) {
  return (
    <Link
      href="/"
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label={`${name} — strona główna`}
    >
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>
        {name}
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
