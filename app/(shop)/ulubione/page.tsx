import { GuestFavorites } from "@/src/components/account/guest-favorites";
export const metadata = {
  title: "Ulubione produkty",
  robots: { index: false },
};
export default function Page() {
  return (
    <div className="wrap page-space">
      <div className="page-heading">
        <h1>Ulubione produkty</h1>
      </div>
      <GuestFavorites />
    </div>
  );
}
