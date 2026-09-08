/**
 * Bộ theme màu.
 *
 * Mỗi theme chỉ đổi **màu nhấn** (accent) và sắc nền rất nhạt. Các màu mang
 * nghĩa — đã thu / chưa thu / nợ quá hạn — luôn giữ nguyên ở mọi theme, vì
 * người dùng cần nhận ra "đang nợ" theo phản xạ, không phải đoán lại mỗi lần
 * đổi màu.
 *
 * Giá trị lấy từ thang màu Tailwind do người dùng cung cấp: bậc 50 cho nền
 * nhạt, 200 cho viền. Màu chính chọn bậc đầu tiên đạt WCAG AA (4.5:1) với chữ
 * trắng — thường là 700, riêng san hô phải tới 800 — vì nhãn nút chỉ 13px.
 * Bậc 500 nguyên bản được giữ ở `swatch` để vẽ ô chọn màu.
 */

export interface ThemeDef {
  /** Khoá lưu vào localStorage và gán vào `data-theme`. */
  id: string;
  /** Tên hiển thị trong Cài đặt. */
  name: string;
  /** Mô tả ngắn về tính cách của theme. */
  description: string;
  /** Màu để vẽ ô xem trước — không dùng làm token. */
  swatch: string;
  tokens: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryFg: string;
    primaryBg: string;
    primaryBorder: string;
    ring: string;
    /** Nền trang — hơi nhuốm sắc theme để tổng thể liền mạch. */
    bg: string;
  };
}

export const THEMES: ThemeDef[] = [
  {
    id: "ocean",
    name: "Xanh biển",
    description: "Chuyên nghiệp, sạch sẽ",
    swatch: "#1683FF",
    tokens: {
      // 500 (#1683FF) chỉ đạt 3.67:1 với chữ trắng — chưa đủ AA cho nhãn nút
      // 13px, nên dùng 700 làm màu chính (5.07:1).
      primary: "#0068E8",
      primaryHover: "#0058C7",
      primaryActive: "#0049A6",
      primaryFg: "#FFFFFF",
      primaryBg: "#F0F7FF",
      primaryBorder: "#B9DCFF",
      ring: "#0875F5",
      bg: "#F7FAFE",
    },
  },
  {
    id: "indigo",
    name: "Tím chàm",
    description: "Hiện đại, cao cấp",
    swatch: "#8B5CF6",
    tokens: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primaryActive: "#5B21B6",
      primaryFg: "#FFFFFF",
      primaryBg: "#F5F3FF",
      primaryBorder: "#DDD6FE",
      ring: "#7C3AED",
      bg: "#FAF9FE",
    },
  },
  {
    id: "emerald",
    name: "Xanh lục",
    description: "Tích cực, thân thiện",
    swatch: "#10B981",
    tokens: {
      // 500/600 chưa đủ tương phản với chữ trắng; 700 đạt 5.48:1.
      primary: "#047857",
      primaryHover: "#065F46",
      primaryActive: "#064E3B",
      primaryFg: "#FFFFFF",
      primaryBg: "#ECFDF5",
      primaryBorder: "#A7F3D0",
      ring: "#047857",
      bg: "#F6FDFA",
    },
  },
  {
    id: "lavender",
    name: "Oải hương",
    description: "Nhẹ nhàng, dịu mắt",
    swatch: "#A78BFA",
    tokens: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primaryActive: "#5B21B6",
      primaryFg: "#FFFFFF",
      primaryBg: "#FAF9FF",
      primaryBorder: "#DDD6FE",
      ring: "#7C3AED",
      bg: "#FBFAFE",
    },
  },
  {
    id: "purple",
    name: "Tím hồng",
    description: "Sáng tạo, nổi bật",
    swatch: "#A855F7",
    tokens: {
      primary: "#9333EA",
      primaryHover: "#7E22CE",
      primaryActive: "#6B21A8",
      primaryFg: "#FFFFFF",
      primaryBg: "#FAF5FF",
      primaryBorder: "#E9D5FF",
      ring: "#9333EA",
      bg: "#FCF9FE",
    },
  },
  {
    id: "coral",
    name: "San hô",
    description: "Ấm áp, năng lượng",
    swatch: "#FF6B52",
    tokens: {
      // Cam đỏ rất sáng: phải tới 800 mới đạt AA với chữ trắng (5.17:1).
      primary: "#C93727",
      primaryHover: "#A82D21",
      primaryActive: "#8F251B",
      primaryFg: "#FFFFFF",
      primaryBg: "#FFF7F5",
      primaryBorder: "#FFD0C5",
      ring: "#C93727",
      bg: "#FFFAF8",
    },
  },
  {
    id: "teal",
    name: "Xanh mòng",
    description: "Tươi mới, tự nhiên",
    swatch: "#14B8A6",
    tokens: {
      // 700 là bậc đầu tiên đạt AA với chữ trắng (5.47:1).
      primary: "#0F766E",
      primaryHover: "#115E59",
      primaryActive: "#134E4A",
      primaryFg: "#FFFFFF",
      primaryBg: "#F0FDFA",
      primaryBorder: "#99F6E4",
      ring: "#0F766E",
      bg: "#F5FDFC",
    },
  },
  {
    id: "amber",
    name: "Hổ phách",
    description: "Lạc quan, rực rỡ",
    swatch: "#F59E0B",
    tokens: {
      // Vàng cam sáng nhất trong bộ; cần 700 để chữ trắng đọc được.
      primary: "#B45309",
      primaryHover: "#92400E",
      primaryActive: "#78350F",
      primaryFg: "#FFFFFF",
      primaryBg: "#FFFBEB",
      primaryBorder: "#FDE68A",
      ring: "#92400E",
      bg: "#FFFCF5",
    },
  },
];

export const DEFAULT_THEME_ID = "ocean";

export const THEME_KEY = "timetable.theme";

export function themeById(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export function isValidThemeId(id: unknown): id is string {
  return typeof id === "string" && THEMES.some((t) => t.id === id);
}

/**
 * Script chạy trước lần vẽ đầu tiên, gán `data-theme` lên <html> để không bị
 * nháy màu mặc định rồi mới đổi.
 */
export const THEME_SCRIPT = `
(function(){
  try {
    var id = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var valid = ${JSON.stringify(THEMES.map((t) => t.id))};
    document.documentElement.dataset.theme =
      valid.indexOf(id) !== -1 ? id : ${JSON.stringify(DEFAULT_THEME_ID)};
  } catch (e) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME_ID)};
  }
})();
`;

/** Gán theme vào DOM. Gọi khi người dùng chọn theme mới. */
export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = themeById(id).id;
}
