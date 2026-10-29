# Giải pháp chuyển kịch bản sang Google Flow

Ngày kiểm tra: 28/10/2026. Đã triển khai hàng đợi Omni 1.1 Flash, chuẩn bị cấu hình/giá, ảnh chung, tạo/tải MP4, tạm dừng và đối soát. Đã kiểm tra một video thật và UI tải lại; chưa chạy batch nhiều video thật. Các phần Veo, frame nối cảnh, upscale và FFmpeg dưới đây là lộ trình tiếp theo.

## Quyết định

Tiếp tục dùng phiên Chrome/Edge và Playwright CDP hiện có. Mỗi kịch bản gắn một dự án Flow; mỗi cảnh trở thành một tác vụ video. Dùng ô nhập chuẩn, tắt Agent trong batch để tool tự kiểm soát chính xác số cảnh, cấu hình và ngân sách. Khởi đầu chạy tuần tự, x1 đầu ra mỗi lần.

Với kịch bản chú mèo nhiều cảnh, ưu tiên Ingredients/Thành phần và cùng một ảnh tham chiếu cho nhân vật, kết hợp mô tả ngoại hình cố định. Nếu cần nối chuyển động trực tiếp, dùng frame cuối của clip trước làm frame đầu clip sau; không áp dụng cách này cho mọi lần đổi góc máy. Đây là biện pháp tăng nhất quán, không bảo đảm nhân vật giống tuyệt đối.

## Bằng chứng từ trang thật

Đã đọc DOM của dự án Flow đang mở, không bấm tạo nội dung:

| Thành phần | Quan sát thực tế |
| --- | --- |
| Dự án | URL dạng `https://flow.google.com/project/<uuid>` |
| Ô nhập | `div.ProseMirror[role="textbox"]`, nhãn `Bạn muốn tạo những gì?` |
| Mở cấu hình | `button.settings-trigger-button`, nhãn `Điều kiện kích hoạt cài đặt` |
| Chọn mô hình | button có nhãn `Chọn nhóm mô hình` |
| Chọn thông số | `button[role="radio"]`, trạng thái `aria-checked` |
| Tạo video | button có nhãn `Bắt đầu tạo` |
| Agent | `button.agent-mode-chip`, `aria-pressed="false"` khi quan sát |
| Cấu hình đang chọn | Video, Thành phần, 16:9, Omni 1.1 Flash, 720p, 8 giây, x1 |
| Chi phí hiển thị | `Quá trình tạo sẽ tốn 12 tín dụng` |
| Danh sách mô hình | Omni 1.1 Flash; Veo 3.1 Lite, Fast, Quality |

Các locator này cần đóng gói trong `flow.cjs` và kiểm tra trạng thái sau mỗi thao tác. Không dựa vào tọa độ, lớp Angular phát sinh ngẫu nhiên hoặc mặc định từ lần chạy trước. Chưa xác minh cấu trúc thẻ tác vụ/video và thao tác tải vì dự án quan sát chưa có kết quả; chỉ hoàn thiện các locator đó sau một lần tạo thực tế.

## Cấu hình đề xuất

- Mặc định đơn giản: Omni 1.1 Flash, 720p, 8 giây, x1, tỷ lệ theo dự án.
- Chế độ tiết kiệm: Omni 360p, 8 giây, x1; theo bảng hiện tại của Google là 6 tín dụng/video, so với 12 ở 720p. Pro có thể upscale Omni 360p lên 720p với 0 tín dụng nếu tùy chọn đó khả dụng trong tài khoản. Phải kiểm tra chất lượng thực tế; upscale không bảo đảm bằng bản sinh gốc ở 720p.
- Chỉ tạo một cảnh thử để đánh giá hình ảnh và cách tải trước khi chạy batch. Sau khi batch chạy, không hỏi xác nhận lại từng cảnh; dừng khi vượt ngân sách hoặc trạng thái không xác định.
- Không cố định chi phí bằng bảng trong mã nguồn. Đọc giá hiện tại trên menu sau khi đặt đủ cấu hình và đọc lại trước khi gửi từng cảnh. Giá hiển thị của request là tổng cần dự trù; không nhân x1/x2 thêm lần nữa nếu Flow đã tính tổng.
- Thời lượng phải thuộc các lựa chọn của mô hình. Không âm thầm đổi cảnh dài bất kỳ thành 8 giây. Cảnh không hỗ trợ cần chỉnh trước hoặc tách thành các đoạn có liên kết.
- Tỷ lệ hiện thấy 16:9 và 9:16. Dự án 1:1 trong tool cần báo không hỗ trợ trước khi gửi, hoặc có kế hoạch crop ở bước xuất; không tự đổi tỷ lệ.

