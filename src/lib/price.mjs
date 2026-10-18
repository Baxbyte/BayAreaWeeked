// Turns raw prices into a tidy label (cents only when needed), and "From $X" when the top price is an outlier (VIP tables, bundles).
const RANGE = /^\s*\$?\s*[\d,]+(\.\d+)?\s*([–-]\s*\$?\s*[\d,]+(\.\d+)?)?\s*$/;
const usd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export function priceLabel(min, max) {
  if (min == null) return null;
  if (min === 0 && !max) return 'Free';
  const hi = max ?? min;
  if (hi > Math.max(min * 10, 200) || hi > 1000) return `From ${usd(min)}`;
  return hi > min ? `${usd(min)}–${usd(hi)}` : usd(min);
}

/** Keep hand-written price text ("$20 adv / $25 door"); rebuild plain number ranges from min/max. */
export function tidyPrice(text, min, max) {
  if (!text) return priceLabel(min, max);
  return RANGE.test(text) && min != null ? priceLabel(min, max) : text;
}
