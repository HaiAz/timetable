/**
 * Store tests.
 *
 * These exercise the storage boundary against the Firestore emulator, covering
 * the behaviours that protect money: rate snapshots, taught toggling, the
 * apply-last-week copy rules, and import/export safety.
 *
 * Cần emulator đang chạy — `pnpm test` tự khởi động qua `firebase emulators:exec`.
 * Chạy vitest trực tiếp mà không có emulator thì các test này sẽ báo lỗi kết nối.
 */
import { beforeEach, describe, expect, it } from "vitest";

// Trỏ store sang emulator *trước* khi import nó, vì `getDb()` đọc biến này ở
// lần khởi tạo đầu tiên và cache lại kết nối.
process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "timetable-test";

const { store, StoreError } = await import("./store");
const { sessionAmount } = await import("./billing");
const { SCHEMA_VERSION } = await import("./types");

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST!;

/**
 * Xoá sạch dữ liệu giữa các test bằng REST endpoint của emulator.
 *
 * Nhanh hơn hẳn `store.reset()` — vốn phải liệt kê rồi xoá từng document qua
 * giao thức gRPC — nên bộ test chạy trong vài giây thay vì hàng chục phút.
 */
async function clearFirestore() {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(
      `Không xoá được dữ liệu emulator (HTTP ${response.status}). Emulator đã chạy chưa?`,
    );
  }
}

beforeEach(clearFirestore);

async function addStudentA() {
  return store.addStudent({
    name: "Nguyễn An",
    contact: "0901234567",
    baseMinutes: 45,
    basePrice: 100_000,
  });
}

describe("students", () => {
  it("starts empty", async () => {
    const data = await store.getAll();
    expect(data.students).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.bills).toEqual([]);
  });

  it("adds a student with archived=false and a createdAt", async () => {
    const student = await addStudentA();
    expect(student.archived).toBe(false);
    expect(student.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const data = await store.getAll();
    expect(data.students).toHaveLength(1);
    expect(data.students[0]!.name).toBe("Nguyễn An");
  });

  it("trims whitespace and drops an empty note", async () => {
    const student = await store.addStudent({
      name: "  Bình  ",
      contact: "  0900  ",
      baseMinutes: 60,
      basePrice: 200_000,
      note: "   ",
    });
    expect(student.name).toBe("Bình");
    expect(student.contact).toBe("0900");
    expect(student.note).toBeUndefined();
  });

  it("updates a student", async () => {
    const student = await addStudentA();
    await store.updateStudent(student.id, { basePrice: 150_000 });
    const data = await store.getAll();
    expect(data.students[0]!.basePrice).toBe(150_000);
    // Untouched fields survive.
    expect(data.students[0]!.name).toBe("Nguyễn An");
  });

  it("archives and unarchives", async () => {
    const student = await addStudentA();
    await store.setStudentArchived(student.id, true);
    expect((await store.getAll()).students[0]!.archived).toBe(true);
    await store.setStudentArchived(student.id, false);
    expect((await store.getAll()).students[0]!.archived).toBe(false);
  });

  it("deleting a student also removes their sessions and bills", async () => {
    const student = await addStudentA();
    await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });
    await store.setBillStatus(student.id, "2026-09", "paid", 100_000);

    await store.deleteStudent(student.id);
    const data = await store.getAll();
    expect(data.students).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.bills).toEqual([]);
  });
});

