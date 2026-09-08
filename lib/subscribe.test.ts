/**
 * Kiểm tra listener realtime.
 *
 * Đây là cơ chế thay thế cho việc đọc lại sau mỗi lần ghi, nên nếu nó không
 * đẩy thay đổi về thì giao diện sẽ đứng im cho tới khi người dùng F5 — đúng
 * lỗi đã gặp. Test này khoá hành vi đó lại.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppData } from "./types";

process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "timetable-test";

// `store` phải nạp động, sau khi các biến môi trường ở trên đã được đặt — nó
// đọc chúng ngay lúc nạp module để biết nối tới emulator hay dự án thật.
const { store } = await import("./store");

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST!;

async function clearFirestore() {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Không xoá được dữ liệu emulator (HTTP ${response.status}).`);
  }
}

let unsubscribe: (() => void) | null = null;

beforeEach(clearFirestore);
afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
});

/**
 * Chờ tới khi `predicate` đúng, hoặc hết giờ. Mỗi lần gọi mở một listener mới
 * và tự đóng khi xong, để không rò rỉ sang test kế tiếp.
 */
function waitFor(
  predicate: (data: AppData) => boolean,
  timeoutMs = 10_000,
): Promise<AppData> {
  // Đóng listener đang mở (nếu có) trước khi mở cái mới.
  unsubscribe?.();
  unsubscribe = null;

  return new Promise((resolve, reject) => {
    let stop: (() => void) | null = null;

    const finish = (fn: () => void) => {
      clearTimeout(timer);
      stop?.();
      if (unsubscribe === stop) unsubscribe = null;
      fn();
    };

    const timer = setTimeout(
      () =>
        finish(() =>
          reject(new Error("Listener không phát dữ liệu mong đợi kịp thời hạn.")),
        ),
      timeoutMs,
    );

    stop = store.subscribe(
      (data) => {
        if (!predicate(data)) return;
        finish(() => resolve(data));
      },
      (error) => finish(() => reject(error)),
    );
    unsubscribe = stop;
  });
}

describe("store.subscribe", () => {
  it("phát snapshot đầu tiên ngay cả khi chưa có dữ liệu", async () => {
    const data = await waitFor(() => true);
    expect(data.students).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.bills).toEqual([]);
  });

  it("đẩy học sinh mới về mà không cần đọc lại", async () => {
    // Mở listener trước, rồi ghi — đúng thứ tự của giao diện khi thêm học sinh.
    const arrived = new Promise<AppData>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Không nhận được học sinh mới qua listener.")),
        10_000,
      );
      unsubscribe = store.subscribe(
        (data) => {
          if (data.students.length === 1) {
            clearTimeout(timer);
            resolve(data);
          }
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });

    // Chờ snapshot rỗng đầu tiên để chắc listener đã sẵn sàng.
    await new Promise((r) => setTimeout(r, 500));

    await store.addStudent({
      name: "Nguyễn An",
      contact: "0901234567",
      baseMinutes: 45,
      basePrice: 100_000,
    });

    const data = await arrived;
    expect(data.students).toHaveLength(1);
    expect(data.students[0]!.name).toBe("Nguyễn An");
  });

  it("đẩy cả thay đổi lẫn xoá", async () => {
    const student = await store.addStudent({
      name: "Bình",
      contact: "0900",
      baseMinutes: 60,
      basePrice: 200_000,
    });

    await waitFor((d) => d.students.length === 1);

    await store.updateStudent(student.id, { basePrice: 250_000 });
    const updated = await waitFor((d) => d.students[0]?.basePrice === 250_000);
    expect(updated.students[0]!.basePrice).toBe(250_000);

    await store.deleteStudent(student.id);
    const removed = await waitFor((d) => d.students.length === 0);
    expect(removed.students).toEqual([]);
  });

  it("huỷ đăng ký thì không nhận thêm dữ liệu", async () => {
    let calls = 0;
    const stop = store.subscribe(
      () => {
        calls++;
      },
      () => {},
    );
    await new Promise((r) => setTimeout(r, 500));
    const before = calls;
    stop();

    await store.addStudent({
      name: "Không được thấy",
      contact: "0900",
      baseMinutes: 45,
      basePrice: 100_000,
    });
    await new Promise((r) => setTimeout(r, 1000));

    expect(calls).toBe(before);
  });
});