Ví dụ 5 cảnh ở x1: 30 tín dụng với Omni 360p/8s hoặc 60 tín dụng với Omni 720p/8s theo giá hiện tại, chưa gồm ảnh tham chiếu, lần tạo lại hoặc các thao tác khác. Ví dụ số dư 431 tương ứng tối đa 71 hoặc 35 clip, không phải số bảo đảm.

## Ánh xạ nội dung cảnh

| Dữ liệu của tool | Cách sử dụng |
| --- | --- |
| `video_prompt_en` | Nội dung chính đưa vào ô nhập Flow |
| `negative_prompt_en` | Bổ sung thành ràng buộc trong cùng prompt nếu giao diện không có ô negative riêng; không giả định đây là tham số độc lập được mô hình hỗ trợ |
| `description_vi` | Hiển thị để người dùng duyệt; không gửi lặp với prompt English |
| `voiceover_vi` | Lưu cho bước giọng đọc; chỉ đưa vào Flow nếu người dùng chọn chế độ giọng do Flow sinh |
| `duration_seconds` | Chọn bằng điều khiển thời lượng thực tế, không chỉ viết trong prompt |
| Tỷ lệ dự án | Chọn điều khiển 16:9/9:16 |
| Ảnh/nhân vật tham chiếu | Gắn thành asset thật qua giao diện Ingredients hoặc chọn mục từ `@`; chỉ gõ tên không chứng minh asset đã được gắn |

Nên bổ sung dữ liệu chung: mô tả nhân vật, ảnh tham chiếu, bối cảnh, phong cách, chế độ âm thanh. Khi kết hợp prompt, kiểm tra xung đột với từng cảnh. Với chú mèo không nói chuyện, ưu tiên âm thanh tự nhiên trong clip và thu/ghép lời dẫn riêng bằng cùng một giọng tiếng Việt. Có thể dùng file giọng đọc do người dùng cung cấp; lựa chọn dịch vụ TTS là bước cấu hình riêng. Không hứa Flow sẽ đọc chính xác lời dẫn chỉ bằng việc thêm văn bản vào prompt.

## Quy trình thực thi

1. **Chốt bản kịch bản:** lưu chỉnh sửa; chụp lại toàn bộ cảnh và cấu hình thành một batch bất biến. Ghi hash của dữ liệu để thay đổi kịch bản không làm lẫn với tác vụ cũ.
2. **Đảm bảo project Flow:** mỗi dự án tool tự tạo một project Flow khi sản xuất lần đầu, lưu project ID/URL trước khi đổi tên và dùng lại cho các cảnh tiếp theo. Nếu tab đã đóng thì mở đúng URL đã lưu. Không tự nhận project bất kỳ đang mở làm liên kết.
3. **Kiểm tra đầu vào:** phiên đăng nhập, số dư, số cảnh, thời lượng, tỷ lệ, ảnh tham chiếu, mô hình và trần chi tiêu.
4. **Chuẩn bị một cảnh:** kiểm tra ô nhập chưa có bản nháp ngoài tool; chọn Video, mô hình, tỷ lệ, độ phân giải, thời lượng, x1, tắt Agent; xác minh các trạng thái chọn. Gắn reference asset và điền prompt.
5. **Đọc giá:** đối chiếu giá hiển thị với số dư và ngân sách còn lại. Không xác định được giá thì dừng trước khi gửi.
6. **Gửi đúng một lần:** ghi trạng thái `submitting` xuống đĩa trước thao tác click. Ghi nhận tập asset đang có trước click để đối chiếu sự xuất hiện của tác vụ mới.
7. **Theo dõi:** tìm tác vụ/asset mới có prompt và cấu hình tương ứng, lưu ID/URL quan sát được. Đọc trạng thái pending/generating/completed/failed. Không coi giảm tín dụng, prompt biến mất hoặc xuất hiện một thẻ bất kỳ là bằng chứng đã tạo xong.
8. **Tải và kiểm tra:** mở thao tác Download của đúng asset; chờ sự kiện tải xong và lưu theo batch/cảnh/lần thử. Kiểm tra file tồn tại, kích thước, thời lượng, độ phân giải và khả năng giải mã bằng ffprobe. Trạng thái `downloaded` tách khỏi `generated`.
9. **Cập nhật số dư:** đọc lại khi tác vụ đã được chấp nhận/hoàn tất; lưu số trước/sau để đối soát, nhưng không dùng chênh lệch số dư làm bằng chứng duy nhất vì tài khoản có thể được dùng ở nơi khác.
10. **Cảnh tiếp theo:** chỉ tiếp tục khi trạng thái hiện tại rõ ràng và ngân sách còn đủ. Tạm dừng nghĩa là không gửi cảnh mới; không mặc định hủy tác vụ đã gửi cho Google.

