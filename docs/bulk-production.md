# Sản xuất nhiều dự án trên nhiều profile

Mở **Sản xuất hàng loạt** từ màn hình Kịch bản hoặc Hàng đợi video. Nhấn **Tải file JSON mẫu**, hoặc dùng [file mẫu trong repository](../examples/bulk-production.example.json).

## Chuẩn bị file

Lưu JSON bằng UTF-8. Mỗi phần tử trong `projects` là một video hoàn chỉnh, không phải một cảnh. Hai dự án mẫu chỉ minh họa: sửa ý tưởng và đường dẫn ảnh thật trước khi nhập. Tool không chạy nếu còn bất kỳ dự án nào thiếu thông tin.

| Trường | Ý nghĩa |
| --- | --- |
| `version` | Luôn là `1` |
| `outputDirectory` | Thư mục đầu ra, ví dụ `E:/Videos/Production` hoặc `./bulk-output` |
| `projects[].id` | Mã duy nhất trong file, chỉ chữ không dấu, số, `_`, `-` |
| `title` | Tên video |
| `brief` | Ý tưởng tập, tương ứng ô Ý tưởng & thiết lập |
| `templateId` | Mã mẫu kịch bản, xem bảng bên dưới |
| `style` | Phong cách hình ảnh |
| `ratio` | `9:16` hoặc `16:9` |
| `scenes` | Số nguyên từ 1–50 hoặc `"auto"` |
| `sceneDuration` | `6`, `8`, `10` hoặc `"auto"`; cũng nhận `"8"`, `"8s"` (tương tự `6s`, `10s`), không phân biệt chữ hoa/thường |
| `resolution` | Bản tạo ban đầu: `360p` hoặc `720p`; quy trình vẫn tải 1080p trước hậu kỳ |
| `referenceImages` | Ít nhất một ảnh tham chiếu chung của dự án |
| `referenceImages[].path` | Đường dẫn PNG/JPG/WebP, tối đa 30 MB/ảnh |
| `referenceImages[].role` | `female_lead`, `male_lead`, `character_portrait`, `character_group`, `setting`, `product` |
| `referenceImages[].description` | Chỉ dẫn bổ sung về ảnh, có thể để rỗng |

