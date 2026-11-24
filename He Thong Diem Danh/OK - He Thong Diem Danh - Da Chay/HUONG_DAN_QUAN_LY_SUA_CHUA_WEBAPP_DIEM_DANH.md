# WEBAPP ĐIỂM DANH HỌC SINH
## Tài liệu chức năng – vận hành – cấu hình – bảo trì – sửa chữa

**Phiên bản tài liệu:** 1.0  
**Ngày lập:** 24/11/2026  
**Bộ mã nguồn tham chiếu:** `Code(4).gs`, `Index(2).html`, `CCS(2).html`, `Java(4).html`

---

# 1. Mục đích của tài liệu

Tài liệu này dùng để bàn giao và bảo trì WebApp Điểm Danh. Người tiếp quản có thể dùng tài liệu để:

- hiểu WebApp làm gì và dữ liệu đi qua những file nào;
- biết nơi cần sửa khi đổi năm học, đổi file lớp, đổi INFO, đổi giao diện;
- biết cách cập nhật danh sách lớp, giáo viên, môn học, học sinh;
- biết cách cấu hình link file tháng;
- biết cách kiểm tra và sửa lỗi đồng bộ điểm danh sang file tháng;
- biết các vị trí **không được sửa tùy tiện**, đặc biệt là cột `Tổng` và cấu trúc dòng/cột của file tháng;
- triển khai lại WebApp sau khi chỉnh sửa;
- chẩn đoán lỗi theo từng nhóm: INFO, file lớp, file tháng, Drive, giao diện, cache, quyền Apps Script.

> **Nguyên tắc quan trọng:** sửa dữ liệu cấu hình trước, sửa code sau. Nếu chỉ thay đổi danh sách lớp, giáo viên, học sinh hoặc link file tháng thì thông thường **không cần sửa code**.

---

# 2. Kiến trúc tổng thể

WebApp hiện gồm 4 tệp chính:

| Tệp | Vai trò | Khi nào sửa |
|---|---|---|
| `Code.gs` | Máy chủ Apps Script; đọc/ghi Google Sheets, Drive; xử lý điểm danh và đồng bộ | Sửa logic, cấu hình ID, xử lý lỗi |
| `Index.html` | Khung giao diện, các trang, hộp thoại, các `id` của phần tử | Thêm/xóa thành phần giao diện |
| `CCS.html` | CSS: màu sắc, kích thước, bố cục, nút, hiệu ứng | Đổi giao diện |
| `Java.html` | JavaScript phía trình duyệt; sự kiện, tải dữ liệu, điểm danh, ảnh, ghi chú, gọi server | Sửa hành vi giao diện/chức năng phía người dùng |

`Index.html` nhúng `CCS.html` bằng `include_('CCS')`; JavaScript trong `Java.html` được ghép vào giao diện thông qua cơ chế template của `Code.gs`.

`google.script.run` là cầu nối giữa trình duyệt và các hàm trong `Code.gs`.

---

# 3. Các chức năng chính

## 3.1. Điểm danh học sinh

Quy trình chuẩn:

1. Chọn lớp.
2. Chọn giáo viên.
3. Chọn môn học.
4. Chọn buổi sáng/chiều nếu cần.
5. Chọn ngày.
6. Chọn từng học sinh.
7. Bấm `Có mặt`, `Vắng` hoặc `Có phép`.

Quy ước dữ liệu ở file lớp:

- `Có mặt` = ô trống.
- `Vắng` = `V`.
- `Có phép` = `P`.
- Buổi sáng = `S`.
- Buổi chiều = `C`.

Ngày hiện tại được tự động chọn. Nếu chọn ngày trước đó, giao diện hiển thị `Điểm danh bù`.

## 3.2. Chuyển học sinh

Có thể:

- vuốt sang trái để chuyển học sinh tiếp theo;
- vuốt sang phải để quay lại;
- mở `Danh sách` để tìm/chọn trực tiếp học sinh.

## 3.3. Thông tin học sinh

Giao diện có thể hiển thị:

- họ tên;
- STT/MSSV;
- ngày sinh;
- CCCD;
- BHYT;
- cha;
- mẹ;
- địa chỉ;
- ghi chú;
- ảnh đại diện.

## 3.4. Ghi chú học sinh

Ghi chú được lưu về dữ liệu học sinh.

**Quy tắc sử dụng:** không xóa ghi chú của người trước; khi bổ sung nội dung mới nên xuống dòng để giữ lịch sử ghi chú.