## Khôi phục và chi phí

Trạng thái: `queued → preparing → submitting → generating → generated → downloading → downloaded`. Nhánh phụ: `failed`, `needs_review`, `paused`.

- Lưu trước click là bắt buộc. Không thể bảo đảm tuyệt đối "exactly once" chỉ bằng giao diện web; mất kết nối đúng lúc click phải vào `needs_review` và dò lại tác vụ, không tự gửi lại.
- Retry tự động chỉ áp dụng đọc trạng thái và tải lại asset đã biết. Tạo lại video là lần thử mới, có thể mất tín dụng, chỉ chạy khi đã xác định lần cũ thất bại và người dùng chủ động chọn tạo lại trong ngân sách.
- Mỗi job lưu `batchId`, `sceneId`, `attempt`, project ID, prompt hash, reference IDs, cấu hình thực tế, giá trước gửi, số dư, thời điểm gửi, ID/URL asset và đường dẫn file.
- Giữ ngân sách đã dùng và khoản dành cho tác vụ đang chờ để không chi vượt trần khi số dư Google cập nhật chậm.
- Bản đầu có tối đa 50 cảnh, chạy một tác vụ tại một thời điểm. Có thể dùng tệp JSON riêng cho từng job với ghi tệp tạm rồi thay thế và một worker duy nhất; chưa cần thêm phụ thuộc SQLite/native. Khi cần nhiều batch, chuyển lớp lưu trữ sang SQLite.
- Worker thuộc main process, giao diện chỉ xem tiến trình. Reload giao diện không làm gửi lại. Main process khởi động lại thì dò job tồn đọng trước khi nhận batch mới.

## Giao diện cần thêm

- **Thiết lập Flow:** dự án đang gắn, mô hình, tỷ lệ, độ phân giải, thời lượng, số đầu ra, ảnh/nhân vật tham chiếu, âm thanh và trần tín dụng cho batch.
- **Hàng đợi video:** cảnh, trạng thái, cấu hình, tín dụng, ảnh xem trước, file tải và thông báo lỗi.
- **Thao tác:** Chuẩn bị trong Flow; Tạo cảnh đã chọn; Chạy các cảnh đã chọn; Tạm dừng; Đối soát tác vụ; Tải lại clip. Tạo lại là thao tác riêng, không nằm trong nút khôi phục.
- **Thư viện:** clip theo đúng thứ tự cảnh; xem lại và chọn phiên bản trước khi ghép.

## Thứ tự triển khai

1. Kết nối dự án đang mở, đọc/đặt cấu hình, biên dịch prompt và điền một cảnh. Hiển thị cấu hình/giá thực đọc về tool để kiểm tra.
2. Tạo một cảnh x1 trong ngân sách đã chọn, theo dõi tới khi hoàn tất và tải clip. Đây là bước xác minh cấu trúc kết quả thật.
3. Đưa worker và cơ chế khôi phục vào hàng đợi tuần tự; chạy thử mất kết nối sau click và tải thất bại mà không tạo trùng.
4. Bổ sung reference chung và tùy chọn frame nối cảnh; sau đó ghép clip, giọng đọc, phụ đề bằng FFmpeg.

Tiêu chí hoàn thành bước đầu: tool đặt đúng Video/ratio/model/resolution/duration/x1, đọc đúng giá; một cảnh tạo thành một asset đúng, tải được video kiểm tra được; không tự gửi lại sau timeout hoặc khởi động lại app.

## Nguồn đối chiếu

- [Tạo video, frames và ingredients](https://support.google.com/flow/answer/16353334?hl=en)
- [Mô hình và tính năng hỗ trợ, bao gồm Omni 360p/upscale](https://support.google.com/flow/answer/16352836?hl=en)
- [Chi phí và tín dụng](https://support.google.com/flow/answer/16526234?hl=en)
- [Flow Agent và cấu hình](https://support.google.com/labs/answer/17093911?hl=en)
- [Nhân vật, quản lý dự án và tải clip](https://support.google.com/flow/answer/16935308?hl=en)

Các mức giá và nhãn được ghi theo ngày kiểm tra; giao diện tài khoản tại thời điểm gửi là căn cứ thực thi. Thiết kế này dùng trình duyệt đăng nhập sẵn; không cần giả lập API nội bộ của Google hoặc xuất cookie ra dịch vụ khác.
