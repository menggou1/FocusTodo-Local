export type Period = 'day' | 'week' | 'month' | 'year';
export function range(value: number, period: Period = 'day') {
  const date = new Date(value); date.setHours(0, 0, 0, 0);
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (period === 'month') date.setDate(1);
  if (period === 'year') date.setMonth(0, 1);
  const end = new Date(date);
  if (period === 'year') end.setFullYear(end.getFullYear() + 1);
  else if (period === 'month') end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + (period === 'week' ? 7 : 1));
  return { start: +date, end: +end };
}
export function shift(value: number, amount: number, period: Period) {
  const date = new Date(value);
  if (period === 'year') date.setFullYear(date.getFullYear() + amount);
  else if (period === 'month') { date.setDate(1); date.setMonth(date.getMonth() + amount); }
  else date.setDate(date.getDate() + amount * (period === 'week' ? 7 : 1));
  return +date;
}
export function localInput(value: number) { const date = new Date(value), pad = (n: number, width = 2) => String(n).padStart(width, '0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(),3)}`; }
export function stamp(value: number, locale: string) { return new Intl.DateTimeFormat(locale, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'}).format(value); }
