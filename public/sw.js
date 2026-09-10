/**
 * Service worker tối giản cho PWA.
 *
 * Nguyên tắc: chỉ cache vỏ tĩnh (JS/CSS/font/icon do Next sinh ra, có hash
 * trong tên nên không bao giờ cũ). Mọi thứ liên quan tới dữ liệu — Firestore,
 * `/api`, và cả HTML của trang — luôn đi thẳng ra mạng. Học phí và lịch dạy
 * mà hiện bản cache cũ thì tệ hơn nhiều so với việc app không mở được offline.
 */

const CACHE = "timetable-static-v1";

self.addEventListener("install", (event) => {
  // Bản mới thay bản cũ ngay, không chờ tab hiện tại đóng.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/icon-192.jpg"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Chỉ tài nguyên build có hash mới đáng cache — tên đổi mỗi lần deploy.
  const isHashedAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg");
  if (!isHashedAsset) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
