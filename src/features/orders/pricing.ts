export function couponDiscount(
  coupon: { kind: "fixed" | "percent"; value: number; maximum: number | null },
  eligible: number,
) {
  const raw =
    coupon.kind === "percent"
      ? Math.floor((eligible * coupon.value) / 100)
      : coupon.value;
  return Math.min(raw, coupon.maximum ?? eligible, eligible);
}

const next = {
  new: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
} satisfies Record<string, string[]>;
export function canAdvance(
  from: keyof typeof next,
  to: string,
  payment: string,
) {
  return (
    ["paid", "partially_refunded"].includes(payment) &&
    (next[from] as string[]).includes(to)
  );
}
