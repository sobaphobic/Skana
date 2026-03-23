/** Month names — avoids server/client `toLocaleDateString` ICU differences. */
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** e.g. Sunday, 22 March 2026 — stable across Node and browsers. */
export function formatLongDateWithWeekday(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** e.g. March 2026 */
export function formatMonthYear(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** `YYYY-MM-DD` → e.g. 22 March 2026 (invalid input returned as-is). */
export function formatIsoDateMedium(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (mo < 0 || mo > 11 || day < 1 || day > 31) return iso;
  return `${day} ${MONTHS_LONG[mo]} ${y}`;
}
