/**
 * Domain types. Pure data shapes — no storage or UI concerns.
 */

/** The billing duration units a student's rate may be expressed in. */
export const BASE_MINUTES_OPTIONS = [45, 60, 90, 120, 150, 180, 210] as const;
export type BaseMinutes = (typeof BASE_MINUTES_OPTIONS)[number];

/**
 * A student's rate frozen at a point in time. Copied onto a session when it is
 * marked as taught so that later rate changes never re-price past lessons.
 */
export interface RateSnapshot {
  baseMinutes: number;
  basePrice: number;
}

export interface Student {
  id: string;
  name: string;
  /** Phone / Zalo / email — free text. */
  contact: string;
  /** The billing duration unit, in minutes. */
  baseMinutes: number;
  /** Price for one `baseMinutes` unit, in VND. */
  basePrice: number;
  note?: string;
  /**
   * Màu hiển thị trên thời khoá biểu, dạng `"<sắc>-<bậc>"` (vd `"indigo-500"`).
   * Bỏ trống thì khối buổi học để trắng — đây là trạng thái mặc định hợp lệ.
   */
  color?: string;
  /** Student has stopped taking lessons. Kept for history and debt. */
  archived: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface Session {
  id: string;
  studentId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm — arbitrary times allowed, not snapped to 30-minute increments. */
  startTime: string;
  /** HH:mm — must be after `startTime` on the same day. */
  endTime: string;
  /** Only taught sessions are billed. */
  taught: boolean;
  /** ISO 8601 timestamp of when `taught` was last set to true. */
  taughtAt?: string;
  /** The student's rate at the moment this session was marked as taught. */
  rateSnapshot?: RateSnapshot;
  note?: string;
}

export type BillStatus = "unpaid" | "paid";

export interface MonthlyBill {
  /** `{studentId}_{YYYY-MM}` */
  id: string;
  studentId: string;
  /** YYYY-MM */
  month: string;
  status: BillStatus;
  /** ISO 8601 timestamp of when the bill was marked paid. */
  paidAt?: string;
  note?: string;
  /**
   * Amount that was actually settled when the bill was marked paid. Lets us
   * detect sessions taught *after* payment (the "underpaid" case) instead of
   * silently absorbing them.
   */
  paidAmount?: number;
}

/** The full persisted document. */
export interface AppData {
  schemaVersion: number;
  students: Student[];
  sessions: Session[];
  bills: MonthlyBill[];
}

// v2: Student.color chuyển từ số (1–8) sang mã màu chuỗi ("indigo-500").
export const SCHEMA_VERSION = 2;

export function emptyAppData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    students: [],
    sessions: [],
    bills: [],
  };
}

/** Composite key for a monthly bill. */
export function billId(studentId: string, month: string): string {
  return `${studentId}_${month}`;
}
