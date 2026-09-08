import { describe, expect, it } from "vitest";
import {
  amountForSession,
  minutesBetween,
  monthSummary,
  monthTotals,
  outstandingDebts,
  sessionAmount,
  sessionMinutes,
} from "./billing";
import type { MonthlyBill, Session, Student } from "./types";

const studentA = { baseMinutes: 45, basePrice: 100_000 };
const studentB = { baseMinutes: 60, basePrice: 200_000 };

describe("sessionAmount — required cases", () => {
  describe("Student A: baseMinutes = 45, basePrice = 100.000 ₫", () => {
    const cases: Array<[minutes: number, expected: number]> = [
      [45, 100_000],
      [90, 200_000],
      [100, 222_000],
      [30, 67_000],
      [60, 133_000],
    ];

    for (const [minutes, expected] of cases) {
      it(`${minutes} minutes -> ${expected.toLocaleString("vi-VN")} ₫`, () => {
        expect(sessionAmount(minutes, studentA)).toBe(expected);
      });
    }
  });

  describe("Student B: baseMinutes = 60, basePrice = 200.000 ₫", () => {
    const cases: Array<[minutes: number, expected: number]> = [
      [60, 200_000],
      [90, 300_000],
      [45, 150_000],
      [100, 333_000],
    ];

    for (const [minutes, expected] of cases) {
      it(`${minutes} minutes -> ${expected.toLocaleString("vi-VN")} ₫`, () => {
        expect(sessionAmount(minutes, studentB)).toBe(expected);
      });
    }
  });
});

describe("sessionAmount — rounding and guards", () => {
  it("rounds to the nearest 1.000 ₫", () => {
    // 100 × 100000 / 45 = 222222.22 -> 222.000
    expect(sessionAmount(100, studentA)).toBe(222_000);
    // 30 × 100000 / 45 = 66666.67 -> 67.000
    expect(sessionAmount(30, studentA)).toBe(67_000);
    // 100 × 200000 / 60 = 333333.33 -> 333.000
    expect(sessionAmount(100, studentB)).toBe(333_000);
  });

  it("rounds a .5 boundary up", () => {
    // 1500 ₫ per minute × 1 minute = 1500 -> 2.000 (nearest-half rounds up)
    expect(sessionAmount(1, { baseMinutes: 1, basePrice: 1_500 })).toBe(2_000);
  });

  it("returns 0 for non-positive or invalid input", () => {
    expect(sessionAmount(0, studentA)).toBe(0);
    expect(sessionAmount(-30, studentA)).toBe(0);
    expect(sessionAmount(45, { baseMinutes: 0, basePrice: 100_000 })).toBe(0);
    expect(sessionAmount(45, { baseMinutes: 45, basePrice: 0 })).toBe(0);
    expect(sessionAmount(Number.NaN, studentA)).toBe(0);
  });

  it("is linear in duration", () => {
    expect(sessionAmount(90, studentA)).toBe(2 * sessionAmount(45, studentA));
  });
});

describe("sessionMinutes", () => {
  it("measures arbitrary, non-half-hour times", () => {
    expect(sessionMinutes({ startTime: "09:00", endTime: "10:40" })).toBe(100);
    expect(sessionMinutes({ startTime: "14:05", endTime: "14:50" })).toBe(45);
    expect(sessionMinutes({ startTime: "07:30", endTime: "08:00" })).toBe(30);
  });

  it("handles midnight-adjacent times", () => {
    expect(minutesBetween("00:00", "01:30")).toBe(90);
    expect(minutesBetween("22:15", "23:59")).toBe(104);
  });
});

/* ------------------------------------------------------------------ */

