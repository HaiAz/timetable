import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lịch dạy — Quản lý lịch dạy & học phí",
    short_name: "Lịch dạy",
    description:
      "Quản lý thời khoá biểu dạy kèm 1-1 và tính học phí. Dữ liệu đồng bộ qua Firebase.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FAFE",
    theme_color: "#0068E8",
    lang: "vi",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon-512.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon-maskable.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
