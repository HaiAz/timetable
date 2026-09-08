import type { MonthlyBill, RateSnapshot, Session, Student } from "./types";
import { monthOf } from "./date";

/**
 * Duration of a session in whole minutes.
 * Times are HH:mm on the same calendar day.
 */
export function sessionMinutes(session: Pick<Session, "startTime" | "endTime">): number {
  return minutesBetween(session.startTime, session.endTime);
}

export function minutesBetween(startTime: string, endTime: string): number {
  return toMinutes(endTime) - toMinutes(startTime);
}

/** "HH:mm" -> minutes since midnight. */
export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** minutes since midnight -> "HH:mm" */
export function toTimeString(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The billing formula.
 *
 *   sessionAmount = round( minutes × basePrice / baseMinutes / 1000 ) × 1000
 *
 * Linear pro-rata on duration, then rounded to the nearest 1,000 VND.
 */
export function sessionAmount(minutes: number, rate: RateSnapshot): number {
  const { baseMinutes, basePrice } = rate;
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) return 0;
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;

  return Math.round((minutes * basePrice) / baseMinutes / 1000) * 1000;
}

/**
 * The rate that applies to a session: the snapshot taken when it was marked
 * taught, falling back to the student's current rate for untaught sessions.
 * This is what keeps a rate rise from re-pricing past lessons.
 */
export function rateForSession(
  session: Pick<Session, "rateSnapshot">,
  student: Pick<Student, "baseMinutes" | "basePrice"> | undefined,
): RateSnapshot | undefined {
  if (session.rateSnapshot) return session.rateSnapshot;
  if (!student) return undefined;
  return { baseMinutes: student.baseMinutes, basePrice: student.basePrice };
}

/**
 * Billable amount for one session. A session that has not been marked as
 * taught contributes zero.
 */
export function amountForSession(
  session: Session,
  student: Pick<Student, "baseMinutes" | "basePrice"> | undefined,
): number {
  if (!session.taught) return 0;
  const rate = rateForSession(session, student);
  if (!rate) return 0;
  return sessionAmount(sessionMinutes(session), rate);
}

/**
 * The projected amount for a session being drafted in the "add session" modal,
 * i.e. what it *will* be worth once taught.
 */
export function projectedAmount(
  startTime: string,
  endTime: string,
  student: Pick<Student, "baseMinutes" | "basePrice"> | undefined,
): number {
  if (!student) return 0;
  const minutes = minutesBetween(startTime, endTime);
  if (minutes <= 0) return 0;
  return sessionAmount(minutes, {
    baseMinutes: student.baseMinutes,
    basePrice: student.basePrice,
  });
}

/** One session, priced, for display in a reconciliation breakdown. */
export interface SessionLine {
  session: Session;
  minutes: number;
  amount: number;
}

/** A student's total for one month, computed from taught sessions. */
export interface StudentMonthTotal {
  studentId: string;
  month: string;
  lines: SessionLine[];
  sessionCount: number;
  totalMinutes: number;
  totalAmount: number;
  status: "paid" | "unpaid";
  paidAt?: string;
  /** Amount settled at payment time, when that differs from the total now. */
  paidAmount?: number;
  /**
   * Total grew after the month was marked paid (extra sessions taught later).
   * Positive when money is still outstanding on a "paid" month.
   */
  shortfall: number;
}

/**
 * Aggregate taught sessions for one student in one month.
 * Returns `null` when the student has no taught sessions that month.
 */
export function studentMonthTotal(
  studentId: string,
  month: string,
  sessions: Session[],
  student: Pick<Student, "baseMinutes" | "basePrice"> | undefined,
  bill: MonthlyBill | undefined,
): StudentMonthTotal | null {
  const lines: SessionLine[] = [];

  for (const session of sessions) {
    if (session.studentId !== studentId) continue;
    if (!session.taught) continue;
    if (monthOf(session.date) !== month) continue;

    const minutes = sessionMinutes(session);
    lines.push({
      session,
      minutes,
      amount: amountForSession(session, student),
    });
  }

  if (lines.length === 0) return null;

  lines.sort(
    (a, b) =>
      a.session.date.localeCompare(b.session.date) ||
      a.session.startTime.localeCompare(b.session.startTime),
  );

  const totalMinutes = lines.reduce((sum, l) => sum + l.minutes, 0);
  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);
  const status = bill?.status === "paid" ? "paid" : "unpaid";

  // If the month was settled for less than it is now worth, surface the gap
  // rather than quietly changing the paid status.
  const shortfall =
    status === "paid" && bill?.paidAmount !== undefined
      ? Math.max(0, totalAmount - bill.paidAmount)
      : 0;

  return {
    studentId,
    month,
    lines,
    sessionCount: lines.length,
    totalMinutes,
    totalAmount,
    status,
    paidAt: bill?.paidAt,
    paidAmount: bill?.paidAmount,
    shortfall,
  };
}

