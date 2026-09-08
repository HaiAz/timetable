# Lịch dạy — Quản lý lịch dạy & học phí

Ứng dụng web cá nhân cho giáo viên dạy kèm 1-1: quản lý thời khoá biểu và tính
học phí. Dữ liệu lưu trên **Firebase Firestore**, tự đồng bộ realtime giữa các
thiết bị.

## Chạy ứng dụng

```bash
pnpm install
cp .env.example .env.local    # rồi điền cấu hình Firebase
pnpm dev                      # http://localhost:3000
```

Cấu hình Firebase lấy ở **Firebase Console → Project settings → Your apps**.
Nhớ đặt cả `APP_PASSCODE` — mật mã để vào ứng dụng (xem [Cổng mật mã](#cổng-mật-mã)).

```bash
pnpm build        # build production
pnpm start        # chạy bản build
```

## Chạy kiểm thử

```bash
pnpm test         # chạy 1 lần
pnpm test:watch   # chế độ watch
```

Test của lớp lưu trữ chạy trên **Firestore emulator** — `pnpm test` tự khởi
động và tắt emulator, không đụng tới dữ liệu thật. Cần **Java 21+** (Java 17
vẫn chạy được với `firebase-tools` 14, nhưng bản 15 trở lên thì bắt buộc 21).

Các test khác (công thức học phí, trùng giờ, màu sắc) là logic thuần, chạy được
không cần emulator: `pnpm test:no-emulator`.

152 test, bao gồm toàn bộ các trường hợp bắt buộc của công thức tính học phí,
thuật toán xếp buổi học trùng giờ, bảng màu, lớp lưu trữ (kể cả nâng cấp schema
v1 → v2), cổng mật mã, và listener realtime —
[`lib/subscribe.test.ts`](lib/subscribe.test.ts) khoá lại hành vi "ghi xong là
giao diện tự cập nhật, không cần tải lại trang".

## Các trang

| Đường dẫn | Chức năng |
|---|---|
| `/` | Thời khoá biểu tuần (7 ngày × khung 06:00–24:00), Thứ 2 đầu tuần |
| `/hoc-sinh` | Danh sách học sinh, đơn giá, lịch sử học |
| `/thu-hoc-phi` | Học phí theo tháng, đánh dấu đã thu |
| `/no-hoc-phi` | Công nợ các tháng trước |
| `/cai-dat` | Xuất / nhập dữ liệu, chọn màu giao diện |

## Công thức tính học phí

```
Học phí buổi = làm tròn( số phút × đơn giá ÷ đơn vị thời lượng ÷ 1000 ) × 1000
```

Tính theo tỉ lệ thời gian, làm tròn đến nghìn đồng gần nhất. Chỉ những buổi đã
đánh dấu **“đã dạy”** mới được tính tiền.

Khi đánh dấu đã dạy, đơn giá của học sinh được **ghi lại vào buổi học đó**
(`rateSnapshot`). Nhờ vậy, tăng giá về sau không làm thay đổi học phí của các
buổi đã dạy trước đó.

## Lưu trữ dữ liệu

Dữ liệu nằm trên Firebase Firestore, tổ chức như sau:

```
workspaces/{workspaceId}/students/{id}
workspaces/{workspaceId}/sessions/{id}
workspaces/{workspaceId}/bills/{studentId}_{YYYY-MM}
```

Tách theo collection thay vì gộp một document lớn, để sửa một buổi học chỉ ghi
đúng bản ghi đó và realtime chỉ đẩy phần thay đổi.

**Toàn bộ việc đọc/ghi đi qua đúng một tệp: [`lib/store.ts`](lib/store.ts).**
Các component không bao giờ gọi Firestore trực tiếp — chúng dùng
[`components/data-provider.tsx`](components/data-provider.tsx), nơi mở listener
realtime (`store.subscribe`) và cập nhật khi dữ liệu đổi ở bất kỳ thiết bị nào.

### Cấu hình

Bảy biến `NEXT_PUBLIC_FIREBASE_*` trong `.env.local` (mẫu ở
[`.env.example`](.env.example)). Chúng được nhúng vào bundle trình duyệt nên
**không phải bí mật** — việc bảo vệ dữ liệu nằm ở security rules.

Biến tuỳ chọn `NEXT_PUBLIC_FIREBASE_WORKSPACE_ID` đổi workspace đang dùng (mặc
định `default`), tiện khi muốn tách dữ liệu thử nghiệm khỏi dữ liệu thật.

### Cổng mật mã

Toàn bộ ứng dụng nằm sau một mật mã. Chưa xác thực thì mọi đường dẫn đều bị
chuyển hướng sang `/verify`.

| Biến | Ý nghĩa |
|---|---|
| `APP_PASSCODE` | Mật mã. **Bỏ trống thì tắt cổng**, vào thẳng không cần xác thực. |
| `AUTH_SECRET` | Khoá ký cookie. Đổi giá trị này là mọi thiết bị phải nhập lại mật mã. |

Cả hai đều **không** có tiền tố `NEXT_PUBLIC_`, nên Next.js không nhúng chúng
vào bundle trình duyệt — mật mã chỉ tồn tại trên máy chủ.

Cách hoạt động: [`proxy.ts`](proxy.ts) chặn mọi request trước khi trang được
render (Next.js 16 đổi tên `middleware.ts` thành `proxy.ts`). Mật mã được gửi
lên [`app/api/verify/route.ts`](app/api/verify/route.ts) để máy chủ so khớp;
nếu đúng, máy chủ đặt cookie `HttpOnly` chứa **chữ ký HMAC**, không chứa mật mã.
Vì vậy xem cookie cũng không suy ra được mật mã, và không tự chế được cookie hợp
lệ nếu không biết `AUTH_SECRET`. Cookie có hạn 400 ngày (mức trần trình duyệt
chấp nhận) nên thực tế chỉ phải nhập một lần.

### ⚠️ Bảo mật

**Cổng mật mã chặn người dùng, không chặn truy cập dữ liệu.** Nó chỉ nằm ở tầng
Next.js. [`firestore.rules`](firestore.rules) vẫn đang mở, nên ai biết
`projectId` — lấy được từ mã nguồn trang web — vẫn đọc/ghi thẳng vào Firestore
được, bỏ qua hoàn toàn `/verify`. Đừng lưu ở đây thông tin không chấp nhận bị lộ.

Cách khoá lại (nên làm khi ứng dụng đã chạy ổn định): bật Google sign-in trong
Firebase Console, đổi `WORKSPACE_ID` trong `lib/store.ts` thành `uid` của người
đăng nhập, rồi thay rules theo hướng dẫn ghi sẵn trong `firestore.rules`.

Triển khai rules:

```bash
npx firebase deploy --only firestore:rules --project timetable-d6d26
```

> ⚠️ Dữ liệu không còn mất khi xoá dữ liệu trình duyệt, nhưng **xoá nhầm sẽ đồng
> bộ ngay sang mọi thiết bị và không hoàn tác được**. Vẫn nên dùng
> **Cài đặt → Xuất dữ liệu** để sao lưu định kỳ.

## Cấu trúc

```
lib/
  types.ts       Kiểu dữ liệu (Student, Session, MonthlyBill, AppData)
  store.ts       ★ Ranh giới lưu trữ — nơi duy nhất chạm Firestore
  firebase.ts    Khởi tạo Firebase app + Firestore (hỗ trợ emulator)
  billing.ts     Công thức học phí, tổng hợp theo tháng, công nợ
  date.ts        Xử lý ngày tháng, tuần bắt đầu từ Thứ 2
  format.ts      Định dạng tiếng Việt: 200.000 ₫, thời lượng, ngày
  colors.ts      Bảng 40 màu học sinh (8 sắc × 5 bậc)
  selected-day.ts Ngày mặc định khi thêm buổi, luôn trong tuần đang xem
  themes.ts      8 theme màu giao diện
  backup.ts      Tải xuống / đọc tệp JSON sao lưu

proxy.ts         Chốt chặn mật mã, chạy trước mọi request
app/verify/      Trang nhập mật mã
app/api/verify/  Nhận mật mã, cấp cookie đã ký

components/
  app-frame.tsx      Chọn khung theo trang — /verify không có sidebar
  data-provider.tsx  Cầu nối React ↔ store (an toàn với SSR)
  app-shell.tsx      Sidebar (desktop) / tab bar (mobile), cao h-dvh
  theme-picker.tsx   Chọn theme màu (chỉ dùng ở trang Cài đặt)
  ui/                Component cơ bản (button, dialog, field, badge…)
  timetable/         Lưới tuần, khối buổi học, thuật toán trùng giờ
  students/          Form học sinh, lịch sử học
```

## Ghi chú kỹ thuật

- **Next.js 16** App Router, TypeScript strict, Tailwind CSS v4
  (cấu hình bằng CSS trong [`app/globals.css`](app/globals.css)).
- **Không có thư viện UI ngoài** — các component trong `components/ui/` được
  viết tay, chỉ dùng React + Tailwind. Dependency runtime: `next`, `react`,
  `react-dom`, `firebase`.
- **An toàn với SSR**: Firestore chỉ được chạm trong `useEffect`; các trang
  hiện skeleton cho tới khi snapshot đầu tiên về. Ngày “hôm nay” lấy qua
  `useSyncExternalStore` (server snapshot = `null`) để không lệch hydration.
- **Realtime**: `DataProvider` mở ba listener `onSnapshot` (students, sessions,
  bills) và chỉ phát dữ liệu sau khi cả ba đã về lần đầu, để giao diện không
  chớp qua trạng thái có buổi học mà thiếu học sinh. Nhờ vậy các thao tác ghi
  không cần đọc lại — Firestore áp dụng thay đổi cục bộ ngay rồi đồng bộ ngầm.
- **Sao chép lịch tuần trước** là cơ chế lặp duy nhất. Mỗi buổi học là một bản
  ghi độc lập — sửa tuần này không ảnh hưởng tuần khác.
- **Giao diện**: token thiết kế định nghĩa một lần trong `app/globals.css`.
  Ứng dụng chỉ dùng nền sáng, có **8 theme màu** (định nghĩa ở
  [`lib/themes.ts`](lib/themes.ts)) đổi trong trang Cài đặt.
  Mỗi theme chỉ đổi màu nhấn; màu mang nghĩa (đã thu / chưa thu / nợ)
  giữ nguyên ở mọi theme. Toàn bộ tương phản đã kiểm bằng số, đạt WCAG AA
  (4.5:1) — vài màu phải dùng bậc 700/800 thay vì 500 vì bậc 500 quá sáng cho
  chữ trắng.
- **Chiều cao**: app shell khoá ở `h-dvh`, vùng nội dung tự cuộn — sidebar luôn
  cao hết màn hình, không co lại theo nội dung từng trang.
- **Lưới tuần**: khung 06:00–24:00 (18 hàng), chiều cao hàng co theo màn hình để
  xem bao quát cả tuần mà không phải cuộn. Tuần có buổi trước 6h thì lưới tự nới
  xuống nên không bao giờ ẩn mất buổi học. Nút "Hiện đủ 24 giờ" để xem toàn bộ.
- **Màu học sinh**: bảng 40 màu (8 sắc × 5 bậc) ở
  [`lib/colors.ts`](lib/colors.ts). **Không chọn màu là hợp lệ** — buổi học hiển
  thị nền trắng. Học sinh mới được gợi ý màu chưa ai dùng; chọn màu đã có người
  dùng vẫn được nhưng có cảnh báo.
- **Schema v2**: `Student.color` đổi từ số (1–8) sang mã màu chuỗi
  (`"indigo-500"`). Dữ liệu v1 được nâng cấp tự động khi đọc, giữ đúng sắc màu
  cũ nên học sinh đang có màu không bị đổi.
