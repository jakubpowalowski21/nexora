import { Breadcrumbs } from "@/src/components/ui/breadcrumbs";
export function InfoPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wrap page-space">
      <Breadcrumbs items={[{ name: title }]} />
      <div className="info-page">
        <header className="page-heading">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
