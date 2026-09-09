import { describe, expect, it } from "vitest";
import {
  buildHourRows,
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  findOverlaps,
  occupiedHours,
  placeSessions,
} from "./overlap";
import type { Session } from "@/lib/types";

function s(id: string, startTime: string, endTime: string, date = "2026-09-08"): Session {
  return { id, studentId: "a", date, startTime, endTime, taught: false };
}

describe("placeSessions", () => {
  it("gives a lone session the full width", () => {
    const placed = placeSessions([s("1", "09:00", "10:00")]);
    expect(placed).toHaveLength(1);
    expect(placed[0]!.column).toBe(0);
    expect(placed[0]!.columnCount).toBe(1);
  });

  it("keeps sequential sessions at full width", () => {
    const placed = placeSessions([
      s("1", "09:00", "10:00"),
      s("2", "10:00", "11:00"),
      s("3", "14:00", "15:00"),
    ]);
    expect(placed.every((p) => p.columnCount === 1)).toBe(true);
    expect(placed.every((p) => p.column === 0)).toBe(true);
  });

  it("splits two overlapping sessions into two columns", () => {
    const placed = placeSessions([s("1", "09:00", "10:30"), s("2", "10:00", "11:00")]);
    expect(placed.every((p) => p.columnCount === 2)).toBe(true);
    expect(placed.map((p) => p.column).sort()).toEqual([0, 1]);
  });

  it("splits three mutually overlapping sessions into three columns", () => {
    const placed = placeSessions([
      s("1", "09:00", "12:00"),
      s("2", "09:30", "10:30"),
      s("3", "10:00", "11:00"),
    ]);
    expect(placed.every((p) => p.columnCount === 3)).toBe(true);
    expect(placed.map((p) => p.column).sort()).toEqual([0, 1, 2]);
  });

  it("reuses a column once its previous session has ended", () => {
    // 1 spans the morning; 2 and 3 are sequential beside it and can share.
    const placed = placeSessions([
      s("1", "09:00", "12:00"),
      s("2", "09:00", "10:00"),
      s("3", "10:00", "11:00"),
    ]);
    expect(placed.every((p) => p.columnCount === 2)).toBe(true);
    const byId = new Map(placed.map((p) => [p.session.id, p]));
    expect(byId.get("2")!.column).toBe(byId.get("3")!.column);
  });

  it("treats touching edges as non-overlapping", () => {
    const placed = placeSessions([s("1", "09:00", "10:00"), s("2", "10:00", "11:00")]);
    expect(placed.every((p) => p.columnCount === 1)).toBe(true);
  });

  it("isolates separate clusters", () => {
    const placed = placeSessions([
      // Cluster A — overlapping pair.
      s("1", "09:00", "10:30"),
      s("2", "10:00", "11:00"),
      // Cluster B — a single later session, unaffected by A.
      s("3", "15:00", "16:00"),
    ]);
    const byId = new Map(placed.map((p) => [p.session.id, p]));
    expect(byId.get("1")!.columnCount).toBe(2);
    expect(byId.get("2")!.columnCount).toBe(2);
    expect(byId.get("3")!.columnCount).toBe(1);
  });

  it("never assigns two overlapping sessions the same column", () => {
    const placed = placeSessions([
      s("1", "09:00", "11:00"),
      s("2", "09:15", "10:15"),
      s("3", "09:30", "12:00"),
      s("4", "10:30", "11:30"),
    ]);
    for (const a of placed) {
      for (const b of placed) {
        if (a.session.id === b.session.id) continue;
        const overlaps = a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
        if (overlaps) expect(a.column).not.toBe(b.column);
      }
    }
  });

  it("returns every session it was given", () => {
    const sessions = [
      s("1", "09:00", "11:00"),
      s("2", "09:15", "10:15"),
      s("3", "09:30", "12:00"),
    ];
    expect(placeSessions(sessions)).toHaveLength(3);
  });
});