describe("sessions and the rate snapshot", () => {
  it("creates an untaught session with no snapshot", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });
    expect(session.taught).toBe(false);
    expect(session.rateSnapshot).toBeUndefined();
    expect(session.taughtAt).toBeUndefined();
  });

  it("freezes the rate when marked taught", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });

    await store.setSessionTaught(session.id, true);
    const stored = (await store.getAll()).sessions[0]!;
    expect(stored.taught).toBe(true);
    expect(stored.taughtAt).toBeDefined();
    expect(stored.rateSnapshot).toEqual({ baseMinutes: 45, basePrice: 100_000 });
  });

  it("a later rate rise does not re-price an already-taught session", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });
    await store.setSessionTaught(session.id, true);

    // The tutor raises the rate afterwards.
    await store.updateStudent(student.id, { basePrice: 200_000 });

    const data = await store.getAll();
    const snapshot = data.sessions[0]!.rateSnapshot!;
    expect(snapshot.basePrice).toBe(100_000);
    expect(sessionAmount(45, snapshot)).toBe(100_000);
    // The student's current rate did change.
    expect(data.students[0]!.basePrice).toBe(200_000);
  });

  it("un-marking clears the snapshot so a re-mark picks up the new rate", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });

    await store.setSessionTaught(session.id, true);
    await store.setSessionTaught(session.id, false);

    let stored = (await store.getAll()).sessions[0]!;
    expect(stored.taught).toBe(false);
    expect(stored.rateSnapshot).toBeUndefined();
    expect(stored.taughtAt).toBeUndefined();

    await store.updateStudent(student.id, { basePrice: 200_000 });
    await store.setSessionTaught(session.id, true);

    stored = (await store.getAll()).sessions[0]!;
    expect(stored.rateSnapshot).toEqual({ baseMinutes: 45, basePrice: 200_000 });
  });

  it("toggling taught works repeatedly in both directions", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });

    for (const expected of [true, false, true, false]) {
      await store.setSessionTaught(session.id, expected);
      expect((await store.getAll()).sessions[0]!.taught).toBe(expected);
    }
  });

  it("accepts arbitrary, non-half-hour times", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "14:07",
      endTime: "15:23",
    });
    expect(session.startTime).toBe("14:07");
    expect(session.endTime).toBe("15:23");
  });

  it("deletes a session", async () => {
    const student = await addStudentA();
    const session = await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });
    await store.deleteSession(session.id);
    expect((await store.getAll()).sessions).toEqual([]);
  });
});

describe("applyPreviousWeek", () => {
  // 2026-09-07 is a Monday; the previous week starts 2026-08-31.
  const week = "2026-09-07";
  const prevWeek = "2026-08-31";

  async function seedPreviousWeek() {
    const student = await addStudentA();
    // Monday and Wednesday of the previous week, both taught.
    const a = await store.addSession({
      studentId: student.id,
      date: "2026-08-31",
      startTime: "18:00",
      endTime: "19:30",
    });
    const b = await store.addSession({
      studentId: student.id,
      date: "2026-09-02",
      startTime: "18:00",
      endTime: "19:30",
    });
    await store.setSessionTaught(a.id, true);
    await store.setSessionTaught(b.id, true);
    return student;
  }

  it("copies to the same weekdays, always untaught", async () => {
    await seedPreviousWeek();
    const result = await store.applyPreviousWeek(week, prevWeek, "append");
    expect(result.created).toBe(2);

    const copies = (await store.getAll()).sessions.filter(
      (s) => s.date >= week && s.date <= "2026-09-13",
    );
    expect(copies.map((s) => s.date).sort()).toEqual(["2026-09-07", "2026-09-09"]);
    expect(copies.every((s) => s.taught === false)).toBe(true);
    expect(copies.every((s) => s.rateSnapshot === undefined)).toBe(true);
    // Times are preserved.
    expect(copies.every((s) => s.startTime === "18:00")).toBe(true);
  });

  it("leaves the source week untouched", async () => {
    await seedPreviousWeek();
    await store.applyPreviousWeek(week, prevWeek, "append");

    const source = (await store.getAll()).sessions.filter(
      (s) => s.date >= prevWeek && s.date <= "2026-09-06",
    );
    expect(source).toHaveLength(2);
    // Editing one week must never affect another.
    expect(source.every((s) => s.taught === true)).toBe(true);
  });

  it("skips exact duplicates on a second run", async () => {
    await seedPreviousWeek();
    await store.applyPreviousWeek(week, prevWeek, "append");
    const second = await store.applyPreviousWeek(week, prevWeek, "append");

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    expect((await store.getAll()).sessions).toHaveLength(4);
  });

  it("append keeps existing sessions in the target week", async () => {
    const student = await seedPreviousWeek();
    // A different time, so not a duplicate.
    await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "07:00",
      endTime: "08:00",
    });

    const result = await store.applyPreviousWeek(week, prevWeek, "append");
    expect(result.created).toBe(2);

    const target = (await store.getAll()).sessions.filter(
      (s) => s.date >= week && s.date <= "2026-09-13",
    );
    expect(target).toHaveLength(3);
  });

  it("replace clears the target week first", async () => {
    const student = await seedPreviousWeek();
    await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "07:00",
      endTime: "08:00",
    });

    await store.applyPreviousWeek(week, prevWeek, "replace");

    const target = (await store.getAll()).sessions.filter(
      (s) => s.date >= week && s.date <= "2026-09-13",
    );
    expect(target).toHaveLength(2);
    expect(target.some((s) => s.startTime === "07:00")).toBe(false);
  });

  it("does not copy sessions of archived students", async () => {
    const student = await seedPreviousWeek();
    await store.setStudentArchived(student.id, true);

    const result = await store.applyPreviousWeek(week, prevWeek, "append");
    expect(result.created).toBe(0);
  });

  it("reports nothing to copy for an empty previous week", async () => {
    await addStudentA();
    const result = await store.applyPreviousWeek(week, prevWeek, "append");
    expect(result).toEqual({ created: 0, skipped: 0 });
  });
});