Đường dẫn tương đối được tính từ thư mục chứa file JSON. Trên Windows nên dùng `/`, ví dụ `E:/Images/nhan-vat.png`; nếu dùng `\` thì phải viết `\\` trong chuỗi JSON.

| Mẫu | `templateId` |
| --- | --- |
| Review & kiến thức xe | `gara-review` |
| Đời thường & hài hước | `gara-comedy` |
| Nhà mèo bất ổn | `cat-family` |

Bản cấu hình đã lưu mới nhất trên máy được ưu tiên so với mẫu mặc định khi kiểm tra/bắt đầu lô. Tên hiển thị có thể đổi nhưng mã mẫu giữ nguyên. Mở **Mã các mẫu kịch bản hiện có** trên màn hình hàng loạt để sao chép mã của mẫu tự lưu. Cấu hình được chụp lại trong manifest khi bắt đầu lô: thay đổi mẫu sau đó không làm đổi các dự án đang chạy. Review xe dùng mô tả giọng; nhà mèo vẫn dùng chip Flow theo hồ sơ mẫu. Mẫu yêu cầu lời nói bằng lồng tiếng hậu kỳ riêng sẽ bị chặn ở bước kiểm tra, vì quy trình tự động chưa có bước tạo lời lồng tiếng ngoài Flow.

## Kiểm tra và chạy

1. Trong Quản lý profile, bật những profile muốn chạy và hoàn tất đăng nhập cả Flow lẫn Gemini. Profile phải ở trạng thái sẵn sàng.
   Không cần mở trình duyệt trước: tool tự mở đúng thư mục profile, chờ Flow hiện tài khoản rồi đọc số dư. Nếu đọc chưa được, tool thử lại tối đa ba lượt và giữ tab cần kiểm tra mở để bạn xử lý đăng nhập. Số dư đã lưu được ghi rõ là chưa xác minh và không dùng thay số dư trực tiếp.
2. Nhập JSON. Kiểm tra danh sách dự án, mẫu, ý tưởng, ảnh và thư mục đầu ra. File lỗi được liệt kê theo từng dự án.
3. Bấm **Chạy lô đã kiểm tra**. Tool đọc lại số dư trực tiếp và kiểm tra ô nhập Gemini của mỗi profile đã bật/sẵn sàng. Profile lỗi đăng nhập hoặc dưới 100 tín dụng không nhận dự án.
4. Mỗi profile hợp lệ nhận một dự án riêng. Tất cả profile hợp lệ chạy song song; trong một profile, các dự án chạy lần lượt. Không có hai dự án cùng dùng một profile đồng thời.
5. Trước mỗi dự án tiếp theo, số dư được đọc lại. Dưới 100 tín dụng thì profile dừng nhận việc; các dự án chưa được nhận giữ trong hàng đợi để tiếp tục sau khi đủ điều kiện.

Các bước bắt buộc: **Kịch bản Gemini → Tạo toàn bộ cảnh → 1080p → Xóa watermark từng cảnh → Ghép thành phẩm**. Thành phẩm được kiểm tra là file MP4 và có cạnh ngắn ít nhất 1080 pixel. Các cảnh báo về hậu kỳ, âm thanh hoặc nhận diện watermark được giữ trong chi tiết dự án; kiểm tra thành phẩm khi có cảnh báo độ tin cậy thấp.

## Khi lỗi hoặc dừng

Mỗi dự án có lượt chạy đầu và tối đa **hai lượt đối soát/thử lại**. Manifest và kết quả các bước đã xong được giữ để tiếp tục từ bước lỗi, không chạy lại toàn bộ. Sau khi hết lượt, dự án được đánh dấu lỗi và profile nhận dự án kế tiếp.

Đối soát không tự gửi lại một yêu cầu tạo video hay nâng 1080p chưa rõ đã được Flow nhận hay chưa. Với nâng 1080p bị gián đoạn, tool kiểm tra file tải dở và chỉ nhận lại nếu file hợp lệ; nếu chưa xác định được kết quả thì ghi lỗi, không tự bấm tạo yêu cầu trùng. Lỗi đăng nhập, hạn chế từ Flow hoặc CAPTCHA cần người dùng xử lý ở trình duyệt.

**Dừng sau dự án** ngừng nhận việc mới; dự án đã nhận vẫn hoàn tất. **Bỏ qua** yêu cầu dừng riêng dự án, giữ dữ liệu để xem lỗi; tác vụ đã gửi lên Flow có thể vẫn tiếp tục. **Tiếp tục lô** kiểm tra lại profile và số dư. Dự án bị gián đoạn phải tiếp tục trên đúng profile đã gửi, không chuyển sang tài khoản khác. **Kết thúc lô** chỉ dùng khi đã dừng; các dự án chờ được đánh dấu bỏ qua.

Trong khi lô đang chạy, thao tác tạo video thủ công, đổi profile và sửa trình duyệt từ tool được chặn để tránh lẫn yêu cầu hoặc đích tải file. Có thể xem thư viện và log. Không chỉnh prompt hoặc đóng các tab Flow/Gemini mà hàng loạt đang dùng.

## Thư mục kết quả

```text
outputDirectory/
  runs/<run-id>/
    manifest.json               trạng thái toàn lô
    events.jsonl                nhật ký đầy đủ toàn lô
    projects/<project-id>/
      input.json                cấu hình mẫu và đầu vào cố định của dự án
      workspace.json            trạng thái riêng để đối soát
      events.jsonl              nhật ký riêng dự án
      references/               bản sao ảnh đầu vào
      batches/                  manifest và phiên bản tạo video
      projects/                 video 1080p, cảnh đã xử lý, kết quả ghép
      final.mp4                 thành phẩm riêng dự án (khi thành công)
  successful/<run-id>-<project-id>/
    final.mp4                   bản sao thành phẩm thành công
    project.json                tên dự án, profile, cảnh báo
```

Chỉ dự án hoàn tất đủ năm bước mới được đưa vào `successful`. Dự án lỗi vẫn có thư mục riêng và log, không được tính là thành phẩm. Màn hình hàng loạt có nút mở từng thư mục, mở thư mục tổng và xuất toàn bộ JSONL; không chỉ lưu phần log đang hiển thị.
