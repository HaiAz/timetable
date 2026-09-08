import { describe, expect, it } from "vitest";
import {
  allColorCodes,
  COLOR_FAMILIES,
  hexForColor,
  isValidColor,
  suggestUnusedColor,
} from "./colors";

describe("bảng màu", () => {
  it("có 8 sắc × 5 bậc = 40 màu", () => {
    expect(COLOR_FAMILIES).toHaveLength(8);
    for (const family of COLOR_FAMILIES) {
      expect(family.steps).toHaveLength(5);
    }
    expect(allColorCodes()).toHaveLength(40);
  });

  it("không có mã màu trùng nhau", () => {
    const codes = allColorCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("không có mã hex trùng nhau", () => {
    const hexes = COLOR_FAMILIES.flatMap((f) => f.steps.map((s) => s.hex));
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("mọi hex đúng định dạng 6 ký tự", () => {
    for (const family of COLOR_FAMILIES) {
      for (const { hex } of family.steps) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });
});

describe("hexForColor", () => {
  it("tra đúng màu", () => {
    expect(hexForColor("indigo-500")).toBe("#8B5CF6");
    expect(hexForColor("emerald-700")).toBe("#047857");
    expect(hexForColor("purple-300")).toBe("#D8B4FE");
  });

  it("mọi mã trong bảng đều tra được", () => {
    for (const code of allColorCodes()) {
      expect(hexForColor(code)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("trả null khi không có màu — đây là trạng thái hợp lệ", () => {
    expect(hexForColor(undefined)).toBeNull();
    expect(hexForColor(null)).toBeNull();
    expect(hexForColor("")).toBeNull();
  });

  it("trả null với mã sai", () => {
    expect(hexForColor("indigo")).toBeNull();
    expect(hexForColor("indigo-999")).toBeNull();
    expect(hexForColor("khongco-500")).toBeNull();
    expect(hexForColor("500")).toBeNull();
  });

  it("không nhận số của schema cũ", () => {
    // v1 dùng số 1–8; sau khi migrate không còn giá trị nào như vậy.
    expect(hexForColor("1")).toBeNull();
    expect(hexForColor("8")).toBeNull();
  });
});

describe("isValidColor", () => {
  it("đúng với mã trong bảng", () => {
    expect(isValidColor("sky-400")).toBe(true);
  });

  it("sai với mọi thứ khác", () => {
    expect(isValidColor(undefined)).toBe(false);
    expect(isValidColor(null)).toBe(false);
    expect(isValidColor(3)).toBe(false);
    expect(isValidColor("indigo-501")).toBe(false);
    expect(isValidColor({})).toBe(false);
  });
});

describe("suggestUnusedColor", () => {
  it("chọn màu đầu bảng khi chưa ai dùng", () => {
    expect(suggestUnusedColor([])).toBe("indigo-300");
  });

  it("bỏ qua màu đã dùng", () => {
    const suggestion = suggestUnusedColor(["indigo-300"]);
    expect(suggestion).not.toBe("indigo-300");
    expect(isValidColor(suggestion)).toBe(true);
  });

  it("ưu tiên đổi sắc trước khi đổi bậc, để dễ phân biệt", () => {
    // Sau khi lấy sắc đầu ở bậc 300, gợi ý tiếp theo phải là sắc khác
    // cùng bậc 300, chứ không phải cùng sắc bậc 400.
    const second = suggestUnusedColor(["indigo-300"]);
    expect(second).toBe("sky-300");
  });

  it("trả undefined khi đã dùng hết 40 màu", () => {
    expect(suggestUnusedColor(allColorCodes())).toBeUndefined();
  });

  it("luôn trả màu chưa dùng cho tới khi hết bảng", () => {
    const used: string[] = [];
    for (let i = 0; i < 40; i++) {
      const next = suggestUnusedColor(used);
      expect(next).toBeDefined();
      expect(used).not.toContain(next);
      used.push(next!);
    }
    expect(suggestUnusedColor(used)).toBeUndefined();
  });
});