describe("monthly bills", () => {
  it("records the settled amount when marked paid", async () => {
    const student = await addStudentA();
    await store.setBillStatus(student.id, "2026-09", "paid", 300_000);

    const bill = (await store.getAll()).bills[0]!;
    expect(bill.id).toBe(`${student.id}_2026-09`);
    expect(bill.status).toBe("paid");
    expect(bill.paidAmount).toBe(300_000);
    expect(bill.paidAt).toBeDefined();
  });

  it("marking unpaid removes the record, since absence means unpaid", async () => {
    const student = await addStudentA();
    await store.setBillStatus(student.id, "2026-09", "paid", 300_000);
    await store.setBillStatus(student.id, "2026-09", "unpaid");
    expect((await store.getAll()).bills).toEqual([]);
  });

  it("is undoable — paid, unpaid, paid again", async () => {
    const student = await addStudentA();
    await store.setBillStatus(student.id, "2026-09", "paid", 100_000);
    await store.setBillStatus(student.id, "2026-09", "unpaid");
    await store.setBillStatus(student.id, "2026-09", "paid", 250_000);

    const bills = (await store.getAll()).bills;
    expect(bills).toHaveLength(1);
    expect(bills[0]!.paidAmount).toBe(250_000);
  });

  it("keeps one record per student per month", async () => {
    const student = await addStudentA();
    await store.setBillStatus(student.id, "2026-09", "paid", 100_000);
    await store.setBillStatus(student.id, "2026-09", "paid", 200_000);
    await store.setBillStatus(student.id, "2026-10", "paid", 300_000);

    const bills = (await store.getAll()).bills;
    expect(bills).toHaveLength(2);
    expect(bills.find((b) => b.month === "2026-09")!.paidAmount).toBe(200_000);
  });
});