/**
 * Every student with at least one taught session in `month`, priced.
 * Sorted by name.
 */
export function monthTotals(
  month: string,
  students: Student[],
  sessions: Session[],
  bills: MonthlyBill[],
): StudentMonthTotal[] {
  const billByKey = new Map(bills.map((b) => [`${b.studentId}_${b.month}`, b]));
  const totals: StudentMonthTotal[] = [];

  for (const student of students) {
    const total = studentMonthTotal(
      student.id,
      month,
      sessions,
      student,
      billByKey.get(`${student.id}_${month}`),
    );
    if (total) totals.push(total);
  }

  return totals.sort((a, b) => {
    const nameA = students.find((s) => s.id === a.studentId)?.name ?? "";
    const nameB = students.find((s) => s.id === b.studentId)?.name ?? "";
    return nameA.localeCompare(nameB, "vi");
  });
}

/** Headline figures for the collect-payment summary cards. */
export interface MonthSummary {
  total: number;
  collected: number;
  outstanding: number;
  studentCount: number;
}

export function monthSummary(totals: StudentMonthTotal[]): MonthSummary {
  let total = 0;
  let collected = 0;

  for (const t of totals) {
    total += t.totalAmount;
    // A "paid" month counts as collected only up to what was actually settled.
    if (t.status === "paid") {
      collected += t.paidAmount !== undefined ? Math.min(t.paidAmount, t.totalAmount) : t.totalAmount;
    }
  }

  return {
    total,
    collected,
    outstanding: total - collected,
    studentCount: totals.length,
  };
}

/** One unpaid month in a student's debt record. */
export interface DebtMonth {
  month: string;
  amount: number;
  sessionCount: number;
  totalMinutes: number;
  lines: SessionLine[];
}

export interface StudentDebt {
  student: Student;
  months: DebtMonth[];
  totalOwed: number;
  /** How many distinct months are unpaid. */
  monthsOverdue: number;
  /** Earliest unpaid month, YYYY-MM. */
  oldestMonth: string;
}

/**
 * Students who still owe tuition for months strictly before `currentMonth`.
 * Includes archived students — archiving must not hide a debt.
 */
export function outstandingDebts(
  currentMonth: string,
  students: Student[],
  sessions: Session[],
  bills: MonthlyBill[],
): StudentDebt[] {
  const billByKey = new Map(bills.map((b) => [`${b.studentId}_${b.month}`, b]));

  // Collect the past months in which each student actually taught.
  const monthsByStudent = new Map<string, Set<string>>();
  for (const session of sessions) {
    if (!session.taught) continue;
    const month = monthOf(session.date);
    if (month >= currentMonth) continue;
    let set = monthsByStudent.get(session.studentId);
    if (!set) {
      set = new Set<string>();
      monthsByStudent.set(session.studentId, set);
    }
    set.add(month);
  }

  const debts: StudentDebt[] = [];

  for (const student of students) {
    const months = monthsByStudent.get(student.id);
    if (!months) continue;

    const debtMonths: DebtMonth[] = [];

    for (const month of [...months].sort()) {
      const total = studentMonthTotal(
        student.id,
        month,
        sessions,
        student,
        billByKey.get(`${student.id}_${month}`),
      );
      if (!total) continue;

      // Unpaid months owe the full total; paid-but-short months owe the gap.
      const owed = total.status === "paid" ? total.shortfall : total.totalAmount;
      if (owed <= 0) continue;

      debtMonths.push({
        month,
        amount: owed,
        sessionCount: total.sessionCount,
        totalMinutes: total.totalMinutes,
        lines: total.lines,
      });
    }

    if (debtMonths.length === 0) continue;

    debts.push({
      student,
      months: debtMonths,
      totalOwed: debtMonths.reduce((sum, m) => sum + m.amount, 0),
      monthsOverdue: debtMonths.length,
      oldestMonth: debtMonths[0]!.month,
    });
  }

  // Default sort: largest debt first.
  return debts.sort((a, b) => b.totalOwed - a.totalOwed);
}
