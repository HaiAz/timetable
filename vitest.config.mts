import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" -> "./*" path alias from tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Pure logic only — no DOM environment needed.
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
    // Store tests đi qua Firestore emulator: mỗi lượt setup phải xoá sạch dữ
    // liệu qua mạng nội bộ, chậm hơn hẳn so với bộ nhớ trong.
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Các file test dùng chung một database emulator, và mỗi file xoá sạch dữ
    // liệu ở `beforeEach`. Chạy song song thì file này xoá mất dữ liệu file
    // kia đang dùng, nên phải tuần tự.
    fileParallelism: false,
  },
});