describe("export and import", () => {
  it("round-trips the whole document", async () => {
    const student = await addStudentA();
    await store.addSession({
      studentId: student.id,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "09:45",
    });
    await store.setBillStatus(student.id, "2026-09", "paid", 100_000);

    const json = await store.exportJSON();
    await store.reset();
    expect((await store.getAll()).students).toEqual([]);

    const result = await store.importJSON(json);
    expect(result).toEqual({ students: 1, sessions: 1, bills: 1, todos: 0 });

    const restored = await store.getAll();
    expect(restored.students[0]!.name).toBe("Nguyễn An");
    expect(restored.sessions[0]!.startTime).toBe("09:00");
    expect(restored.bills[0]!.paidAmount).toBe(100_000);
  });

  it("exports readable, indented JSON", async () => {
    await addStudentA();
    const json = await store.exportJSON();
    expect(json).toContain("\n  ");
    // Theo hằng số, để lần nâng schema sau không phải sửa test.
    expect(JSON.parse(json).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("rejects invalid JSON without touching existing data", async () => {
    await addStudentA();
    const before = await store.exportJSON();

    await expect(store.importJSON("{ not json")).rejects.toThrow(StoreError);
    expect(await store.exportJSON()).toBe(before);
  });

  it("rejects a schema mismatch without touching existing data", async () => {
    await addStudentA();
    const before = await store.exportJSON();

    await expect(
      store.importJSON(JSON.stringify({ schemaVersion: 1, students: "nope" })),
    ).rejects.toThrow(/danh sách/);
    expect(await store.exportJSON()).toBe(before);
  });

  it("rejects a future schema version", async () => {
    await expect(
      store.importJSON(
        JSON.stringify({ schemaVersion: 99, students: [], sessions: [], bills: [] }),
      ),
    ).rejects.toThrow(/99/);
  });

  it("rejects a session with a malformed time", async () => {
    await expect(
      store.importJSON(
        JSON.stringify({
          schemaVersion: 1,
          students: [],
          sessions: [
            {
              id: "s1",
              studentId: "a",
              date: "2026-09-08",
              startTime: "9am",
              endTime: "10:00",
              taught: false,
            },
          ],
          bills: [],
        }),
      ),
    ).rejects.toThrow(/Buổi học thứ 1/);
  });
});

describe("error handling", () => {
  /**
   * Firestore lưu từng bản ghi riêng, nên không còn khái niệm "cả kho hỏng" như
   * bản localStorage. Thay vào đó, một bản ghi sai định dạng bị bỏ qua khi đọc
   * để không kéo sập cả trang — đây là hành vi thay thế cần được bảo vệ.
   */
  it("bỏ qua bản ghi sai định dạng thay vì làm hỏng cả kho", async () => {
    const good = await addStudentA();

    // Ghi thẳng một buổi học thiếu trường bắt buộc, mô phỏng dữ liệu hỏng.
    const { doc, setDoc } = await import("firebase/firestore");
    const { getDb } = await import("./firebase");
    await setDoc(doc(getDb(), "workspaces", "default", "sessions", "broken"), {
      studentId: good.id,
      date: "không phải ngày",
    });

    const data = await store.getAll();
    expect(data.students).toHaveLength(1);
    expect(data.sessions).toHaveLength(0);
  });

  it("nhập tệp hỏng vẫn ném StoreError", async () => {
    await expect(store.importJSON("}}} not json")).rejects.toThrow(StoreError);
    await expect(store.importJSON("}}} not json")).rejects.toThrow(/JSON/);
  });

  it("readRawUnsafe trả về ảnh chụp dữ liệu để sao lưu", async () => {
    await addStudentA();
    const raw = await store.readRawUnsafe();
    expect(raw).toBeTypeOf("string");
    expect(JSON.parse(raw!).students).toHaveLength(1);
  });

  it("reports the stored size", async () => {
    const empty = await store.storageSize();
    await addStudentA();
    expect(await store.storageSize()).toBeGreaterThan(empty);
  });
});

describe("nâng cấp schema v1 -> v2 (màu học sinh)", () => {
  /** Tài liệu v1: color là số 1–8. */
  function v1Doc(color?: number) {
    return JSON.stringify({
      schemaVersion: 1,
      students: [
        {
          id: "s1",
          name: "An",
          contact: "0900",
          baseMinutes: 45,
          basePrice: 100_000,
          archived: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          ...(color === undefined ? {} : { color }),
        },
      ],
      sessions: [],
      bills: [],
    });
  }

  it("chuyển số sang mã màu chuỗi, giữ đúng sắc", async () => {
    await store.importJSON(v1Doc(1));
    const data = await store.getAll();
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    // 1 = chàm ở v1 -> indigo trong bảng mới
    expect(data.students[0]!.color).toBe("indigo-500");
  });

  it("chuyển đúng cả 8 màu cũ, không mất màu nào", async () => {
    const expected = [
      "indigo-500",
      "sky-500",
      "emerald-500",
      "amber-600",
      "amber-500",
      "orange-600",
      "pink-500",
      "purple-500",
    ];
    for (let i = 1; i <= 8; i++) {
      await store.importJSON(v1Doc(i));
      const data = await store.getAll();
      expect(data.students[0]!.color).toBe(expected[i - 1]);
    }
  });

  it("học sinh v1 không có màu thì vẫn không có màu (= trắng)", async () => {
    await store.importJSON(v1Doc(undefined));
    const data = await store.getAll();
    expect(data.students[0]!.color).toBeUndefined();
  });

  it("số ngoài khoảng 1–8 coi như không chọn màu", async () => {
    await store.importJSON(v1Doc(99));
    const data = await store.getAll();
    expect(data.students[0]!.color).toBeUndefined();
  });

  it("dữ liệu v2 đi qua không bị đổi", async () => {
    await store.importJSON(
      JSON.stringify({
        schemaVersion: 2,
        students: [
          {
            id: "s1",
            name: "An",
            contact: "",
            baseMinutes: 60,
            basePrice: 200_000,
            archived: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            color: "teal-400",
          },
        ],
        sessions: [],
        bills: [],
      }),
    );
    const data = await store.getAll();
    expect(data.students[0]!.color).toBe("teal-400");
  });

  it("nhập tệp sao lưu v1 cũng được nâng cấp", async () => {
    const result = await store.importJSON(v1Doc(3));
    expect(result.students).toBe(1);
    const data = await store.getAll();
    expect(data.students[0]!.color).toBe("emerald-500");
  });
});

describe("màu học sinh", () => {
  it("thêm học sinh không chọn màu -> color undefined", async () => {
    const student = await store.addStudent({
      name: "An",
      contact: "",
      baseMinutes: 60,
      basePrice: 200_000,
    });
    expect(student.color).toBeUndefined();
  });

  it("lưu được mã màu hợp lệ", async () => {
    const student = await store.addStudent({
      name: "An",
      contact: "",
      baseMinutes: 60,
      basePrice: 200_000,
      color: "pink-600",
    });
    expect(student.color).toBe("pink-600");
    expect((await store.getAll()).students[0]!.color).toBe("pink-600");
  });

  it("mã màu lạ bị chuẩn hoá về không màu", async () => {
    const student = await store.addStudent({
      name: "An",
      contact: "",
      baseMinutes: 60,
      basePrice: 200_000,
      color: "khongcomau-500",
    });
    expect(student.color).toBeUndefined();
  });

  it("bỏ chọn màu của học sinh đang có màu", async () => {
    const student = await store.addStudent({
      name: "An",
      contact: "",
      baseMinutes: 60,
      basePrice: 200_000,
      color: "sky-500",
    });
    await store.updateStudent(student.id, { color: undefined });
    expect((await store.getAll()).students[0]!.color).toBeUndefined();
  });

  it("sửa trường khác không làm mất màu", async () => {
    const student = await store.addStudent({
      name: "An",
      contact: "",
      baseMinutes: 60,
      basePrice: 200_000,
      color: "sky-500",
    });
    await store.updateStudent(student.id, { basePrice: 250_000 });
    const stored = (await store.getAll()).students[0]!;
    expect(stored.color).toBe("sky-500");
    expect(stored.basePrice).toBe(250_000);
  });

  it("hai học sinh dùng cùng màu vẫn được lưu", async () => {
    await store.addStudent({
      name: "An", contact: "", baseMinutes: 60, basePrice: 200_000, color: "teal-500",
    });
    await store.addStudent({
      name: "Bình", contact: "", baseMinutes: 60, basePrice: 200_000, color: "teal-500",
    });
    const data = await store.getAll();
    expect(data.students.filter((s) => s.color === "teal-500")).toHaveLength(2);
  });
});