## 3.5. Liên hệ học sinh/phụ huynh

Giao diện có nhóm liên hệ cho:

- học sinh;
- cha;
- mẹ.

Có các nút gọi điện, Zalo, tin nhắn tùy theo dữ liệu số điện thoại.

Số điện thoại phải được cập nhật trong file dữ liệu; WebApp không tự tạo số điện thoại mới.

## 3.6. Danh sách học sinh và trạng thái điểm danh

Danh sách có thể hiển thị trạng thái:

- dấu tick xanh = có mặt;
- dấu X đỏ = vắng;
- chữ P màu cam = có phép.

## 3.7. Ảnh đại diện

WebApp hỗ trợ:

- tải ảnh học sinh;
- kiểm tra ảnh;
- lưu ảnh lên Drive;
- xóa ảnh;
- hiển thị ảnh;
- xem ảnh lớn;
- tải trước ảnh kế bên để thao tác mượt hơn.

## 3.8. Đăng ký khuôn mặt

WebApp có phần đăng ký khuôn mặt bằng camera.

Có 5 hướng chụp:

1. nhìn thẳng;
2. quay nhẹ trái;
3. quay nhẹ phải;
4. ngẩng nhẹ;
5. cúi nhẹ.

Thư viện nhận diện khuôn mặt được tải từ `face-api` CDN.

## 3.9. Thống kê vắng

Thống kê được tính theo:

- lớp;
- môn đang chọn;
- học sinh;
- tháng/dữ liệu điểm danh.

Tách riêng:

- `V` = vắng;
- `P` = có phép.

## 3.10. Tiến độ môn học

WebApp đọc dữ liệu `DanhSachMH` và tính:

- ngày bắt đầu;
- tiến độ giảng dạy;
- tổng số giờ.

Năm học được xử lý theo thứ tự:

`Tháng 8 → 9 → 10 → 11 → 12 → 1 → 2 → 3 → 4 → 5 → 6 → 7`

`HOURS_PER_SESSION = 4`, vì vậy mỗi buổi được tính 4 giờ trong logic tiến độ hiện tại.

## 3.11. Đồng bộ sang file tháng

Nút Zalo trên thanh trên cùng đang được dùng làm nút kích hoạt đồng bộ điểm danh sang file tháng.

Luồng:

`WebApp → file lớp → INFO → link tháng → sheet lớp trong file tháng → cột ngày/buổi → học sinh`

Quy ước file tháng:

- Có mặt → `FALSE`;
- Vắng → `TRUE`;
- Có phép → `TRUE`.

Giáo viên ghi ở hàng 6 của cột điểm danh chỉ lấy **từ cuối cùng của họ tên**.

Ví dụ:

`Nguyễn Phương Hải Hòa` → `Hòa`

---

# 4. Cấu trúc dữ liệu trung tâm

## 4.1. File INFO

`Code.gs` hiện dùng:

- `INFO_SPREADSHEET_ID`
- `INFO_SHEET_NAME = "INFO"`

Trong INFO, hệ thống cần nhận biết các cột:

- `ID_Khoa`
- `LOP`
- `ID_ZALO_DIEM_DANH`
- `THANG_1`
- `THANG_2`
- ...
- `THANG_12`

Ngoài ra, phần tải danh sách lớp sử dụng cột `LOP` và `ID_SHEET_LINK`.

### Quy tắc quan trọng

Nếu chỉ đổi link hoặc danh sách lớp:

**Không sửa Code.gs.**

Hãy sửa trực tiếp INFO.

### Khi đổi file INFO

Nếu tạo một file INFO mới, phải đổi:

```js
const INFO_SPREADSHEET_ID = 'ID_FILE_INFO_MỚI';
```

`INFO_SHEET_NAME` chỉ đổi nếu sheet không còn tên `INFO`.

---

# 5. Cấu trúc file lớp

Mỗi lớp có một file Google Sheets riêng.

Các sheet quan trọng:

- `DanhSachGV`
- `DanhSachMH`
- `DanhSachHS`
- `Tháng 1`
- `Tháng 2`
- ...
- `Tháng 12`

## 5.1. DanhSachGV

Dùng để cung cấp danh sách giáo viên.

## 5.2. DanhSachMH

Dùng để cung cấp:

- tên môn;
- học kỳ;
- tổng số giờ;
- ngày bắt đầu;
- tiến độ;
- thông tin lý thuyết/thực hành/thi.

Trong code hiện tại:

- cột H = `NgayBatDau`;
- cột I = `TienDo`.

