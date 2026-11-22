import { Confirmation } from "@/src/components/cart/confirmation";
export const metadata = {
  title: "Potwierdzenie zamówienia",
  robots: { index: false },
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; klucz?: string }>;
}) {
  return <Confirmation params={await searchParams} />;
}
