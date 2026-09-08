/**
 * THE STORAGE BOUNDARY.
 *
 * This is the only module in the app that touches Firestore. Every read and
 * write goes through the `store` object below. Components must never talk to
 * Firestore directly.
 *
 * Dữ liệu nằm dưới một "workspace" document, mỗi loại là một sub-collection:
 *
 *   workspaces/{WORKSPACE_ID}/students/{id}
 *   workspaces/{WORKSPACE_ID}/sessions/{id}
 *   workspaces/{WORKSPACE_ID}/bills/{studentId_YYYY-MM}
 *
 * Tách theo collection thay vì gộp một document lớn để mỗi thao tác chỉ ghi
 * đúng bản ghi bị đổi — sửa một buổi học không phải ghi lại toàn bộ kho — và
 * để realtime chỉ đẩy phần thay đổi.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QuerySnapshot,
} from "firebase/firestore";

import { getDb, isFirebaseConfigured } from "./firebase";
import {
  billId,
  SCHEMA_VERSION,
  type AppData,
  type BillStatus,
  type MonthlyBill,
  type Session,
  type Student,
} from "./types";
import { monthOf } from "./date";
import { isValidColor } from "./colors";

/**
 * Không có đăng nhập, nên mọi thiết bị dùng chung một workspace cố định. Khi
 * thêm Firebase Auth sau này, thay hằng số này bằng `auth.currentUser.uid` là
 * dữ liệu mỗi người tự tách riêng, không phải đổi gì thêm trong file.
 */
const WORKSPACE_ID = process.env.NEXT_PUBLIC_FIREBASE_WORKSPACE_ID || "default";

/** Firestore giới hạn 500 thao tác mỗi batch. */
const BATCH_LIMIT = 500;

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export type StoreErrorKind =
  /** Dữ liệu trên máy chủ sai định dạng so với schema. */
  | "corrupt"
  /** Firestore từ chối vì hết hạn mức (quota) của gói. */
  | "quota"
  /** Không kết nối được, chưa cấu hình, hoặc security rules từ chối. */
  | "unavailable";

export class StoreError extends Error {
  readonly kind: StoreErrorKind;
  /** Chuỗi thô chưa parse được, để người dùng vẫn tải được bản sao lưu. */
  readonly raw?: string;

  constructor(kind: StoreErrorKind, message: string, raw?: string) {
    super(message);
    this.name = "StoreError";
    this.kind = kind;
    this.raw = raw;
  }
}

/** Dịch lỗi Firestore sang `StoreError` với thông báo tiếng Việt. */
function toStoreError(error: unknown, fallback: string): StoreError {
  if (error instanceof StoreError) return error;

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "permission-denied":
      return new StoreError(
        "unavailable",
        "Firestore từ chối truy cập. Kiểm tra lại security rules trong Firebase Console.",
      );
    case "unavailable":
    case "deadline-exceeded":
      return new StoreError(
        "unavailable",
        "Không kết nối được tới Firebase. Kiểm tra kết nối mạng rồi thử lại.",
      );
    case "resource-exhausted":
      return new StoreError(
        "quota",
        "Đã vượt hạn mức Firebase của ngày hôm nay. Hãy thử lại sau hoặc nâng cấp gói.",
      );
    case "failed-precondition":
      return new StoreError(
        "unavailable",
        "Firestore chưa sẵn sàng. Hãy chắc chắn bạn đã tạo cơ sở dữ liệu Firestore trong Firebase Console.",
      );
    case "unauthenticated":
      return new StoreError("unavailable", "Phiên làm việc đã hết hạn.");
    default:
      return new StoreError("unavailable", fallback);
  }
}

/* ------------------------------------------------------------------ *
 * Collection refs
 * ------------------------------------------------------------------ */

function db(): Firestore {
  return getDb();
}

function studentsRef(): CollectionReference<DocumentData> {
  return collection(db(), "workspaces", WORKSPACE_ID, "students");
}

function sessionsRef(): CollectionReference<DocumentData> {
  return collection(db(), "workspaces", WORKSPACE_ID, "sessions");
}

function billsRef(): CollectionReference<DocumentData> {
  return collection(db(), "workspaces", WORKSPACE_ID, "bills");
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validStudent(value: unknown): value is Student {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.contact === "string" &&
    typeof value.baseMinutes === "number" &&
    typeof value.basePrice === "number" &&
    typeof value.archived === "boolean" &&
    typeof value.createdAt === "string" &&
    // Bỏ trống là hợp lệ (= màu trắng); có thì phải là mã màu trong bảng.
    (value.color === undefined || isValidColor(value.color))
  );
}

function validSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.studentId === "string" &&
    typeof value.date === "string" &&
    DATE_RE.test(value.date) &&
    typeof value.startTime === "string" &&
    TIME_RE.test(value.startTime) &&
    typeof value.endTime === "string" &&
    TIME_RE.test(value.endTime) &&
    typeof value.taught === "boolean"
  );
}

function validBill(value: unknown): value is MonthlyBill {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.studentId === "string" &&
    typeof value.month === "string" &&
    MONTH_RE.test(value.month) &&
    (value.status === "paid" || value.status === "unpaid")
  );
}

/**
 * Nâng cấp dữ liệu cũ lên schema hiện tại.
 *
 * v1 -> v2: `Student.color` từng là số 1–8 trỏ tới token `--student-N`. Giờ nó
 * là mã màu chuỗi. Chuyển đúng thứ tự sắc màu cũ để học sinh đang có màu nào
 * thì vẫn hiển thị gần đúng màu đó, không bị đổi đột ngột.
 */
const V1_COLOR_ORDER = [
  "indigo-500", // 1 chàm
  "sky-500", // 2 xanh ngọc
  "emerald-500", // 3 lục
  "amber-600", // 4 ô liu -> hổ phách đậm (gần nhất trong bảng mới)
  "amber-500", // 5 hổ phách
  "orange-600", // 6 gạch
  "pink-500", // 7 hồng sen
  "purple-500", // 8 tím
];

function migrate(value: Record<string, unknown>): Record<string, unknown> {
  const version = typeof value.schemaVersion === "number" ? value.schemaVersion : 1;
  if (version >= 2) return value;
  if (!Array.isArray(value.students)) return value;

  const students = value.students.map((entry) => {
    if (!isRecord(entry)) return entry;
    const { color } = entry;
    // Chỉ chuyển khi color là số hợp lệ; ngoài ra để trống (= trắng).
    if (typeof color !== "number") return entry;
    const mapped = V1_COLOR_ORDER[color - 1];
    return mapped ? { ...entry, color: mapped } : { ...entry, color: undefined };
  });

  return { ...value, schemaVersion: 2, students };
}

/**
 * Validate a parsed object as `AppData`. Throws `StoreError('corrupt')` with a
 * specific reason so the UI can explain what is wrong.
 */
export function validateAppData(rawValue: unknown, raw?: string): AppData {
  // Nâng cấp trước khi kiểm tra, để dữ liệu v1 không bị coi là sai định dạng.
  const value = isRecord(rawValue) ? migrate(rawValue) : rawValue;
  return validateCurrent(value, raw);
}

function validateCurrent(value: unknown, raw?: string): AppData {
  if (!isRecord(value)) {
    throw new StoreError("corrupt", "Dữ liệu không phải là một đối tượng JSON hợp lệ.", raw);
  }
  if (typeof value.schemaVersion !== "number") {
    throw new StoreError("corrupt", "Thiếu trường “schemaVersion”.", raw);
  }
  if (value.schemaVersion > SCHEMA_VERSION) {
    throw new StoreError(
      "corrupt",
      `Dữ liệu thuộc phiên bản ${value.schemaVersion}, mới hơn phiên bản ứng dụng (${SCHEMA_VERSION}).`,
      raw,
    );
  }
  if (!Array.isArray(value.students)) {
    throw new StoreError("corrupt", "Trường “students” phải là một danh sách.", raw);
  }
  if (!Array.isArray(value.sessions)) {
    throw new StoreError("corrupt", "Trường “sessions” phải là một danh sách.", raw);
  }
  if (!Array.isArray(value.bills)) {
    throw new StoreError("corrupt", "Trường “bills” phải là một danh sách.", raw);
  }

  const badStudent = value.students.findIndex((s) => !validStudent(s));
  if (badStudent !== -1) {
    throw new StoreError("corrupt", `Học sinh thứ ${badStudent + 1} có dữ liệu không hợp lệ.`, raw);
  }
  const badSession = value.sessions.findIndex((s) => !validSession(s));
  if (badSession !== -1) {
    throw new StoreError("corrupt", `Buổi học thứ ${badSession + 1} có dữ liệu không hợp lệ.`, raw);
  }
  const badBill = value.bills.findIndex((b) => !validBill(b));
  if (badBill !== -1) {
    throw new StoreError("corrupt", `Hoá đơn thứ ${badBill + 1} có dữ liệu không hợp lệ.`, raw);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    students: value.students as Student[],
    sessions: value.sessions as Session[],
    bills: value.bills as MonthlyBill[],
  };
}