## 5.3. DanhSachHS

Là nguồn chính của hồ sơ học sinh.

Các trường được code hiện tại tìm theo tên tiêu đề, trong đó có:

- STT;
- MSSV;
- HoVaTen;
- NgaySinh;
- SDT_HS;
- CCCD;
- BHYT;
- TenCha;
- SDT_Cha;
- TenMe;
- SDT_Me;
- DiaChi;
- GhiChu;
- LinkAnh;
- Vector1…Vector5;
- NgayCapNhat;
- TrangThai.

**Không nên đổi tên header tùy tiện.** Nếu đổi, phải kiểm tra `findHeaderColumn_()` và danh sách tên header mà code chấp nhận.

---

# 6. Cấu trúc sheet tháng của file lớp

Code hiện tại sử dụng:

- cột bắt đầu điểm danh: `E`;
- dòng ngày: `5`;
- dòng buổi: `6`;
- dòng giáo viên: `7`;
- dòng môn: `8`;
- học sinh bắt đầu: `9`.

Mẫu cặp cột:

- E/F = sáng/chiều ngày 1;
- G/H = sáng/chiều ngày 2;
- I/J = sáng/chiều ngày 3;
- ...

Điều quan trọng là **không được đoán cột chỉ bằng công thức số học**, vì code đang đọc header thật của sheet để tìm đúng ngày và buổi.

---

# 7. File tháng đích và cột Tổng

Đây là phần cần bảo vệ nghiêm ngặt nhất.

File tháng đích đồng bộ có quy ước:

- hàng 4: ngày;
- hàng 5: `S` / `C`;
- hàng 6: giáo viên;
- hàng 7 trở xuống: học sinh;
- cột E trở đi: các cột điểm danh.

Cột `Tổng` là cột thống kê do sheet tự tính.

**Tuyệt đối không điểm danh vào cột Tổng.**

Ví dụ:

- `AY4 = 24`, `AY5 = S` → ngày 24 sáng.
- `AZ4` trống, `AZ5 = C` → ngày 24 chiều.
- Nếu `AZ29` là tổng số học sinh vắng thì `AZ29` phải do công thức của sheet tính, không phải ô WebApp ghi `TRUE/FALSE`.

### Quy tắc bảo trì

Không dùng:

```js
getRange(7, column, getLastRow() - 6, 1)
```

một cách máy móc nếu sheet có dòng `Tổng`.

Trước khi ghi phải xác định:

1. vùng học sinh;
2. STT hợp lệ;
3. dòng `Tổng`;
4. cột điểm danh;
5. cột đích không phải `Tổng`.

**Không tự ý tạo lại công thức Tổng trong chức năng đồng bộ thông thường.** Nếu file tháng đã có cấu trúc công thức riêng, phải giữ nguyên.

---

# 8. Đồng bộ điểm danh sang file tháng – cơ chế hiện tại

Hàm chính:

```js
syncAttendanceToMonthlyImport(payload)
```

Các bước:

1. kiểm tra lớp;
2. kiểm tra ngày;
3. kiểm tra buổi;
4. kiểm tra giáo viên;
5. mở file lớp nguồn;
6. tìm sheet tháng;
7. tìm đúng cột ngày/buổi nguồn;
8. đọc STT và trạng thái học sinh;
9. đọc link tháng từ INFO;
10. mở file tháng đích;
11. tìm sheet lớp;
12. tìm cột ngày/buổi theo header thật;
13. xác định vùng học sinh dựa trên STT;
14. tạo dữ liệu `FALSE/TRUE`;
15. chỉ ghi vào cột điểm danh;
16. ghi tên giáo viên ở hàng 6;
17. `flush()` dữ liệu.

### Nguồn

```text
V → TRUE
P → TRUE
blank → FALSE
```

### Đích

```text
TRUE → vắng / có phép
FALSE → có mặt
```

---

# 9. Quy tắc xác định cột ngày/buổi

Hàm:

```js
findImportAttendanceColumn_(sheet, targetDate, session)
```

Không được sửa thành công thức cứng kiểu:

```js
E + 2 * (ngày - 1)
```

Code hiện tại đọc:

- hàng 4 = ngày;
- hàng 5 = S/C.

Đối với buổi chiều, ngày thường nằm ở cột S ngay trước cột C.

Code cũng kiểm tra header `Tổng` và loại cột đó.

### Khi gặp lỗi “Không tìm thấy cột…”

Kiểm tra:

