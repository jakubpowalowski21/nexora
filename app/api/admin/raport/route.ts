import { viewer } from "@/src/lib/auth";
import { dateRange, report } from "@/src/features/admin/reports";
export async function GET(request: Request) {
  if ((await viewer())?.role !== "admin")
    return new Response("Brak uprawnień", { status: 403 });
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const range = dateRange(query),
    result = await report(range);
  const csv = [
    "Data;Przychód netto po zwrotach (grosze)",
    ...result.chart.map((row) => `${row.day};${row.revenue}`),
  ].join("\r\n");
  return new Response("\ufeff" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexora-${range.from}-${range.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
