import type { Session } from "@/lib/types";
import { toMinutes } from "@/lib/billing";

/**
 * Lays overlapping sessions out side by side instead of stacking them.
 *
 * The approach is the standard calendar one:
 *  1. Sort by start time.
 *  2. Group sessions into "clusters" of transitively overlapping sessions.
 *  3. Within a cluster, greedily assign each session to the first column whose
 *     last session has already ended.
 *  4. Every session in a cluster is drawn at 1/columns width, so a cluster of
 *     3 gives three equal thirds and nothing is ever hidden.
 */

export interface PlacedSession {
  session: Session;
  startMinutes: number;
  endMinutes: number;
  /** 0-based column within the cluster. */
  column: number;
  /** How many columns the cluster needs. */
  columnCount: number;
}

export function placeSessions(sessions: Session[]): PlacedSession[] {
  const items = sessions
    .map((session) => ({
      session,
      startMinutes: toMinutes(session.startTime),
      endMinutes: toMinutes(session.endTime),
    }))
    // Longer sessions first on a tie, so the big block forms column 0.
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const placed: PlacedSession[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;

    // Greedy column assignment within the cluster.
    const columnEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMinutes);
      if (column === -1) {
        column = columnEnds.length;
      }
      columnEnds[column] = item.endMinutes;
      return { ...item, column };
    });

    const columnCount = columnEnds.length;
    for (const item of assigned) {
      placed.push({ ...item, columnCount });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    // A gap means the previous cluster is closed.
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) {
      flush();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  flush();

  return placed;
}

/** Does the candidate range overlap any of `sessions`? */
export function findOverlaps(
  sessions: Session[],
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Session[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (end <= start) return [];

  return sessions.filter((session) => {
    if (session.date !== date) return false;
    if (session.id === excludeId) return false;
    const s = toMinutes(session.startTime);
    const e = toMinutes(session.endTime);
    // Touching edges (10:00 end, 10:00 start) is not an overlap.
    return s < end && e > start;
  });
}

/**
 * Which whole hours contain at least one session, across the given sessions.
 * Drives both auto-scroll and the collapsing of empty overnight hours.
 */
export function occupiedHours(sessions: Session[]): Set<number> {
  const hours = new Set<number>();
  for (const session of sessions) {
    const start = toMinutes(session.startTime);
    const end = toMinutes(session.endTime);
    const firstHour = Math.floor(start / 60);
    // An end exactly on the hour does not occupy that hour.
    const lastHour = Math.floor(Math.max(start, end - 1) / 60);
    for (let h = firstHour; h <= lastHour; h++) hours.add(h);
  }
  return hours;
}

/**
 * Các hàng giờ cần vẽ.
 *
 * Lưới là một dải giờ liên tục, không thu gọn khoảng trống ở giữa: giữ đúng
 * hình dạng thật của ngày, và 18 hàng của khung 06:00–24:00 đã vừa một màn
 * hình nên không cần tiết kiệm chỗ.
 */
export interface HourRow {
  kind: "hour";
  hour: number;
}
export type GridRow = HourRow;

export function buildHourRows(
  occupied: Set<number>,
  options: { expanded?: boolean } = {},
): GridRow[] {
  const { expanded = false } = options;

  // Khung dạy mặc định: 06:00–23:59. 18 hàng vừa đúng một màn hình, nên không
  // cần thu gọn khoảng trống ở giữa — nhìn được bao quát cả tuần.
  const start = expanded ? 0 : Math.min(DEFAULT_START_HOUR, earliestOccupied(occupied));

  const rows: GridRow[] = [];
  for (let hour = start; hour < 24; hour++) {
    rows.push({ kind: "hour", hour });
  }
  return rows;
}

/** Giờ bắt đầu mặc định của lưới. */
export const DEFAULT_START_HOUR = 6;

/**
 * Giờ sớm nhất có buổi học, để lưới tự nới xuống khi cần — buổi học trước 6h
 * không bao giờ bị ẩn mất.
 */
function earliestOccupied(occupied: Set<number>): number {
  let earliest = 24;
  for (const hour of occupied) {
    if (hour < earliest) earliest = hour;
  }
  return earliest;
}

/** The earliest occupied hour, for auto-scroll. */
export function earliestHour(sessions: Session[]): number | null {
  let earliest: number | null = null;
  for (const session of sessions) {
    const hour = Math.floor(toMinutes(session.startTime) / 60);
    if (earliest === null || hour < earliest) earliest = hour;
  }
  return earliest;
}