1. ngày có nằm đúng hàng 4 không;
2. `S/C` có nằm đúng hàng 5 không;
3. cột có bị gộp hoặc thay đổi layout không;
4. cột có phải `Tổng` không;
5. file tháng trong INFO có đúng file không.

---

# 10. Nút Zalo trên giao diện

Trong `Index.html`, phần đầu trang có:

```html
<div class="quick-zalo-btn" ...>
```

Trong `CCS.html`, nút có:

```css
.quick-zalo-btn {
  pointer-events:auto;
}
```

Nếu nút bấm không hoạt động, kiểm tra cả:

- `Index.html`: có đúng class `quick-zalo-btn`;
- `CCS.html`: không có `pointer-events:none`;
- `Java.html`: có `syncAttendanceToMonthlyFile()`;
- `setupInterfaceActions()` có gắn sự kiện;
- WebApp đã triển khai phiên bản mới chưa.

---

# 11. Bộ nhớ đệm (cache)

WebApp dùng:

- `CacheService` phía Apps Script;
- `localStorage` phía trình duyệt;
- cache ảnh trong JavaScript.

Cache giúp WebApp nhanh hơn.

Các cache chính trong `Code.gs`:

```js
CLASS_FILES_CACHE_SECONDS = 21600
ATTENDANCE_DATA_CACHE_SECONDS = 21600
```

Tương đương 6 giờ.

Nếu vừa sửa INFO nhưng WebApp chưa thấy lớp/link mới, có thể cần:

1. chờ cache hết hạn;
2. chạy `clearInfoCache()`;
3. tải lại WebApp.

---

# 12. Những chỗ thường phải thay đổi khi sang năm học mới

## 12.1. Bắt buộc kiểm tra

### A. INFO

Cập nhật:

- danh sách lớp;
- ID/link file lớp;
- link `THANG_1` … `THANG_12`;
- link Zalo nếu dùng.

### B. File lớp

Kiểm tra:

- `DanhSachGV`;
- `DanhSachMH`;
- `DanhSachHS`;
- các sheet tháng.

### C. Drive

Kiểm tra thư mục ảnh học sinh.

### D. WebApp

Không cần tạo một đoạn code riêng cho từng lớp nếu INFO được cấu hình đúng.

---

# 13. Những chỗ không nên sửa

## 13.1. Không đổi tên hàm server đang được Java gọi

Các hàm quan trọng gồm:

```text
getAppConfig
getClassData
getAvatarClassData
getStudentProfilePhotoData
getStudentProfilePhotosData
saveStudentNote
prepareAttendanceSession
saveAttendance
getAbsenceStats
syncAttendanceToMonthlyImport
```

Nếu đổi tên hàm mà không sửa Java tương ứng, chức năng sẽ hỏng.

## 13.2. Không đổi ID HTML tùy tiện

Ví dụ:

```text
classSelect
teacherSelect
subjectSelect
attendanceDate
studentAvatar
studentName
studentId
attendanceStatus
bottomNav
pageAttendance
pageSettings
```

Java tìm phần tử bằng `getElementById()` hoặc selector. Đổi ID có thể làm giao diện mất chức năng.

## 13.3. Không đổi cấu trúc file tháng tùy tiện

Đặc biệt:

- hàng ngày;
- hàng S/C;
- hàng giáo viên;
- hàng môn;
- hàng học sinh;
- cột Tổng.

---

# 14. Khi nào sửa Code.gs?

Chỉ sửa `Code.gs` khi:

- thay đổi logic điểm danh;
- thay đổi quy tắc đồng bộ;
- đổi cấu trúc dữ liệu;
- đổi ID file trung tâm;
- đổi thư mục Drive;
- đổi cách tính tiến độ;
- sửa lỗi server;
- bổ sung chức năng dùng Google Sheets/Drive.

### Cách tìm nhanh

Trong Apps Script dùng tìm kiếm:

```text
SECTION: 01
SECTION: 11
SECTION: 12
SECTION: 13
SECTION: 14
SECTION: 20
```

Các nhóm quan trọng:

- `01`: cấu hình Google Sheets/Drive/cache;
- `11`: ghi điểm danh;
- `12`: cột điểm danh/cache;
- `13`: thống kê vắng;
- `14`: tiến độ môn;
- `15`: ngày/buổi/cột;
- `19`: chuẩn hóa dữ liệu;
- `20`: INFO/link tháng.

---

# 15. Khi nào sửa Java.html?

Sửa `Java.html` khi muốn thay đổi:

