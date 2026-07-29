// Indian rupee formatting with lakh/crore digit grouping, e.g. ₹1,23,456.78

export function formatInr(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount).toFixed(2);
  const [whole, frac] = abs.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const intPart = rest ? `${grouped},${last3}` : last3;
  return `${sign}\u20B9${intPart}.${frac}`;
}