/* ------------------------------------------------------------------ *
 * Firestore <-> domain conversion
 * ------------------------------------------------------------------ */

/**
 * Firestore từ chối giá trị `undefined`. Các trường tuỳ chọn (`note`, `color`,
 * `paidAmount`…) khi bỏ trống phải được loại bỏ hẳn khỏi object trước khi ghi,
 * chứ không gửi `undefined` — nếu không mọi lệnh ghi sẽ ném lỗi.
 */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    out[key] = isRecord(entry) ? stripUndefined(entry) : entry;
  }
  return out as T;
}

/**
 * Đọc một snapshot thành mảng đã kiểm tra. Bản ghi hỏng bị bỏ qua và ghi log
 * thay vì làm sập cả trang: một buổi học lỗi không nên khiến người dùng mất
 * quyền xem toàn bộ thời khoá biểu.
 */
function readCollection<T>(
  snapshot: QuerySnapshot<DocumentData>,
  isValid: (value: unknown) => value is T,
  label: string,
): T[] {
  const out: T[] = [];
  for (const document of snapshot.docs) {
    const value = { ...document.data(), id: document.id };
    if (isValid(value)) {
      out.push(value);
    } else {
      console.warn(`[store] Bỏ qua ${label} sai định dạng: ${document.id}`, value);
    }
  }
  return out;
}

