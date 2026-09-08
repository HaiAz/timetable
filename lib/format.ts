/**
 * Vietnamese display formatting. Currency is VND with a dot thousands
 * separator: `200.000 ₫`.
 */

/** e.g. 200000 -> "200.000 ₫" */
export function formatVND(amount: number): string {
  return `${formatNumber(amount)} ₫`;
}

/** e.g. 200000 -> "200.000" — when the unit is shown elsewhere. */
export function formatNumber(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Parse user input like "200.000" or "200000" back to a number. */
export function parseVND(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * e.g. 45 -> "45 phút", 90 -> "1 giờ 30 phút", 120 -> "2 giờ"
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 phút";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

/** Compact duration for tight grid cells: 45 -> "45p", 90 -> "1h30" */
export function formatDurationShort(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0p";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}p`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** e.g. "45 phút — 100.000 ₫" — the rate as shown in the student list. */
export function formatRate(baseMinutes: number, basePrice: number): string {
  return `${baseMinutes} phút — ${formatVND(basePrice)}`;
}

/** e.g. "09:00 – 10:30" */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

/** Relative-ish timestamp for "marked taught at" / "paid at" lines. */
export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${d}/${m}/${y}`;
}

/** Vietnamese pluralisation is invariant, so these read naturally as-is. */
export function sessionCountLabel(count: number): string {
  return `${count} buổi`;
}

export function studentCountLabel(count: number): string {
  return `${count} học sinh`;
}

export function monthCountLabel(count: number): string {
  return `${count} tháng`;
}

/** Initials for the student avatar chip, Vietnamese-name aware. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  // Vietnamese names are family-name-first; the given name is the last part
  // and is what a tutor actually calls the student.
  const given = parts[parts.length - 1]!;
  return given.slice(0, 1).toUpperCase();
}

/** Byte size for the export/backup size hint. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
