// Display copy for numbers (V3's format.ts moved out of the sim, which never formats). Integer
// maths on cents, so -150 cents reads -$1.50, never V3's rounded "-$1".

/** "$313,200" for whole-dollar chips; "$1,234.56" with `cents`. */
export function usd(amountCents: number, options: { cents?: boolean } = {}): string {
  const sign = amountCents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amountCents));
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  return options.cents ? `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}` : `${sign}$${dollars}`;
}

/** "$190k" for a card's prices: whole thousands, or one decimal ("$23.8k") when that is exact; below $1,000, whole dollars. */
export function usdK(amountCents: number): string {
  const dollars = Math.trunc(amountCents / 100);
  if (Math.abs(dollars) < 1_000 || amountCents % 100 !== 0) return usd(amountCents);
  const tenths = dollars / 100;
  if (Number.isInteger(tenths / 10)) return `${dollars < 0 ? '-' : ''}$${Math.abs(dollars / 1_000).toLocaleString('en-US')}k`;
  return Number.isInteger(tenths) ? `${dollars < 0 ? '-' : ''}$${Math.abs(tenths / 10).toFixed(1)}k` : usd(amountCents);
}

/** "3.5 km" from metres, one decimal. */
export function km(metres: number): string {
  return `${(metres / 1_000).toFixed(1)} km`;
}

/** "every 20 min" from a headway in seconds. */
export function every(seconds: number): string {
  return `every ${Number.isInteger(seconds / 60) ? seconds / 60 : (seconds / 60).toFixed(1)} min`;
}

/** "≈9,000": two significant figures, for counts the sim models rather than knows. */
export function about(n: number): string {
  if (n <= 0) return '0';
  const step = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return `≈${(Math.round(n / step) * step).toLocaleString('en-US')}`;
}

export function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** The day card's names for ledger rows. */
export const ROW_NAMES: Readonly<Record<string, string>> = {
  founding: 'Founding capital',
  fares: 'Fares',
  subsidy: 'City subsidy',
  purchase: 'Purchases',
  refund: 'Refunds',
  running: 'Running (per km)',
  wages: 'Driver wages',
  deadhead: 'Deadhead',
  upkeep: 'Depot upkeep',
};