/** Đọc toàn bộ ba collection song song. */
async function loadAll(): Promise<AppData> {
  const [students, sessions, bills] = await Promise.all([
    getDocs(studentsRef()),
    getDocs(sessionsRef()),
    getDocs(billsRef()),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    students: readCollection(students, validStudent, "học sinh"),
    sessions: readCollection(sessions, validSession, "buổi học"),
    bills: readCollection(bills, validBill, "hoá đơn"),
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Xoá sạch một collection.
 *
 * Đọc theo trang thay vì tải cả collection một lần: Firestore giới hạn kích
 * thước một phản hồi, nên `getDocs()` trên collection lớn sẽ bị từ chối với
 * `resource-exhausted`. Mỗi vòng lấy đúng một batch, xoá, rồi lấy tiếp.
 */
async function deleteAll(ref: CollectionReference<DocumentData>): Promise<void> {
  // Chặn trên số vòng lặp: nếu một trang xoá xong mà lượt đọc kế tiếp vẫn trả
  // về đúng chừng đó document, vòng lặp sẽ không bao giờ kết thúc. Thà dừng và
  // báo lỗi còn hơn treo ứng dụng.
  const MAX_PAGES = 1000;

  for (let page = 0; page < MAX_PAGES; page++) {
    const snapshot = await getDocs(query(ref, limit(BATCH_LIMIT)));
    if (snapshot.empty) return;

    const batch = writeBatch(db());
    for (const document of snapshot.docs) {
      batch.delete(document.ref);
    }
    await batch.commit();

    // Trang chưa đầy nghĩa là đã hết dữ liệu.
    if (snapshot.size < BATCH_LIMIT) return;
  }

  throw new StoreError(
    "unavailable",
    "Xoá dữ liệu không hoàn tất — còn quá nhiều bản ghi. Hãy thử lại.",
  );
}

/* ------------------------------------------------------------------ *
 * Public interface
 * ------------------------------------------------------------------ */

export interface SessionInput {
  studentId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
  taught?: boolean;
}

export interface StudentInput {
  name: string;
  contact: string;
  baseMinutes: number;
  basePrice: number;
  note?: string;
  color?: string;
}

export interface ImportResult {
  students: number;
  sessions: number;
  bills: number;
}

/** Huỷ đăng ký theo dõi realtime. */
export type Unsubscribe = () => void;

/**
 * Firestore-backed store. Mọi phương thức đều async và ném `StoreError` khi
 * thất bại, nên `DataProvider` xử lý lỗi ở một chỗ duy nhất.
 */
export const store = {
  /** Cấu hình Firebase đã đầy đủ hay chưa. */
  isAvailable(): boolean {
    return isFirebaseConfigured();
  },

  /** Load the whole document. */
  async getAll(): Promise<AppData> {
    if (!isFirebaseConfigured()) {
      throw new StoreError(
        "unavailable",
        "Chưa cấu hình Firebase. Hãy tạo tệp .env.local theo mẫu .env.example rồi khởi động lại.",
      );
    }
    try {
      return await loadAll();
    } catch (error) {
      throw toStoreError(error, "Không tải được dữ liệu từ Firebase.");
    }
  },

  /**
   * Theo dõi thay đổi realtime trên cả ba collection.
   *
   * Firestore không có "join", nên ta mở ba listener và gộp lại. `onData` chỉ
   * được gọi sau khi cả ba đã có dữ liệu lần đầu, để giao diện không chớp qua
   * trạng thái thiếu học sinh trong lúc buổi học đã về.
   */
  subscribe(
    onData: (data: AppData) => void,
    onError: (error: StoreError) => void,
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      onError(
        new StoreError(
          "unavailable",
          "Chưa cấu hình Firebase. Hãy tạo tệp .env.local theo mẫu .env.example rồi khởi động lại.",
        ),
      );
      return () => {};
    }

    let students: Student[] | null = null;
    let sessions: Session[] | null = null;
    let bills: MonthlyBill[] | null = null;

    function emit() {
      if (students === null || sessions === null || bills === null) return;
      onData({
        schemaVersion: SCHEMA_VERSION,
        students,
        sessions,
        bills,
      });
    }

    function fail(error: unknown) {
      onError(toStoreError(error, "Mất kết nối tới Firebase."));
    }

    try {
      const unsubStudents = onSnapshot(
        studentsRef(),
        (snapshot) => {
          students = readCollection(snapshot, validStudent, "học sinh");
          emit();
        },
        fail,
      );
      const unsubSessions = onSnapshot(
        sessionsRef(),
        (snapshot) => {
          sessions = readCollection(snapshot, validSession, "buổi học");
          emit();
        },
        fail,
      );
      const unsubBills = onSnapshot(
        billsRef(),
        (snapshot) => {
          bills = readCollection(snapshot, validBill, "hoá đơn");
          emit();
        },
        fail,
      );

      return () => {
        unsubStudents();
        unsubSessions();
        unsubBills();
      };
    } catch (error) {
      fail(error);
      return () => {};
    }
  },

  /* ---------------- Students ---------------- */

  async addStudent(input: StudentInput): Promise<Student> {
    const student: Student = {
      id: makeId(),
      name: input.name.trim(),
      contact: input.contact.trim(),
      baseMinutes: input.baseMinutes,
      basePrice: input.basePrice,
      note: input.note?.trim() || undefined,
      // Mã màu lạ (vd từ bản cũ) coi như không chọn màu.
      color: isValidColor(input.color) ? input.color : undefined,
      archived: false,
      createdAt: now(),
    };
    try {
      await setDoc(doc(studentsRef(), student.id), stripUndefined({ ...student }));
    } catch (error) {
      throw toStoreError(error, "Không lưu được học sinh.");
    }
    return student;
  },

  async updateStudent(id: string, patch: Partial<StudentInput>): Promise<void> {
    // Ghi đè cả document (setDoc không merge) thay vì updateDoc, để trường bị
    // bỏ trống — ghi chú xoá đi, màu bỏ chọn — biến mất hẳn khỏi Firestore chứ
    // không còn sót giá trị cũ.
    try {
      const ref = doc(studentsRef(), id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new StoreError("corrupt", "Không tìm thấy học sinh cần sửa.");
      }
      const current = { ...snapshot.data(), id } as Student;

      const next: Student = {
        ...current,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : current.name,
        contact: patch.contact !== undefined ? patch.contact.trim() : current.contact,
        note: patch.note !== undefined ? patch.note.trim() || undefined : current.note,
        // "color" in patch: phân biệt "bỏ chọn màu" với "không sửa màu".
        color:
          "color" in patch
            ? isValidColor(patch.color)
              ? patch.color
              : undefined
            : current.color,
      };

      await setDoc(ref, stripUndefined({ ...next }));
    } catch (error) {
      throw toStoreError(error, "Không cập nhật được học sinh.");
    }
  },

  async setStudentArchived(id: string, archived: boolean): Promise<void> {
    try {
      await updateDoc(doc(studentsRef(), id), { archived });
    } catch (error) {
      throw toStoreError(error, "Không đổi được trạng thái học sinh.");
    }
  },

  /** Deletes the student *and* all their sessions and bills. Irreversible. */
  async deleteStudent(id: string): Promise<void> {
    try {
      // Lọc bằng query trên máy chủ thay vì tải cả collection về rồi lọc —
      // nhanh hơn, rẻ hơn, và không đụng giới hạn kích thước phản hồi.
      const [sessions, bills] = await Promise.all([
        getDocs(query(sessionsRef(), where("studentId", "==", id))),
        getDocs(query(billsRef(), where("studentId", "==", id))),
      ]);

      const doomed: DocumentReference<DocumentData>[] = [
        doc(studentsRef(), id),
        ...sessions.docs.map((d) => d.ref),
        ...bills.docs.map((d) => d.ref),
      ];

      for (let i = 0; i < doomed.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db());
        for (const ref of doomed.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
        await batch.commit();
      }
    } catch (error) {
      throw toStoreError(error, "Không xoá được học sinh.");
    }
  },

  /* ---------------- Sessions ---------------- */

  async addSession(input: SessionInput): Promise<Session> {
    try {
      const taught = input.taught ?? false;

      // Chỉ đọc học sinh khi thật sự cần đóng băng đơn giá.
      let student: Student | undefined;
      if (taught) {
        const snapshot = await getDoc(doc(studentsRef(), input.studentId));
        if (snapshot.exists()) {
          student = { ...snapshot.data(), id: input.studentId } as Student;
        }
      }

      const session: Session = {
        id: makeId(),
        studentId: input.studentId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        taught,
        note: input.note?.trim() || undefined,
        ...(taught && student
          ? {
              taughtAt: now(),
              rateSnapshot: {
                baseMinutes: student.baseMinutes,
                basePrice: student.basePrice,
              },
            }
          : {}),
      };

      await setDoc(doc(sessionsRef(), session.id), stripUndefined({ ...session }));
      return session;
    } catch (error) {
      throw toStoreError(error, "Không lưu được buổi học.");
    }
  },

  async updateSession(id: string, patch: Partial<SessionInput>): Promise<void> {
    try {
      const ref = doc(sessionsRef(), id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new StoreError("corrupt", "Không tìm thấy buổi học cần sửa.");
      }
      const current = { ...snapshot.data(), id } as Session;

      const next: Session = {
        ...current,
        ...patch,
        note: patch.note !== undefined ? patch.note.trim() || undefined : current.note,
      };

      await setDoc(ref, stripUndefined({ ...next }));
    } catch (error) {
      throw toStoreError(error, "Không cập nhật được buổi học.");
    }
  },

  /**
   * Toggle the taught flag. Marking as taught freezes the student's current
   * rate onto the session; un-marking clears the snapshot so a later re-mark
   * picks up whatever the rate is then.
   */
  async setSessionTaught(id: string, taught: boolean): Promise<void> {
    try {
      const ref = doc(sessionsRef(), id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new StoreError("corrupt", "Không tìm thấy buổi học.");
      }
      const session = { ...snapshot.data(), id } as Session;

      if (!taught) {
        // Bỏ snapshot để lần đánh dấu sau lấy đơn giá tại thời điểm đó.
        const next = { ...session, taught: false };
        delete next.rateSnapshot;
        delete next.taughtAt;
        await setDoc(ref, stripUndefined({ ...next }));
        return;
      }

      const studentSnapshot = await getDoc(doc(studentsRef(), session.studentId));
      const student = studentSnapshot.exists()
        ? ({ ...studentSnapshot.data(), id: session.studentId } as Student)
        : undefined;

      const next: Session = {
        ...session,
        taught: true,
        taughtAt: now(),
        rateSnapshot: student
          ? { baseMinutes: student.baseMinutes, basePrice: student.basePrice }
          : session.rateSnapshot,
      };

      await setDoc(ref, stripUndefined({ ...next }));
    } catch (error) {
      throw toStoreError(error, "Không đổi được trạng thái buổi học.");
    }
  },

  async deleteSession(id: string): Promise<void> {
    try {
      await deleteDoc(doc(sessionsRef(), id));
    } catch (error) {
      throw toStoreError(error, "Không xoá được buổi học.");
    }
  },

  /**
   * Copy every session from the week before `weekStart` into that week.
   * Copies are always untaught. Exact duplicates (same student, weekday and
   * times) are skipped, and archived students are left out.
   *
   * @param mode `append` keeps existing sessions; `replace` clears the target
   *   week's sessions first.
   * @returns how many sessions were created and how many duplicates skipped.
   */
  async applyPreviousWeek(
    weekStart: string,
    previousWeekStart: string,
    mode: "append" | "replace",
  ): Promise<{ created: number; skipped: number }> {
    try {
      const data = await loadAll();

      const targetDates = weekDatesFrom(weekStart);
      const sourceDates = weekDatesFrom(previousWeekStart);
      const targetSet = new Set(targetDates);
      const sourceSet = new Set(sourceDates);

      const archived = new Set(data.students.filter((s) => s.archived).map((s) => s.id));

      const sourceSessions = data.sessions.filter(
        (s) => sourceSet.has(s.date) && !archived.has(s.studentId),
      );

      // Ở chế độ replace, tuần đích được dọn trước khi chép sang.
      const removed =
        mode === "replace" ? data.sessions.filter((s) => targetSet.has(s.date)) : [];
      const removedIds = new Set(removed.map((s) => s.id));
      const remaining = data.sessions.filter((s) => !removedIds.has(s.id));

      // Signature of what already occupies the target week.
      const existing = new Set(
        remaining
          .filter((s) => targetSet.has(s.date))
          .map((s) => `${s.studentId}|${s.date}|${s.startTime}|${s.endTime}`),
      );

      const created: Session[] = [];
      let skipped = 0;

      for (const source of sourceSessions) {
        const dayIndex = sourceDates.indexOf(source.date);
        if (dayIndex === -1) continue;
        const date = targetDates[dayIndex]!;
        const signature = `${source.studentId}|${date}|${source.startTime}|${source.endTime}`;

        if (existing.has(signature)) {
          skipped++;
          continue;
        }
        existing.add(signature);

        created.push({
          id: makeId(),
          studentId: source.studentId,
          date,
          startTime: source.startTime,
          endTime: source.endTime,
          taught: false,
          note: source.note,
        });
      }

      // Gộp xoá và thêm vào cùng chuỗi batch, để tuần đích không rơi vào trạng
      // thái đã xoá nhưng chưa chép xong.
      type Op = { kind: "delete"; id: string } | { kind: "set"; session: Session };
      const ops: Op[] = [
        ...removed.map((s): Op => ({ kind: "delete", id: s.id })),
        ...created.map((s): Op => ({ kind: "set", session: s })),
      ];

      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db());
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          if (op.kind === "delete") {
            batch.delete(doc(sessionsRef(), op.id));
          } else {
            batch.set(doc(sessionsRef(), op.session.id), stripUndefined({ ...op.session }));
          }
        }
        await batch.commit();
      }

      return { created: created.length, skipped };
    } catch (error) {
      throw toStoreError(error, "Không áp dụng được lịch tuần trước.");
    }
  },

  /* ---------------- Monthly bills ---------------- */

  /**
   * Mark a student's month paid or unpaid. `amount` records what was actually
   * settled, so sessions taught later can be detected as a shortfall.
   */
  async setBillStatus(
    studentId: string,
    month: string,
    status: BillStatus,
    amount?: number,
  ): Promise<void> {
    try {
      const id = billId(studentId, month);
      const ref = doc(billsRef(), id);

      if (status === "unpaid") {
        // Không có bản ghi đã nghĩa là chưa thu — xoá hẳn.
        await deleteDoc(ref);
        return;
      }

      const snapshot = await getDoc(ref);
      const existingNote = snapshot.exists()
        ? (snapshot.data().note as string | undefined)
        : undefined;

      const bill: MonthlyBill = {
        id,
        studentId,
        month,
        status: "paid",
        paidAt: now(),
        paidAmount: amount,
        note: existingNote,
      };

      await setDoc(ref, stripUndefined({ ...bill }));
    } catch (error) {
      throw toStoreError(error, "Không cập nhật được hoá đơn.");
    }
  },

  async setBillNote(studentId: string, month: string, note: string): Promise<void> {
    try {
      const id = billId(studentId, month);
      const ref = doc(billsRef(), id);
      const trimmed = note.trim() || undefined;
      const snapshot = await getDoc(ref);

      if (!snapshot.exists()) {
        await setDoc(
          ref,
          stripUndefined({ id, studentId, month, status: "unpaid", note: trimmed }),
        );
        return;
      }

      const next = { ...snapshot.data(), id, note: trimmed } as MonthlyBill;
      await setDoc(ref, stripUndefined({ ...next }));
    } catch (error) {
      throw toStoreError(error, "Không lưu được ghi chú hoá đơn.");
    }
  },

  /* ---------------- Backup ---------------- */

  /** Pretty-printed JSON of the whole document, for download. */
  async exportJSON(): Promise<string> {
    return JSON.stringify(await this.getAll(), null, 2);
  },

  /**
   * Replace all data with the contents of `json`.
   * Validates fully *before* writing — invalid input never overwrites
   * existing data.
   */
  async importJSON(json: string): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "không rõ nguyên nhân";
      throw new StoreError("corrupt", `Tệp không phải JSON hợp lệ (${detail}).`);
    }

    const data = validateAppData(parsed);

    try {
      // Bản nhập thay thế hoàn toàn dữ liệu cũ, nên phải xoá những gì đang có
      // trước khi ghi. Đọc một lượt để biết chính xác cần xoá gì, thay vì quét
      // lại từng collection — một lượt đọc thay cho nhiều vòng lặp phân trang.
      const current = await loadAll();

      interface Write {
        ref: DocumentReference<DocumentData>;
        value: Record<string, unknown>;
      }
      const writes: Write[] = [
        ...data.students.map((s) => ({
          ref: doc(studentsRef(), s.id),
          value: stripUndefined({ ...s }) as Record<string, unknown>,
        })),
        ...data.sessions.map((s) => ({
          ref: doc(sessionsRef(), s.id),
          value: stripUndefined({ ...s }) as Record<string, unknown>,
        })),
        ...data.bills.map((b) => ({
          ref: doc(billsRef(), b.id),
          value: stripUndefined({ ...b }) as Record<string, unknown>,
        })),
      ];

      // Chỉ xoá bản ghi cũ không bị bản nhập ghi đè — bản bị ghi đè thì lệnh
      // `set` bên dưới đã thay nội dung, xoá thêm chỉ tốn thao tác.
      const kept = new Set(writes.map((w) => w.ref.path));
      const doomed: DocumentReference<DocumentData>[] = [
        ...current.students.map((s) => doc(studentsRef(), s.id)),
        ...current.sessions.map((s) => doc(sessionsRef(), s.id)),
        ...current.bills.map((b) => doc(billsRef(), b.id)),
      ].filter((ref) => !kept.has(ref.path));

      type Op =
        | { kind: "delete"; ref: DocumentReference<DocumentData> }
        | { kind: "set"; write: Write };
      const ops: Op[] = [
        ...doomed.map((ref): Op => ({ kind: "delete", ref })),
        ...writes.map((write): Op => ({ kind: "set", write })),
      ];

      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db());
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          if (op.kind === "delete") {
            batch.delete(op.ref);
          } else {
            batch.set(op.write.ref, op.write.value);
          }
        }
        await batch.commit();
      }
    } catch (error) {
      throw toStoreError(error, "Không nhập được dữ liệu lên Firebase.");
    }

    return {
      students: data.students.length,
      sessions: data.sessions.length,
      bills: data.bills.length,
    };
  },

  /** Wipe everything. The caller is responsible for confirming first. */
  async reset(): Promise<void> {
    try {
      await Promise.all([
        deleteAll(studentsRef()),
        deleteAll(sessionsRef()),
        deleteAll(billsRef()),
      ]);
    } catch (error) {
      throw toStoreError(error, "Không xoá được dữ liệu.");
    }
  },

  /**
   * Bản JSON thô của toàn bộ dữ liệu — dùng để sao lưu khi dữ liệu hỏng. Với
   * Firestore, bản ghi hỏng đã bị bỏ qua ngay khi đọc, nên hàm này trả về
   * những gì đọc được thay vì chuỗi thô như bản localStorage.
   */
  async readRawUnsafe(): Promise<string | null> {
    try {
      return JSON.stringify(await loadAll());
    } catch {
      return null;
    }
  },

  /** Approximate size of the stored document, for the settings page. */
  async storageSize(): Promise<number> {
    const raw = await this.readRawUnsafe();
    return raw ? new Blob([raw]).size : 0;
  },
} as const;

/* Local copy to avoid a circular import with date.ts helpers used above. */
function weekDatesFrom(monday: string): string[] {
  const [y, m, d] = monday.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + i);
    out.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`,
    );
  }
  return out;
}

/** Re-exported so callers can group sessions by month without importing date.ts. */
export { monthOf };