- hành vi nút;
- tải lớp;
- chuyển học sinh;
- vuốt;
- danh sách tìm kiếm;
- ghi chú;
- ảnh;
- đăng ký khuôn mặt;
- thống kê;
- đồng bộ file tháng;
- điều hướng;
- trạng thái loading.

Các nhóm `SECTION` trong file hiện tại:

1. Bộ chọn lớp
2. Thông tin và tiến độ môn
3. Tải cấu hình/lớp/GV/HS
4. Chuẩn bị buổi điểm danh
5. Hiển thị hồ sơ
6. Ghi chú
7. Chuyển học sinh/vuốt
8. Sự kiện giao diện
9. Cài đặt
10. Đăng ký khuôn mặt
11. Ảnh đại diện
12. Thống kê
13. Gửi/cập nhật điểm danh
14. Gọi/Zalo/tin nhắn
15. Trạng thái rỗng
16. Tải ảnh
17. Xem ảnh lớn
18. Danh sách/tìm học sinh
19. Cache/tải trước ảnh
20. Điều hướng/khởi động

---

# 16. Khi nào sửa CCS.html?

Sửa `CCS.html` khi chỉ muốn thay đổi giao diện.

Các vùng quan trọng:

- màu;
- thanh trạng thái;
- tiêu đề;
- bộ chọn lớp/GV/môn;
- thẻ học sinh;
- nút điểm danh;
- liên hệ;
- thống kê;
- hồ sơ;
- trang cài đặt;
- ngày;
- hiệu ứng vuốt;
- hộp thoại.

### Bảng màu

Ở đầu CSS có các biến:

```css
--ink
--ink-soft
--paper
--card
--line
--navy
--navy-deep
--teal
--teal-soft
--amber
--amber-soft
--coral
--coral-soft
```

Muốn đổi màu toàn hệ thống nên đổi các biến này trước, không sửa từng nút.

---

# 17. Khi nào sửa Index.html?

Sửa `Index.html` khi muốn:

- thêm trang;
- thêm hộp thoại;
- thêm nút;
- thêm trường thông tin;
- thay đổi nội dung hướng dẫn;
- thêm phần tử giao diện.

**Sau khi thêm phần tử, phải kiểm tra Java.html có tìm đúng `id/class` hay không.**

Index hiện có trang điểm danh, trang cài đặt và các vùng/hộp thoại hỗ trợ.

---

# 18. Thay đổi số giờ một buổi

Trong `Code.gs`:

```js
const HOURS_PER_SESSION = 4;
```

Nếu quy định đào tạo thay đổi, đây là một điểm cần sửa.

Tuy nhiên `Java.html` cũng có logic hiển thị tiến độ. Phải kiểm tra `loadAbsenceStats` và phần hiển thị tiến độ để bảo đảm giao diện và máy chủ cùng dùng một quy ước.

---

# 19. Ảnh học sinh và Drive

Các hằng số liên quan:

```js
const SCHOOL_YEAR_FOLDER_ID = '...';
const STUDENT_IMAGE_FOLDER_NAME = 'HinhAnhHS';
```

Nếu đổi thư mục gốc năm học:

1. lấy ID folder mới;
2. sửa `SCHOOL_YEAR_FOLDER_ID`;
3. kiểm tra quyền truy cập Apps Script;
4. thử lưu một ảnh mẫu.

Nếu đổi tên thư mục ảnh, sửa:

```js
STUDENT_IMAGE_FOLDER_NAME
```

Không đổi nếu thư mục hiện tại vẫn đúng.

---

# 20. Chuyển WebApp sang dự án mới

## Bước 1

Tạo Apps Script project mới.

## Bước 2

Tạo đúng 4 file:

```text
Code.gs
Index.html
CCS.html
Java.html
```

## Bước 3

Dán đúng nội dung.

## Bước 4

Kiểm tra:

```js
INFO_SPREADSHEET_ID
SCHOOL_YEAR_FOLDER_ID
```

## Bước 5

Kiểm tra INFO.

## Bước 6

Chạy hàm kiểm tra:

```js
testClassFiles()
```

## Bước 7

Cấp quyền khi Apps Script yêu cầu.

## Bước 8

Deploy:

`Deploy → New deployment → Web app`

## Bước 9

Chọn quyền truy cập phù hợp với môi trường sử dụng.

## Bước 10

Mở URL WebApp và kiểm tra:

- lớp;
- GV;
- môn;
- học sinh;
- điểm danh;
- ghi chú;
- ảnh;
- đồng bộ file tháng.

