# Dreamese Chapter Site v0.6

Bộ file gồm website chính và ứng dụng quản trị chạy trực tiếp trên trình duyệt.

## Cách mở

- Website: chạy `START-WEBSITE.bat`
- Trang quản trị: chạy `START-MANAGER.bat`

Giữ cửa sổ Terminal đang mở trong lúc sử dụng để website và video nhúng hoạt động ổn định.

## Cập nhật chính của v0.6

### 1. Sắp xếp mọi nhóm thẻ

Trong trang quản trị, các danh sách sau đều có thể nắm kéo để thay đổi thứ tự:

- Menu điều hướng
- About Us
- Projects
- Service
- Media
- News
- Contact

Nắm vùng trống của toàn bộ thẻ rồi kéo lên hoặc xuống. Các ô nhập liệu, nút bấm, vùng chọn hình và liên kết không kích hoạt thao tác kéo.

### 2. Tách riêng thao tác kéo và chỉnh sửa

- Kéo thả chỉ thay đổi thứ tự.
- Chỉ nút `Chỉnh sửa` mới mở nội dung của thẻ.
- Khi thả thẻ, ứng dụng giữ nguyên các thẻ đang mở và không tự mở thẻ đầu tiên.
- Nút `Thu gọn` đóng phần chỉnh sửa mà không làm ảnh hưởng đến thứ tự.

### 3. Bấm trực tiếp vào thẻ trên website

- Project: bấm toàn bộ thẻ để mở link dự án.
- Service: bấm toàn bộ thẻ để mở trang quy trình tương ứng.
- About Us: bấm nội dung để mở link đã cấu hình.
- Contact: bấm toàn bộ thẻ để mở link tương ứng.
- Media: bấm thẻ để mở popup phát video.
- News: bấm tiêu đề để mở phần nội dung chi tiết.

Nút `VIEW` của Project và các nút điều hướng nhỏ trong Service/Contact đã được bỏ khỏi giao diện.

### 4. News theo giao diện Góc giải đáp

News được tổ chức thành hai phần:

- Danh sách số thứ tự và tiêu đề.
- Bảng nội dung chi tiết gồm hình, ngày đăng, danh mục, tiêu đề phụ và nội dung.

Khi chưa chọn tin, bảng bên phải hiển thị lời nhắc. Bấm một tiêu đề để mở nội dung; bấm dấu `×` để đóng. Trên mobile, nội dung trượt phủ từ cạnh phải.

### 5. Nội dung Desktop và Mobile độc lập

Trang quản trị vẫn có công tắc:

- `Nội dung Desktop`
- `Nội dung Mobile`

Có thể dùng tiêu đề, mô tả, hình và link riêng cho từng giao diện. Để trống nội dung Mobile thì website dùng dữ liệu Desktop tương ứng.

## Dữ liệu và sao lưu

- Bấm `Lưu thay đổi` để lưu trong trình duyệt.
- Bấm `Xuất cấu hình` để tải `site-config.json`.
- Khi đưa lên hosting, đặt `site-config.json` cùng cấp với `index.html`.
- v0.6 tiếp tục đọc dữ liệu đã lưu từ v0.5 để giữ nguyên nội dung và thứ tự hiện tại.

## Font

Website khai báo UTM Charlotte cho tiêu đề và UTM Caviar cho nội dung. Vì lý do phân phối font, thư mục ZIP không đóng gói file font. Đặt các file font có bản quyền hợp lệ của bạn vào `assets/fonts` trên máy sử dụng.
