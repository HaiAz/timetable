/**
 * Kiểm tra cổng mật mã.
 *
 * `lib/auth.ts` đọc biến môi trường ngay khi được gọi (chứ không phải lúc nạp
 * module), nên mỗi test đặt biến rồi nạp lại module là đủ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

/** Nạp lại module auth sau khi đã đặt biến môi trường. */
async function loadAuth(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  return import("./auth");
}

describe("bật/tắt cổng", () => {
  it("không đặt mật mã thì cổng tắt", async () => {
    const auth = await loadAuth({ APP_PASSCODE: undefined });
    expect(auth.isAuthEnabled()).toBe(false);
  });

  it("mật mã rỗng cũng coi như tắt", async () => {
    const auth = await loadAuth({ APP_PASSCODE: "" });
    expect(auth.isAuthEnabled()).toBe(false);
  });

  it("có mật mã thì cổng bật", async () => {
    const auth = await loadAuth({ APP_PASSCODE: "NU-NVK" });
    expect(auth.isAuthEnabled()).toBe(true);
  });
});

describe("kiểm tra mật mã", () => {
  it("đúng mật mã thì chấp nhận", async () => {
    const auth = await loadAuth({ APP_PASSCODE: "NU-NVK" });
    expect(auth.isPasscodeCorrect("NU-NVK")).toBe(true);
  });

  it("sai mật mã thì từ chối", async () => {
    const auth = await loadAuth({ APP_PASSCODE: "NU-NVK" });
    // Phân biệt hoa thường — "nu-nvk" không phải "NU-NVK".
    expect(auth.isPasscodeCorrect("nu-nvk")).toBe(false);
    expect(auth.isPasscodeCorrect("")).toBe(false);
    expect(auth.isPasscodeCorrect("NU-NVK-them")).toBe(false);
    expect(auth.isPasscodeCorrect("NU")).toBe(false);
  });

  it("bỏ qua khoảng trắng thừa hai đầu", async () => {
    // Người dùng copy-paste hay dính khoảng trắng; bắt lỗi vì lý do đó thì
    // khó chịu mà chẳng an toàn hơn.
    const auth = await loadAuth({ APP_PASSCODE: "NU-NVK" });
    expect(auth.isPasscodeCorrect("  NU-NVK  ")).toBe(true);
  });

  it("cổng tắt thì không mật mã nào được chấp nhận", async () => {
    const auth = await loadAuth({ APP_PASSCODE: "" });
    expect(auth.isPasscodeCorrect("")).toBe(false);
    expect(auth.isPasscodeCorrect("bất kỳ")).toBe(false);
  });
});

describe("chữ ký cookie", () => {
  it("chữ ký đúng thì hợp lệ", async () => {
    const auth = await loadAuth({
      APP_PASSCODE: "NU-NVK",
      AUTH_SECRET: "khoa-bi-mat",
    });
    expect(auth.isTokenValid(auth.expectedToken())).toBe(true);
  });

  it("cookie tự chế bị từ chối", async () => {
    const auth = await loadAuth({
      APP_PASSCODE: "NU-NVK",
      AUTH_SECRET: "khoa-bi-mat",
    });
    expect(auth.isTokenValid("gia-mao")).toBe(false);
    expect(auth.isTokenValid("")).toBe(false);
    expect(auth.isTokenValid(undefined)).toBe(false);
    // Đúng độ dài nhưng sai nội dung — chặn đường đoán mò theo độ dài.
    expect(auth.isTokenValid("0".repeat(64))).toBe(false);
  });

  it("chữ ký KHÔNG chứa mật mã", async () => {
    const auth = await loadAuth({
      APP_PASSCODE: "NU-NVK",
      AUTH_SECRET: "khoa-bi-mat",
    });
    const token = auth.expectedToken();
    expect(token).not.toContain("NU-NVK");
    expect(token).not.toContain("khoa-bi-mat");
  });

  it("đổi AUTH_SECRET thì cookie cũ hết hiệu lực", async () => {
    const first = await loadAuth({
      APP_PASSCODE: "NU-NVK",
      AUTH_SECRET: "khoa-cu",
    });
    const oldToken = first.expectedToken();

    const second = await loadAuth({
      APP_PASSCODE: "NU-NVK",
      AUTH_SECRET: "khoa-moi",
    });
    expect(second.isTokenValid(oldToken)).toBe(false);
    expect(second.isTokenValid(second.expectedToken())).toBe(true);
  });

  it("không đặt AUTH_SECRET thì đổi mật mã cũng vô hiệu cookie cũ", async () => {
    const first = await loadAuth({
      APP_PASSCODE: "mat-ma-cu",
      AUTH_SECRET: undefined,
    });
    const oldToken = first.expectedToken();

    const second = await loadAuth({
      APP_PASSCODE: "mat-ma-moi",
      AUTH_SECRET: undefined,
    });
    expect(second.isTokenValid(oldToken)).toBe(false);
  });
});
