/**
 * Màu nhận diện học sinh trên thời khoá biểu.
 *
 * Bảng gồm 8 sắc × 5 độ đậm = 40 màu, đủ để nhiều học sinh không bị trùng.
 * Không chọn màu (`color === undefined`) thì khối buổi học để **trắng** — đó
 * là trạng thái mặc định, hợp lệ, không phải "chưa cấu hình".
 *
 * Mã màu là chuỗi `"<sắc>-<bậc>"`, ví dụ `"indigo-500"`. Lưu dạng chuỗi thay
 * vì số để bảng màu có thể mở rộng về sau mà dữ liệu cũ vẫn đọc được.
 */

export interface ColorFamily {
  id: string;
  name: string;
  /** 5 bậc từ nhạt tới đậm. */
  steps: Array<{ step: number; hex: string }>;
}

/** Bảng màu, lấy từ thang Tailwind. */
export const COLOR_FAMILIES: ColorFamily[] = [
  {
    id: "indigo",
    name: "Chàm",
    steps: [
      { step: 300, hex: "#C4B5FD" },
      { step: 400, hex: "#A78BFA" },
      { step: 500, hex: "#8B5CF6" },
      { step: 600, hex: "#7C3AED" },
      { step: 700, hex: "#6D28D9" },
    ],
  },
  {
    id: "sky",
    name: "Xanh ngọc",
    steps: [
      { step: 300, hex: "#7DD3FC" },
      { step: 400, hex: "#38BDF8" },
      { step: 500, hex: "#0EA5E9" },
      { step: 600, hex: "#0284C7" },
      { step: 700, hex: "#0369A1" },
    ],
  },
  {
    id: "emerald",
    name: "Lục",
    steps: [
      { step: 300, hex: "#6EE7B7" },
      { step: 400, hex: "#34D399" },
      { step: 500, hex: "#10B981" },
      { step: 600, hex: "#059669" },
      { step: 700, hex: "#047857" },
    ],
  },
  {
    id: "teal",
    name: "Mòng",
    steps: [
      { step: 300, hex: "#5EEAD4" },
      { step: 400, hex: "#2DD4BF" },
      { step: 500, hex: "#14B8A6" },
      { step: 600, hex: "#0D9488" },
      { step: 700, hex: "#0F766E" },
    ],
  },
  {
    id: "amber",
    name: "Hổ phách",
    steps: [
      { step: 300, hex: "#FCD34D" },
      { step: 400, hex: "#FBBF24" },
      { step: 500, hex: "#F59E0B" },
      { step: 600, hex: "#D97706" },
      { step: 700, hex: "#B45309" },
    ],
  },
  {
    id: "orange",
    name: "Cam",
    steps: [
      { step: 300, hex: "#FDBA74" },
      { step: 400, hex: "#FB923C" },
      { step: 500, hex: "#F97316" },
      { step: 600, hex: "#EA580C" },
      { step: 700, hex: "#C2410C" },
    ],
  },
  {
    id: "pink",
    name: "Hồng",
    steps: [
      { step: 300, hex: "#F9A8D4" },
      { step: 400, hex: "#F472B6" },
      { step: 500, hex: "#EC4899" },
      { step: 600, hex: "#DB2777" },
      { step: 700, hex: "#BE185D" },
    ],
  },
  {
    id: "purple",
    name: "Tím",
    steps: [
      { step: 300, hex: "#D8B4FE" },
      { step: 400, hex: "#C084FC" },
      { step: 500, hex: "#A855F7" },
      { step: 600, hex: "#9333EA" },
      { step: 700, hex: "#7E22CE" },
    ],
  },
];

/** Tra mã màu `"indigo-500"` -> `"#8B5CF6"`. `null` nếu không hợp lệ. */
export function hexForColor(color: string | undefined | null): string | null {
  if (!color) return null;
  const index = color.lastIndexOf("-");
  if (index === -1) return null;

  const familyId = color.slice(0, index);
  const step = Number(color.slice(index + 1));
  const family = COLOR_FAMILIES.find((f) => f.id === familyId);
  if (!family) return null;

  return family.steps.find((s) => s.step === step)?.hex ?? null;
}

export function isValidColor(color: unknown): color is string {
  return typeof color === "string" && hexForColor(color) !== null;
}

/** Toàn bộ mã màu, dùng cho gợi ý "màu chưa ai dùng". */
export function allColorCodes(): string[] {
  return COLOR_FAMILIES.flatMap((f) => f.steps.map((s) => `${f.id}-${s.step}`));
}

/**
 * Màu đầu tiên chưa ai dùng, để gợi ý khi thêm học sinh mới. Nếu đã dùng hết
 * thì trả `undefined` — học sinh đó sẽ để trắng, người dùng tự chọn nếu muốn.
 *
 * Quét theo bậc rồi mới theo sắc, nên các học sinh đầu tiên nhận được những
 * màu khác sắc nhau hẳn, dễ phân biệt trên lịch.
 */
export function suggestUnusedColor(usedColors: Iterable<string>): string | undefined {
  const used = new Set(usedColors);
  for (const { step } of COLOR_FAMILIES[0]!.steps) {
    for (const family of COLOR_FAMILIES) {
      const code = `${family.id}-${step}`;
      if (!used.has(code)) return code;
    }
  }
  return undefined;
}

/**
 * Style nội tuyến cho khối buổi học / ảnh đại diện.
 *
 * Không có màu -> `--sc` không được đặt, và component dùng token nền trắng
 * bình thường. Đây là trạng thái mặc định hợp lệ.
 */
export function studentColorStyle(student: {
  color?: string;
}): React.CSSProperties | undefined {
  const hex = hexForColor(student.color);
  if (!hex) return undefined;
  return { ["--sc" as string]: hex };
}