function student(over: Partial<Student> & { id: string }): Student {
  return {
    name: `HS ${over.id}`,
    contact: "0900000000",
    baseMinutes: 45,
    basePrice: 100_000,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function session(over: Partial<Session> & { id: string; studentId: string }): Session {
  return {
    date: "2026-09-08",
    startTime: "09:00",
    endTime: "09:45",
    taught: false,
    ...over,
  };
}

describe("amountForSession — taught gating", () => {
  it("prices a taught session", () => {
    const s = session({ id: "s1", studentId: "a", taught: true });
    expect(amountForSession(s, studentA)).toBe(100_000);
  });

  it("contributes zero when not yet marked as taught", () => {
    const s = session({ id: "s1", studentId: "a", taught: false });
    expect(amountForSession(s, studentA)).toBe(0);
  });

  it("uses the rate snapshot so a later rate rise does not re-price it", () => {
    const s = session({
      id: "s1",
      studentId: "a",
      taught: true,
      rateSnapshot: { baseMinutes: 45, basePrice: 100_000 },
    });
    // Student's current rate has since doubled...
    const raised = { baseMinutes: 45, basePrice: 200_000 };
    // ...but the taught session keeps its original price.
    expect(amountForSession(s, raised)).toBe(100_000);
  });

  it("falls back to the current rate when no snapshot exists", () => {
    const s = session({ id: "s1", studentId: "a", taught: true });
    expect(amountForSession(s, studentB)).toBe(150_000);
  });

  it("returns 0 when the student is missing", () => {
    const s = session({ id: "s1", studentId: "ghost", taught: true });
    expect(amountForSession(s, undefined)).toBe(0);
  });
});

describe("monthTotals", () => {
  const students = [student({ id: "a" }), student({ id: "b", baseMinutes: 60, basePrice: 200_000 })];
  const sessions = [
    // Student A: two taught 45-minute lessons in September.
    session({ id: "s1", studentId: "a", date: "2026-09-08", taught: true }),
    session({ id: "s2", studentId: "a", date: "2026-09-15", taught: true }),
    // Untaught — must not count.
    session({ id: "s3", studentId: "a", date: "2026-09-22", taught: false }),
    // Different month — must not count.
    session({ id: "s4", studentId: "a", date: "2026-08-11", taught: true }),
    // Student B: one taught 90-minute lesson.
    session({
      id: "s5",
      studentId: "b",
      date: "2026-09-10",
      startTime: "18:00",
      endTime: "19:30",
      taught: true,
    }),
  ];

  it("totals only taught sessions in the requested month", () => {
    const totals = monthTotals("2026-09", students, sessions, []);
    expect(totals).toHaveLength(2);

    const a = totals.find((t) => t.studentId === "a")!;
    expect(a.sessionCount).toBe(2);
    expect(a.totalMinutes).toBe(90);
    expect(a.totalAmount).toBe(200_000);
    expect(a.status).toBe("unpaid");

    const b = totals.find((t) => t.studentId === "b")!;
    expect(b.sessionCount).toBe(1);
    expect(b.totalMinutes).toBe(90);
    expect(b.totalAmount).toBe(300_000);
  });

  it("omits students with no taught sessions that month", () => {
    const totals = monthTotals("2026-10", students, sessions, []);
    expect(totals).toEqual([]);
  });

  it("reflects paid status from the bill record", () => {
    const bills: MonthlyBill[] = [
      {
        id: "a_2026-09",
        studentId: "a",
        month: "2026-09",
        status: "paid",
        paidAt: "2026-09-30T10:00:00.000Z",
        paidAmount: 200_000,
      },
    ];
    const totals = monthTotals("2026-09", students, sessions, bills);
    const a = totals.find((t) => t.studentId === "a")!;
    expect(a.status).toBe("paid");
    expect(a.shortfall).toBe(0);
  });

  it("flags a shortfall when more sessions are taught after payment", () => {
    const bills: MonthlyBill[] = [
      {
        id: "a_2026-09",
        studentId: "a",
        month: "2026-09",
        status: "paid",
        paidAt: "2026-09-20T10:00:00.000Z",
        // Only one lesson had been taught when the parent paid.
        paidAmount: 100_000,
      },
    ];
    const totals = monthTotals("2026-09", students, sessions, bills);
    const a = totals.find((t) => t.studentId === "a")!;
    expect(a.status).toBe("paid");
    expect(a.totalAmount).toBe(200_000);
    expect(a.shortfall).toBe(100_000);
  });

  it("orders the session breakdown by date then start time", () => {
    const totals = monthTotals("2026-09", students, sessions, []);
    const a = totals.find((t) => t.studentId === "a")!;
    expect(a.lines.map((l) => l.session.id)).toEqual(["s1", "s2"]);
  });
});

describe("monthSummary", () => {
  const students = [student({ id: "a" }), student({ id: "b" })];
  const sessions = [
    session({ id: "s1", studentId: "a", date: "2026-09-08", taught: true }),
    session({ id: "s2", studentId: "b", date: "2026-09-09", taught: true }),
  ];

  it("splits the month into collected and outstanding", () => {
    const bills: MonthlyBill[] = [
      {
        id: "a_2026-09",
        studentId: "a",
        month: "2026-09",
        status: "paid",
        paidAmount: 100_000,
      },
    ];
    const summary = monthSummary(monthTotals("2026-09", students, sessions, bills));
    expect(summary.total).toBe(200_000);
    expect(summary.collected).toBe(100_000);
    expect(summary.outstanding).toBe(100_000);
    expect(summary.studentCount).toBe(2);
  });

  it("is all outstanding when nothing is paid", () => {
    const summary = monthSummary(monthTotals("2026-09", students, sessions, []));
    expect(summary.collected).toBe(0);
    expect(summary.outstanding).toBe(200_000);
  });
});

describe("outstandingDebts", () => {
  const students = [
    student({ id: "a", name: "An" }),
    student({ id: "b", name: "Bình" }),
    student({ id: "c", name: "Cường", archived: true }),
  ];

  const sessions = [
    // An owes July and August.
    session({ id: "s1", studentId: "a", date: "2026-07-07", taught: true }),
    session({ id: "s2", studentId: "a", date: "2026-08-04", taught: true }),
    // Bình owes August only.
    session({ id: "s3", studentId: "b", date: "2026-08-05", taught: true }),
    // Archived Cường still owes June.
    session({ id: "s4", studentId: "c", date: "2026-06-02", taught: true }),
    // Current month must be excluded from debt.
    session({ id: "s5", studentId: "a", date: "2026-09-08", taught: true }),
    // Untaught past session owes nothing.
    session({ id: "s6", studentId: "b", date: "2026-07-01", taught: false }),
  ];

  it("lists only months before the current month", () => {
    const debts = outstandingDebts("2026-09", students, sessions, []);
    const an = debts.find((d) => d.student.id === "a")!;
    expect(an.months.map((m) => m.month)).toEqual(["2026-07", "2026-08"]);
    expect(an.monthsOverdue).toBe(2);
    expect(an.totalOwed).toBe(200_000);
  });

  it("sorts by total owed, descending, by default", () => {
    const debts = outstandingDebts("2026-09", students, sessions, []);
    const owed = debts.map((d) => d.totalOwed);
    expect(owed).toEqual([...owed].sort((x, y) => y - x));
    expect(debts[0]!.student.id).toBe("a");
  });

  it("still reports debt for archived students", () => {
    const debts = outstandingDebts("2026-09", students, sessions, []);
    const cuong = debts.find((d) => d.student.id === "c");
    expect(cuong).toBeDefined();
    expect(cuong!.totalOwed).toBe(100_000);
    expect(cuong!.oldestMonth).toBe("2026-06");
  });

  it("excludes months that have been paid in full", () => {
    const bills: MonthlyBill[] = [
      {
        id: "a_2026-07",
        studentId: "a",
        month: "2026-07",
        status: "paid",
        paidAmount: 100_000,
      },
    ];
    const debts = outstandingDebts("2026-09", students, sessions, bills);
    const an = debts.find((d) => d.student.id === "a")!;
    expect(an.months.map((m) => m.month)).toEqual(["2026-08"]);
    expect(an.totalOwed).toBe(100_000);
  });

  it("keeps a paid-but-short month, owing only the gap", () => {
    const bills: MonthlyBill[] = [
      {
        id: "a_2026-07",
        studentId: "a",
        month: "2026-07",
        status: "paid",
        paidAmount: 40_000,
      },
    ];
    const debts = outstandingDebts("2026-09", students, sessions, bills);
    const july = debts
      .find((d) => d.student.id === "a")!
      .months.find((m) => m.month === "2026-07")!;
    expect(july.amount).toBe(60_000);
  });

  it("returns an empty list when nobody owes anything", () => {
    expect(outstandingDebts("2026-09", students, [], [])).toEqual([]);
  });
});
