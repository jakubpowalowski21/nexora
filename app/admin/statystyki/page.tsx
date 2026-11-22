import { ReportPage } from "@/src/components/admin/report";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ okres?: string; od?: string; do?: string }>;
}) {
  return <ReportPage query={await searchParams} full />;
}