---

# 21. Quy trình kiểm thử sau mỗi lần sửa

Không sửa xong là đưa ngay cho người dùng.

## Test 1 – tải lớp

Chọn một lớp thực tế.

Kết quả phải có:

- giáo viên;
- môn;
- danh sách học sinh.

## Test 2 – điểm danh có mặt

Chọn một học sinh → `Có mặt`.

Kiểm tra file lớp:

- ô điểm danh tương ứng phải đúng quy ước;
- trạng thái giao diện phải báo đã ghi.

## Test 3 – vắng

Chọn học sinh khác → `Vắng`.

Kiểm tra ô nguồn = `V`.

## Test 4 – có phép

Chọn học sinh → `Có phép`.

Kiểm tra ô nguồn = `P`.

## Test 5 – điểm danh bù

Chọn ngày cũ.

Kiểm tra nhãn `Điểm danh bù`.

Chọn đúng buổi.

## Test 6 – đồng bộ file tháng

Kiểm tra:

- đúng file;
- đúng sheet;
- đúng ngày;
- đúng S/C;
- đúng học sinh;
- đúng TRUE/FALSE;
- đúng giáo viên.

## Test 7 – cột Tổng

Đây là test bắt buộc.

Chọn một ngày có cột `Tổng`.

Sau đồng bộ:

- các dòng học sinh được cập nhật;
- dòng Tổng không bị ghi `TRUE/FALSE`;
- công thức Tổng của file tháng vẫn nguyên vẹn.

Ví dụ nếu `AZ29` là Tổng thì không được biến thành `FALSE`.

---

# 22. Checklist kiểm tra lỗi đồng bộ

Khi hiện:

`Không đồng bộ được điểm danh sang file tháng`

làm theo đúng thứ tự:

### Bước 1 – kiểm tra lớp

Lớp trên WebApp có đúng tên lớp trong INFO không?

### Bước 2 – kiểm tra link tháng

INFO có link đúng tháng không?

Ví dụ ngày 24/11 thì phải kiểm tra `THANG_11`.

### Bước 3 – kiểm tra file đích

File link có mở được không?

### Bước 4 – kiểm tra sheet

File tháng có sheet đúng tên lớp không?

### Bước 5 – kiểm tra header

Kiểm tra hàng 4 và 5.

Ví dụ ngày 24:

```text
AY4 = 24
AY5 = S

AZ4 = trống
AZ5 = C
```

### Bước 6 – kiểm tra Tổng

Nếu cột kế tiếp là `Tổng`, không được ghi vào đó.

### Bước 7 – kiểm tra STT

Danh sách học sinh phải có STT hợp lệ.

### Bước 8 – kiểm tra quyền

Tài khoản triển khai WebApp phải có quyền mở/ghi file đích.

---

# 23. Các lỗi từng gặp và nguyên nhân

## Lỗi 1

```text
Co STT Tong nhung khong co ho ten tai dong ...
```

Nguyên nhân: dòng `Tổng` bị hiểu nhầm là học sinh.

Cách phòng tránh:

- chỉ coi dòng có STT hợp lệ là học sinh;
- xác định điểm kết thúc danh sách;
- không dùng toàn bộ `getLastRow()` làm vùng học sinh một cách máy móc.

## Lỗi 2

```text
Không tìm thấy cột ngày 24/11/2026, buổi C
```

Nguyên nhân: code cũ tìm ngày và `C` trên cùng một cột.

Trong cấu trúc chuẩn:

```text
AY4 = 24
AY5 = S
AZ4 = trống
AZ5 = C
```

Vì vậy buổi C phải liên hệ với ngày ở cột trước.

## Lỗi 3

```text
AZ29 = FALSE
```

Nếu `AZ29` là dòng Tổng, nguyên nhân điển hình là code ghi từ dòng 7 đến `getLastRow()` và vô tình ghi vào dòng Tổng.

**Lưu ý quan trọng:** chức năng đồng bộ không nên tự ý tạo lại công thức Tổng. Nếu công thức đã bị mất từ trước, cần sửa dữ liệu/file tháng bằng một quy trình sửa chữa riêng hoặc phục hồi từ bản sao; không nên lồng hành vi đó vào đồng bộ bình thường.

---

# 24. Cách sửa dữ liệu bị hỏng mà không làm hỏng code

Nếu một ô Tổng bị mất công thức:

