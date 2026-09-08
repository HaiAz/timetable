/**
 * Date helpers. Weeks start on Monday throughout.
 *
 * Dates are handled as plain `YYYY-MM-DD` strings rather than `Date` objects
 * wherever possible, so nothing shifts under a timezone change.
 */

export const WEEKDAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "CN",
] as const;

export const WEEKDAY_LABELS_LONG = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
] as const;

/** Today as YYYY-MM-DD in the viewer's local timezone. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Local-timezone YYYY-MM-DD (never UTC — avoids off-by-one-day). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD into a local-midnight Date. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/**
 * Monday of the week containing `iso`.
 * JS getDay() is 0=Sunday, so Sunday maps back 6 days rather than forward 1.
 */
export function startOfWeek(iso: string): string {
  const date = fromISODate(iso);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

/** The 7 dates Monday→Sunday for the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const day = fromISODate(iso).getDay();
  return day === 0 ? 6 : day - 1;
}

export function isSameWeek(a: string, b: string): boolean {
  return startOfWeek(a) === startOfWeek(b);
}

export function isWeekend(iso: string): boolean {
  return weekdayIndex(iso) >= 5;
}

/** The YYYY-MM a date belongs to. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** The current YYYY-MM. */
export function currentMonth(): string {
  return monthOf(todayISO());
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** e.g. "2026-09" -> "Tháng 9, 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}, ${y}`;
}

/** e.g. "2026-09" -> "T9/2026" — for compact table cells. */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-");
  return `T${Number(m)}/${y}`;
}

/** e.g. "2026-09-08" -> "8/9" */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** e.g. "2026-09-08" -> "8/9/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

/** e.g. "Thứ Hai, 8/9/2026" */
export function formatDateLong(iso: string): string {
  return `${WEEKDAY_LABELS_LONG[weekdayIndex(iso)]}, ${formatDate(iso)}`;
}

/**
 * The week's range, collapsing shared month/year:
 *   "8/9 – 14/9/2026"   same month
 *   "29/9 – 5/10/2026"  crossing a month
 *   "30/12/2025 – 5/1/2026" crossing a year
 */
export function formatWeekRange(iso: string): string {
  const dates = weekDates(iso);
  const first = dates[0]!;
  const last = dates[6]!;
  const [y1] = first.split("-");
  const [y2] = last.split("-");

  if (y1 !== y2) {
    return `${formatDate(first)} – ${formatDate(last)}`;
  }
  return `${formatDayMonth(first)} – ${formatDate(last)}`;
}

/** How many months back `month` is from `reference`. */
export function monthsBetween(month: string, reference: string): number {
  const [y1, m1] = month.split("-").map(Number);
  const [y2, m2] = reference.split("-").map(Number);
  return ((y2 ?? 0) - (y1 ?? 0)) * 12 + ((m2 ?? 0) - (m1 ?? 0));
}

/** ISO week number — used only as a compact secondary label. */
export function isoWeekNumber(iso: string): number {
  const date = fromISODate(startOfWeek(iso));
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const diff = thursday.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}