describe("findOverlaps", () => {
  const sessions = [s("1", "09:00", "10:00"), s("2", "14:00", "15:00")];

  it("finds a straddling session", () => {
    expect(findOverlaps(sessions, "2026-09-08", "09:30", "10:30").map((x) => x.id)).toEqual(["1"]);
  });

  it("finds a fully contained session", () => {
    expect(findOverlaps(sessions, "2026-09-08", "08:00", "11:00").map((x) => x.id)).toEqual(["1"]);
  });

  it("ignores back-to-back times", () => {
    expect(findOverlaps(sessions, "2026-09-08", "10:00", "11:00")).toEqual([]);
    expect(findOverlaps(sessions, "2026-09-08", "08:00", "09:00")).toEqual([]);
  });

  it("ignores other days", () => {
    expect(findOverlaps(sessions, "2026-09-09", "09:30", "10:30")).toEqual([]);
  });

  it("excludes the session being edited", () => {
    expect(findOverlaps(sessions, "2026-09-08", "09:00", "10:00", "1")).toEqual([]);
  });

  it("returns nothing for an invalid range", () => {
    expect(findOverlaps(sessions, "2026-09-08", "10:00", "09:00")).toEqual([]);
  });
});

describe("occupiedHours", () => {
  it("marks every hour a session touches", () => {
    const hours = occupiedHours([s("1", "09:30", "11:15")]);
    expect([...hours].sort((a, b) => a - b)).toEqual([9, 10, 11]);
  });

  it("does not mark the hour a session ends exactly on", () => {
    const hours = occupiedHours([s("1", "09:00", "10:00")]);
    expect([...hours]).toEqual([9]);
  });

  it("is empty for no sessions", () => {
    expect(occupiedHours([]).size).toBe(0);
  });
});

describe("buildHourRows", () => {
  const hoursOf = (rows: ReturnType<typeof buildHourRows>) => rows.map((r) => r.hour);

  it("mặc định là khung 07:00–23:00, đúng 16 hàng", () => {
    const rows = buildHourRows(new Set([9, 10, 19]));
    expect(rows).toHaveLength(16);
    expect(hoursOf(rows)).toEqual([
      7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    ]);
  });

  it("dùng đúng khung mặc định khi chưa có buổi nào", () => {
    const rows = buildHourRows(new Set());
    expect(rows).toHaveLength(16);
    expect(hoursOf(rows)[0]).toBe(DEFAULT_START_HOUR);
  });

  it("là một dải giờ liên tục, không thu gọn khoảng trống", () => {
    const rows = buildHourRows(new Set([7, 20]));
    const hours = hoursOf(rows);
    for (let i = 1; i < hours.length; i++) {
      expect(hours[i]).toBe(hours[i - 1]! + 1);
    }
  });

  it("tự nới xuống khi có buổi trước 7h, không ẩn mất buổi", () => {
    const rows = buildHourRows(new Set([3, 9]));
    const hours = hoursOf(rows);
    expect(hours[0]).toBe(3);
    expect(hours).toContain(3);
    expect(rows).toHaveLength(20);
  });

  it("nới tới đúng buổi sớm nhất", () => {
    expect(hoursOf(buildHourRows(new Set([0])))[0]).toBe(0);
    expect(hoursOf(buildHourRows(new Set([5, 8])))[0]).toBe(5);
  });

  it("không nới khi buổi sớm nhất đã nằm trong khung", () => {
    expect(hoursOf(buildHourRows(new Set([8, 20])))[0]).toBe(DEFAULT_START_HOUR);
  });

  it("hiện đủ 24 giờ khi mở rộng", () => {
    const rows = buildHourRows(new Set([9]), { expanded: true });
    expect(rows).toHaveLength(24);
    expect(hoursOf(rows)[0]).toBe(0);
    expect(hoursOf(rows)[23]).toBe(23);
  });

  it("mặc định kết thúc ở 23 giờ trừ khi có buổi muộn hơn", () => {
    for (const occupied of [new Set<number>(), new Set([3]), new Set([9, 20])]) {
      const hours = hoursOf(buildHourRows(occupied));
      expect(hours[hours.length - 1]).toBe(DEFAULT_END_HOUR - 1);
    }
  });

  it("tự nới lên khi có buổi từ 23h trở đi, không ẩn mất buổi", () => {
    const rows = buildHourRows(new Set([9, 23]));
    const hours = hoursOf(rows);
    expect(hours.at(-1)).toBe(23);
    expect(hours).toContain(23);
  });

  it("mọi giờ có buổi học đều được vẽ", () => {
    const occupied = new Set([7, 12, 22]);
    const hours = hoursOf(buildHourRows(occupied));
    for (const hour of occupied) {
      expect(hours).toContain(hour);
    }
  });
});