1. dừng đồng bộ;
2. mở file tháng;
3. xác định dòng Tổng;
4. xem công thức của các cột Tổng bên cạnh;
5. phục hồi công thức đúng theo cấu trúc file;
6. kiểm tra kết quả;
7. chạy lại WebApp;
8. không sửa hàm đồng bộ chỉ để chữa một ô dữ liệu đã hỏng.

Ví dụ nếu các cột bên cạnh có dạng:

```text
AW29 = COUNTIF(AW7:AW28, TRUE)
AX29 = COUNTIF(AX7:AX28, TRUE)
AY29 = COUNTIF(AY7:AY28, TRUE)
AZ29 = công thức Tổng tương ứng
BA29 = COUNTIF(BA7:BA28, TRUE)
```

thì phải phục hồi theo cấu trúc thật của file, không sao chép máy móc sang mọi file.

---

# 25. Cách xử lý cache sau khi sửa dữ liệu

Nếu sửa INFO mà WebApp vẫn thấy dữ liệu cũ:

1. chạy `clearInfoCache()`;
2. tải lại trang;
3. nếu cần mở tab ẩn danh để loại cache trình duyệt.

Nếu sửa file lớp/tháng mà WebApp vẫn dùng vị trí cũ:

- kiểm tra cache slot;
- có thể chờ cache hết hạn;
- triển khai lại nếu vừa sửa code.

Không nên xóa toàn bộ cache vô tội vạ nếu chưa biết cache nào gây lỗi.

---

# 26. Nguyên tắc sửa code an toàn

## Quy tắc 1

Mỗi lần chỉ sửa một nhóm chức năng.

## Quy tắc 2

Luôn giữ bản ZIP trước khi sửa.

Ví dụ:

```text
WEBAPP_V16_BACKUP.zip
```

## Quy tắc 3

Không sửa trực tiếp trên bản đang chạy nếu chưa có bản sao.

## Quy tắc 4

Sau khi sửa:

```text
Lưu → kiểm tra cú pháp → test → deploy phiên bản mới
```

## Quy tắc 5

Không xóa comment `SECTION:`.

Các comment này giúp người bảo trì tìm đúng khu vực.

## Quy tắc 6

Không đổi tên biến/hàm chỉ vì muốn code đẹp hơn nếu chưa kiểm tra toàn bộ nơi sử dụng.

---

# 27. Bảng “muốn thay đổi gì thì sửa ở đâu?”

| Muốn thay đổi | Nơi sửa |
|---|---|
| Thêm lớp | INFO |
| Đổi link file lớp | INFO |
| Đổi link tháng | INFO |
| Đổi giáo viên | DanhSachGV |
| Đổi học sinh | DanhSachHS |
| Đổi số điện thoại | DanhSachHS |
| Đổi môn | DanhSachMH |
| Đổi tổng giờ | DanhSachMH / logic tương ứng |
| Đổi màu giao diện | CCS.html |
| Đổi kích thước nút | CCS.html |
| Đổi nội dung giao diện | Index.html |
| Thêm nút/chức năng UI | Index.html + Java.html |
| Đổi hành vi nút | Java.html |
| Đổi logic lưu điểm danh | Code.gs + kiểm tra Java.html |
| Đổi logic đồng bộ file tháng | Code.gs |
| Đổi ID INFO | Code.gs |
| Đổi folder ảnh | Code.gs |
| Đổi số giờ/buổi | Code.gs + Java.html |
| Đổi cấu trúc file tháng | Chỉ làm khi thật cần; phải sửa code và kiểm thử kỹ |

---

# 28. Quy trình bàn giao cho người mới

Người tiếp quản nên nhận đủ:

1. 4 file mã nguồn;
2. file INFO;
3. một file lớp mẫu;
4. một file tháng mẫu;
5. ID folder Drive ảnh;
6. URL WebApp;
7. tài liệu này;
8. một bản ZIP backup đang chạy tốt.

Người mới phải được hướng dẫn:

- nơi chứa INFO;
- cách thêm lớp;
- cách cập nhật link tháng;
- cấu trúc file lớp;
- cấu trúc file tháng;
- cách deploy;
- cách xem lỗi Apps Script;
- cách kiểm tra cột Tổng.

---

# 29. Quy trình khôi phục khi WebApp hỏng

## Trường hợp A – lỗi sau khi sửa code

Khôi phục ZIP phiên bản cuối cùng chạy tốt.

## Trường hợp B – lỗi do INFO

Khôi phục dữ liệu INFO, không cần sửa code.

