import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth";
import {
  Categories,
  Customers,
  Promotions,
  Reviews,
  Settings,
  Stock,
  Tickets,
} from "@/src/components/admin/sections";
const sections = {
  kategorie: ["Kategorie", Categories],
  klienci: ["Klienci", Customers],
  magazyn: ["Magazyn", Stock],
  promocje: ["Promocje i kupony", Promotions],
  opinie: ["Opinie", Reviews],
  wiadomosci: ["Wiadomości i zwroty", Tickets],
  ustawienia: ["Ustawienia sklepu", Settings],
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string; klient?: string }>;
}) {
  await requireAdmin();
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  const [title, Section] = sections[section as keyof typeof sections];
  return (
    <>
      <div className="page-heading">
        <h1>{title}</h1>
      </div>
      <Section query={await searchParams} />
    </>
  );
}
