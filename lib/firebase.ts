/**
 * Khởi tạo Firebase — chỉ chạy phía trình duyệt.
 *
 * Cấu hình đọc từ biến môi trường `NEXT_PUBLIC_*`. Các biến này được nhúng vào
 * bundle trình duyệt nên KHÔNG phải bí mật; việc bảo vệ dữ liệu nằm hoàn toàn ở
 * Firestore security rules (xem `firestore.rules`).
 *
 * `initializeApp` được gọi qua `getApps()` để không khởi tạo lại khi Fast Refresh
 * nạp lại module trong lúc dev.
 */

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * True khi mọi biến bắt buộc đều có mặt. Thiếu `.env.local` là lỗi cấu hình
 * thường gặp nhất, nên ta phát hiện sớm và báo bằng tiếng Việt thay vì để
 * Firebase ném lỗi khó hiểu.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

/** App Firebase dùng chung. Ném lỗi nếu thiếu cấu hình. */
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Thiếu cấu hình Firebase. Hãy tạo tệp .env.local theo mẫu .env.example.",
    );
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Firestore dùng chung.
 *
 * Khi `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` được đặt (test và phát triển cục
 * bộ), kết nối tới emulator thay vì dự án thật — nhờ đó bộ test không bao giờ
 * chạm vào dữ liệu sản xuất.
 */
export function getDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());

    const emulator = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
    if (emulator) {
      const [host, port] = emulator.split(":");
      connectFirestoreEmulator(firestore, host || "127.0.0.1", Number(port) || 8080);
    }
  }
  return firestore;
}