## Trường hợp C – lỗi file tháng

Không khôi phục code ngay.

Kiểm tra:

- link;
- sheet;
- header;
- STT;
- công thức Tổng.

## Trường hợp D – lỗi ảnh

Kiểm tra:

- folder Drive;
- quyền truy cập;
- LinkAnh;
- file ảnh có tồn tại.

---

# 30. Danh sách kiểm tra cuối cùng

Trước khi bàn giao một phiên bản mới:

- [ ] `Code.gs` đúng
- [ ] `Index.html` đúng
- [ ] `CCS.html` đúng
- [ ] `Java.html` đúng
- [ ] INFO đúng
- [ ] lớp tải được
- [ ] GV tải được
- [ ] môn tải được
- [ ] học sinh tải được
- [ ] điểm danh Có mặt hoạt động
- [ ] điểm danh Vắng hoạt động
- [ ] điểm danh Có phép hoạt động
- [ ] điểm danh bù hoạt động
- [ ] ghi chú hoạt động
- [ ] ảnh hoạt động
- [ ] đăng ký khuôn mặt hoạt động nếu dùng
- [ ] thống kê hoạt động
- [ ] đồng bộ file tháng hoạt động
- [ ] cột Tổng không bị ghi đè
- [ ] công thức Tổng không bị WebApp tự ý thay đổi
- [ ] giáo viên hàng 6 đúng quy tắc
- [ ] đã tạo backup ZIP
- [ ] đã deploy phiên bản mới

---

# 31. Phụ lục – các hằng số quan trọng trong Code.gs

```js
const INFO_SPREADSHEET_ID = '...';
const INFO_SHEET_NAME = 'INFO';
const SCHOOL_YEAR_FOLDER_ID = '...';
const STUDENT_IMAGE_FOLDER_NAME = 'HinhAnhHS';

const SUBJECT_START_DATE_COLUMN = 8; // H
const SUBJECT_PROGRESS_COLUMN = 9;   // I

const HOURS_PER_SESSION = 4;

const ATTENDANCE_DATE_ROW = 5;
const ATTENDANCE_SESSION_ROW = 6;
const ATTENDANCE_TEACHER_ROW = 7;
const ATTENDANCE_SUBJECT_ROW = 8;
const ATTENDANCE_FIRST_STUDENT_ROW = 9;
const ATTENDANCE_FIRST_COLUMN = 5; // E
```

**Không thay các số dòng/cột trên chỉ vì thấy file khác có layout khác.** Nếu file thật đã đổi layout, phải xác định lại toàn bộ kiến trúc trước khi sửa.

---

# 32. Phụ lục – hàm server quan trọng

| Hàm | Mục đích |
|---|---|
| `doGet()` | Mở WebApp |
| `include_()` | Ghép HTML |
| `getAppConfig()` | Tải cấu hình |
| `getClassData()` | Tải GV/môn/HS |
| `saveStudentNote()` | Lưu ghi chú |
| `saveFaceRegistration()` | Lưu vector khuôn mặt |
| `saveStudentProfilePhoto()` | Lưu ảnh |
| `deleteStudentProfilePhoto()` | Xóa ảnh |
| `saveAttendance()` | Ghi điểm danh nguồn |
| `syncAttendanceToMonthlyImport()` | Đồng bộ sang file tháng |
| `findImportAttendanceColumn_()` | Tìm cột ngày/buổi đích |
| `getAbsenceStats()` | Thống kê V/P |
| `rebuildSubjectProgress_()` | Tính lại tiến độ môn |
| `readImportInfo_()` | Đọc cấu hình INFO |
| `clearInfoCache()` | Xóa cache INFO |

---

# 33. Kết luận

WebApp được thiết kế theo nguyên tắc:

**Dữ liệu nằm ở Google Sheets/Drive; Code.gs xử lý máy chủ; Java.html xử lý tương tác; Index.html giữ cấu trúc giao diện; CCS.html giữ phần trình bày.**

Khi bảo trì, ưu tiên theo thứ tự:

**Dữ liệu → cấu hình → kiểm tra layout → code → deploy.**

Đặc biệt với đồng bộ file tháng:

**STT học sinh và header ngày/S/C là dữ liệu xác định vị trí; cột Tổng là vùng chỉ đọc về mặt logic đồng bộ.**

Không được để một lỗi dữ liệu đơn lẻ dẫn tới việc sửa code theo kiểu làm thay đổi công thức hoặc cấu trúc của toàn bộ file tháng.
