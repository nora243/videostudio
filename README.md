# Video Studio — Windows

## Bàn làm việc kịch bản và sản xuất

**Kịch bản** và **Hàng đợi video** là hai màn hình riêng, bố cục vừa chiều cao cửa sổ. Chỉ danh sách hoặc bảng thiết lập cuộn độc lập; nút thao tác chính và tiến trình luôn nằm trong màn hình.

- **Kịch bản:** danh sách cảnh bên trái, một cảnh đang chỉnh ở giữa, ý tưởng/thiết lập Gemini bên phải. Chọn tab **Hình ảnh**, **Lời dẫn** hoặc **Prompt video** để tập trung vào nội dung cần sửa. Có tìm cảnh, phím lên/xuống, cảnh trước/sau, chọn tất cả/bỏ chọn và thông báo thay đổi chưa lưu. Nút lưu, tạo kịch bản, xuất JSON nằm trên thanh công cụ cố định. Phản hồi gốc và xem prompt dùng hộp thoại riêng.
- **Sản xuất:** có bộ đếm clip hoàn tất, tác vụ đang xử lý, lỗi và tín dụng. Chuyển giữa **Cảnh đã chọn** để lập kế hoạch và **Tác vụ sản xuất** để theo dõi batch. Chọn một dòng để xem prompt, lỗi, video đã tải và các thao tác liên quan ở bảng chi tiết. Thiết lập Flow/ảnh tham chiếu nằm ở tab bên cạnh.
- **Điều khiển hàng đợi:** nút chính phía dưới tự chuyển thành **Chạy N cảnh đã chọn**, **Tiếp tục hàng đợi** hoặc **Đối soát tác vụ**, tùy trạng thái. Nút tạm dừng luôn ở cùng vị trí; các thao tác phụ nằm trong **Thao tác**. Việc đổi bố cục không thay đổi quy tắc ngân sách hay chống gửi trùng.
- Cảnh đang chỉnh, tab biên tập và lựa chọn cảnh được giữ lại khi tải lại giao diện. Ý tưởng và bản nháp cảnh vẫn được tách theo dự án. Kiểm thử giao diện dùng 32 cảnh ở cửa sổ 1366×900 và 1050×760, cùng video MP4 có sẵn; không gọi Gemini/Flow.

## Thư viện dự án và video

Bấm **Thư viện dự án** ở menu bên trái. Thư viện gom theo **dự án → cảnh → phiên bản video**, đọc toàn bộ manifest đã lưu nên tạo hàng đợi mới không làm các clip cũ biến mất.

- **Tìm và sắp xếp:** tìm không dấu theo tên, ghi chú, mô tả cảnh/prompt; lọc dự án đang dùng, đánh dấu sao, cần kiểm tra hoặc đã lưu trữ. Trong dự án có tìm kiếm cảnh và bộ lọc đã có video/thiếu file/chưa có video.
- **Quản lý phiên bản:** mỗi lần tạo lại cùng cảnh là một phiên bản riêng. Chọn từ danh sách để xem trước, rồi bấm **Dùng bản này** để chốt bản ưu tiên. Các phiên bản cũ vẫn được giữ.
- **Video có sẵn:** dùng **Nhập phiên bản từ máy** trên từng cảnh để thêm MP4 vào đúng cảnh. Với dự án trống có nút thêm video vào cảnh 1. Ứng dụng kiểm tra metadata và sao chép vào thư mục dự án; giữ nguyên file nguồn. Không dùng tín dụng Google. Hiện hỗ trợ MP4 dưới 512 MB.
- **Xem trước:** ảnh thu nhỏ được tạo từ clip trên máy khi thẻ xuất hiện trong vùng nhìn; có trình phát với tua video. Không cần mở lại Google hoặc gửi thêm yêu cầu tạo video.
- **Thông tin dự án:** đổi tên, ghi chú sản xuất, đánh dấu sao. Lưu trữ/khôi phục chỉ đổi trạng thái thư viện, không xóa video.
- **Xuất clip:** **Xuất các cảnh đã có** sao chép bản ưu tiên của mỗi cảnh theo thứ tự `scene-001.mp4`, `scene-002.mp4`... vào một thư mục mới cùng `project.json`. Manifest ghi rõ các cảnh chưa có file. Đây là xuất bộ clip, chưa ghép thành một phim.
- **Làm tiếp dự án:** **Mở để tiếp tục làm việc** khôi phục ý tưởng, kịch bản, liên kết Flow và hàng đợi tương ứng. Bản nháp ý tưởng và chỉnh sửa cảnh trên giao diện được tách theo dự án; bấm lưu chỉnh sửa cảnh để chốt dữ liệu. Không chuyển dự án khi tác vụ đang chạy.
- **Dự án mới:** dùng nút **+ Dự án mới** để tách nội dung mới. Tên giống nhau không làm hai dự án mới bị gộp. Khi chuẩn bị/tạo video lần đầu, tool tự tạo và liên kết một project Flow riêng.

Các batch cũ chưa có mã dự án được nhóm theo URL dự án Flow; không nhóm bằng tên. Dữ liệu không đủ để phân biệt hai kịch bản cũ từng dùng chung một URL Flow sẽ được gom vào một nhóm cũ. Mỗi dự án mới có ID riêng nên các batch sau đó được liên kết ổn định. Clip cũ giữ nguyên đường dẫn; clip mới được lưu trong `projects/<projectId>/videos/<batchId>/`. Manifest của mọi batch vẫn nằm tại `batches/<batchId>/manifest.json`; thông tin thư viện và các bản ưu tiên lưu trong `library.json`, bản làm việc từng dự án ở `projects/<projectId>/project.json`.

File bị di chuyển/xóa ngoài ứng dụng sẽ hiện **Thiếu file**. Thư viện không tự tạo lại video để sửa lỗi này. Chỉ phát các file MP4 thuộc thư mục dữ liệu được manifest ghi nhận; phát video hỗ trợ đọc từng đoạn để tua, không đưa đường dẫn tùy ý cho giao diện.

## Tạo video qua Flow

Mở bản nguồn ở chế độ DEV (`Start-VideoStudio-Dev.cmd`), dùng các bước sau:

1. Kết nối Flow và đăng nhập nếu cần. Khi bấm **Chuẩn bị cảnh**, **Tạo cảnh này** hoặc **Chạy các cảnh đã chọn**, tool tự tạo project Flow nếu dự án chưa liên kết; không cần tạo thủ công hoặc bấm liên kết trước.
2. Trong phần kịch bản, chỉnh cảnh và đánh dấu **Chọn tạo video**. Khi chuẩn bị/chạy, tool tự lưu các chỉnh sửa hiện tại.
3. Trong **Sản xuất video**, chọn 360p/720p. Không cần nhập trần tín dụng; tool kiểm tra số dư Flow thực tế trước khi gửi mỗi cảnh. Bản đầu hỗ trợ **Omni 1.1 Flash**, x1, thời lượng 4/6/8/10 giây theo cảnh và tỷ lệ 16:9 hoặc 9:16 theo dự án. Nếu Flow đang chọn mô hình khác, chọn Omni trong trình duyệt trước.
4. Tùy chọn **Chọn ảnh tham chiếu** (PNG/JPG/WebP, dưới 20 MB). Tool lưu một bản riêng và upload ảnh đó vào Flow, gắn cùng ảnh cho từng cảnh. Bỏ ảnh bằng nút **Bỏ ảnh**; ảnh đã upload vẫn nằm trong thư viện Google.
5. **Chuẩn bị cảnh trong Flow** điền prompt, đặt thông số và đọc giá, chưa tạo video. **Tạo cảnh này** tạo một cảnh ở ô xem trước; **Chạy các cảnh đã chọn** tạo lần lượt các cảnh được đánh dấu và dừng nếu số dư thực tế không đủ cho cảnh tiếp theo.
6. Khi hoàn tất, hàng đợi hiện **Đã tải**. Bấm **Mở file** để tìm MP4. Tệp và manifest nằm trong thư mục dữ liệu `batches/<batchId>/`; hàng đợi mới không xóa các tệp batch trước.

Mỗi dự án trong tool lưu URL Flow riêng trong bản làm việc của dự án. Project mới trên Flow được đặt theo tên dự án kèm mã ngắn; khi mở lại, tool dùng đúng URL đã lưu, mở tab nếu cần. Nút **Tạo project Flow cho dự án** cho phép tạo trước khi sản xuất; sau khi liên kết nút đổi thành **Mở project Flow**. Tool không tự nhận project đang mở bất kỳ làm liên kết. Các liên kết cũ bị dùng chung với dự án khác sẽ được tách bằng một project mới cho các lần sản xuất tiếp theo; các hàng đợi cũ vẫn giữ URL cũ để đối soát/tải clip.

URL được lưu ngay sau khi tạo, trước khi đổi tên. Nếu mất kết nối giữa chừng, tool thử nhận lại tab do nó mở thay vì tạo trùng. Nếu không còn xác định được tab/tác vụ tạo project, tool dừng và báo rõ. Đã kiểm thử tạo/liên kết/chuẩn bị trên Flow thật, bấm lại không tạo trùng và đóng tab/khởi động lại app vẫn mở đúng URL; không tạo video trong lượt kiểm thử này.

**Tạm dừng sau cảnh hiện tại** ngừng gửi cảnh tiếp theo, không hủy tác vụ đã gửi. **Tiếp tục cảnh chưa gửi** chỉ chạy khi không còn tác vụ chưa đối soát. **Đối soát / tải lại** chỉ đọc/tải các tác vụ đã gửi, không gửi các cảnh còn chờ. Khi mất kết nối hoặc khởi động lại, bấm kết nối Flow rồi đối soát trước. Nếu sau khi kiểm tra trực tiếp trên Flow bạn muốn bỏ một cảnh lỗi/chưa rõ kết quả, dùng **Đã kiểm tra · bỏ qua cảnh**; thao tác này không hủy tác vụ Google và vẫn giữ khoản tín dụng dự trù. **Kết thúc hàng đợi** bỏ các cảnh chưa gửi, lưu lại clip/manifest.

Tool kiểm tra prompt và cấu hình trong thông tin clip trước khi tải, chọn tải độ phân giải gốc, kiểm tra container MP4, thời lượng và kích thước hình. Hiện chưa có ffprobe/FFmpeg trên máy nên chưa kiểm tra giải mã toàn bộ hoặc ghép các clip/giọng đọc. Prompt yêu cầu âm thanh tự nhiên; lời dẫn tiếng Việt được giữ để ghép riêng ở bước sau. Không có bảo đảm mô hình tạo đúng âm thanh hoặc giữ nhân vật tuyệt đối.

Đã tạo thử một clip thật với 6 tín dụng, tải MP4 8 giây, 640×360, khoảng 949 KB; đã kiểm tra UI chuẩn bị với ảnh chung và đối soát/tải lại clip mà không tạo thêm video. Các kiểm tra ngân sách, tạm dừng và khôi phục không gửi trùng dùng mô phỏng. Chưa chạy batch nhiều video thật. Không thao tác thủ công trên cùng dự án khi hàng đợi đang chạy.

## Tạo kịch bản trực tiếp qua Gemini

1. Trong chế độ DEV, bấm **Kết nối Gemini**, đăng nhập nếu cần và xác nhận. Giữ tab Gemini mở.
2. Nhập tên dự án, ý tưởng, phong cách, tỷ lệ và số cảnh (1–50).
3. Bấm **Xem prompt** nếu muốn đọc trước. Bấm **Gửi Gemini & tạo kịch bản** để gửi prompt từ các thông tin hiện tại. Tool không tự đổi mô hình; dùng chế độ bạn đang chọn trong Gemini.
4. Tool điền ô nhập Gemini, bấm **Gửi tin nhắn**, chờ phản hồi mới hoàn tất rồi xác thực JSON. Phản hồi phải đúng số cảnh đã yêu cầu, với mô tả, lời dẫn, thời lượng và prompt video cho từng cảnh.
5. Trong **Kịch bản video**, chỉnh các cảnh rồi bấm **Lưu chỉnh sửa cảnh**. Có thể **Xuất JSON** để lưu ra tệp.

Adapter đã được kiểm tra với DOM thật: `[contenteditable="true"][role="textbox"]`, nút **Gửi tin nhắn**, vùng `model-response message-content` và nút **Sao chép** khi phản hồi hoàn tất. Có hỗ trợ nhãn tiếng Anh. Không ghi đè nếu ô nhập Gemini đang chứa bản nháp. Không tạo video hoặc tiêu tín dụng Flow trong bước này.

Mỗi yêu cầu có mã riêng để đối chiếu với phản hồi mới, tránh lấy câu trả lời cũ. Yêu cầu được lưu trước khi bấm gửi. Nếu chờ quá 3 phút, mất kết nối hoặc app khởi động lại, bấm **Kết nối Gemini** rồi **Lấy lại phản hồi**; giữ đúng hội thoại Gemini. Tool chỉ đọc tiếp, không gửi lại prompt. Nếu phản hồi không đúng JSON/số cảnh, xem và chỉnh phần **Phản hồi Gemini / chỉnh JSON**, rồi bấm **Dựng cảnh từ JSON**. Kịch bản hợp lệ trước đó được giữ cho đến khi có bản mới hợp lệ.

Kịch bản, phản hồi gốc, trạng thái yêu cầu và nguồn hội thoại được lưu trong `workspace.json` trên máy. Không dùng API key. Đã kiểm thử gửi/nhận thật, dựng hai cảnh, chỉnh lời dẫn và lưu; phiên bản portable cũ cần đóng gói lại, còn chế độ DEV đọc trực tiếp mã nguồn.

## Đọc số dư Flow

Sau khi kết nối Flow, bấm **Tôi đã đăng nhập**: ứng dụng tự mở menu tài khoản và đọc tín dụng. Nút **Đọc tín dụng Flow** dùng để cập nhật lại. Adapter ưu tiên nút `.header-user-button[role="button"]` của Flow và đọc `.credits-link .credits-count`, đã kiểm tra trên HTML thực tế. Có hỗ trợ đọc iframe và nhãn tiếng Việt/Anh. Khi thất bại, xác nhận đăng nhập vẫn được lưu và số dư cũ được giữ nguyên.

## Phát triển không cần đóng/mở thủ công

Mở `Start-VideoStudio-Dev.cmd` hoặc chạy `npm.cmd run dev` một lần thay cho bản portable. Giao diện HTML/CSS/JS tự tải lại khi lưu. Ý tưởng đang nhập được giữ ở bản nháp cục bộ. Thay đổi `flow-credits.cjs` có hiệu lực ở lần đọc tín dụng tiếp theo, không khởi động lại app. Thay đổi main/preload tự khởi động lại Electron; Chrome và phiên Google vẫn mở. Nút kết nối sẽ gắn lại tab đã có qua cổng trình duyệt được lưu khi tool khởi chạy Chrome. Bản `.exe` portable đã đóng gói không tự đọc code nguồn mới; dùng chế độ DEV khi đang phát triển. Cần chuyển sang chế độ này một lần để kích hoạt cơ chế tự cập nhật.

Khi thành công, số dư và thời điểm đọc được lưu trên máy; ngân sách dự án được cập nhật theo số dư đó. Khi thất bại hoặc thấy nhiều số dư khác nhau, ứng dụng giữ nguyên giá trị cũ. Đọc lại sau khi tạo video hoặc đổi tài khoản. Có thể nhập tay ngân sách khác; dòng nguồn vẫn thể hiện số dư Flow đã đọc gần nhất. Không tự bấm mua tín dụng hay tạo video.

Ứng dụng desktop để chuẩn bị quy trình tạo video bằng tài khoản Gemini và Google Flow của chính bạn.

## Chạy ứng dụng

- Bản portable: mở `dist/Video Studio 0.1.0.exe` sau khi đóng gói.
- Từ mã nguồn (Node.js 22 trở lên): chạy `npm install`, sau đó `npm start`, hoặc mở `Start-VideoStudio.cmd`.
- Đóng gói: `npm run dist`.

## Sử dụng bản đầu

1. Bấm **Kết nối Gemini**. Chrome hoặc Edge mở với hồ sơ riêng của Video Studio.
2. Tự đăng nhập Google, hoàn thành xác minh nếu có, kiểm tra đúng tài khoản và gói sử dụng.
3. Trở lại ứng dụng, bấm **Tôi đã đăng nhập**. Đây là xác nhận thủ công, không phải kiểm tra quyền truy cập Pro.
4. Bấm **Kết nối Flow**, hoàn tất các bước đăng nhập hoặc giới thiệu của Flow rồi xác nhận tương tự. Hai dịch vụ dùng chung hồ sơ trình duyệt.
5. Nhập ý tưởng, số cảnh, tỷ lệ, phong cách và ngân sách. Bấm **Lưu dự án**.
6. Bấm **Tạo prompt kịch bản**, sao chép rồi dán vào Gemini. Bản hiện tại tạo prompt từ mẫu cục bộ; chưa tự gửi hoặc đọc câu trả lời.

Đóng cửa sổ ứng dụng không đóng trình duyệt. Lần mở lại sẽ thử kết nối hồ sơ cũ khi bạn bấm kết nối. Nếu kết nối thất bại, đóng các cửa sổ trình duyệt của hồ sơ Video Studio rồi thử lại. Trình duyệt cá nhân dùng hồ sơ mặc định riêng.

Dữ liệu dự án nằm tại `%APPDATA%/video-studio/workspace/workspace.json`; phiên Google nằm trong thư mục `browser-profile` cạnh đó. Nút **Thư mục dữ liệu** mở đúng vị trí thực tế. Hồ sơ có cookie đăng nhập: không chia sẻ hoặc đưa vào Git. Để đăng xuất, dùng giao diện tài khoản Google trong trình duyệt này. Ứng dụng không thu thập mật khẩu, không xuất cookie, không dùng API key.

## Kiểm tra

`npm run check` kiểm tra cú pháp. `node --test tests/*.test.cjs` kiểm tra địa chỉ dịch vụ, phân tích số dư và mô phỏng đọc menu tài khoản trong iframe. Đọc số dư trên phiên Google thật cần kiểm tra bằng tài khoản của bạn.

## Phạm vi hiện tại

Đã có giao diện desktop, mở/kết nối Chrome/Edge qua Playwright CDP trên localhost, hồ sơ dùng chung bền vững, trạng thái cửa sổ trình duyệt, xác nhận thủ công, lưu dự án, prompt mẫu, đọc số dư Flow theo yêu cầu và ước tính ngân sách.

Đã có gửi prompt Gemini, dựng/chỉnh cảnh, chuẩn bị và tạo video Flow theo hàng đợi, ảnh chung và tải MP4. Chưa có ghép phim, giọng đọc riêng, upscale tự động hoặc chọn mô hình Veo trong tool. Các mục điều hướng có nhãn “Sắp có” là chỉ báo lộ trình.

## Giải pháp tiếp theo

Luồng dự kiến: ý tưởng → Gemini → kịch bản JSON → kiểm tra/chỉnh từng cảnh → hàng đợi Flow → tải clip → ghép bằng FFmpeg → xuất video.

- **Desktop / IPC:** Electron với renderer cô lập, không cấp Node.js cho giao diện. Main process quản lý tệp, trình duyệt và tác vụ.
- **Browser session:** Chrome/Edge thật với hồ sơ riêng, Playwright kết nối qua CDP. Người dùng tự xử lý đăng nhập, CAPTCHA, xác minh và điều khoản. Không dùng cơ chế né xác minh. Trang có thể thay đổi hoặc không chấp nhận phiên điều khiển; cần kiểm thử đăng nhập thực tế trước khi tiếp tục tự động hóa.
- **Gemini adapter:** tìm ô nhập và nút gửi theo vai trò/nhãn, gửi prompt sau thao tác bắt đầu của người dùng, chờ câu trả lời hoàn thành, xác thực JSON và cho chỉnh cảnh. Không xem nội dung trang là lệnh để chạy trên máy.
- **Flow adapter:** chọn dự án/mô hình/tỷ lệ, điền prompt cảnh, ghi nhận tác vụ và tải clip. Triển khai sau khi quan sát giao diện tài khoản thực tế; không giả định selector hoặc endpoint riêng của Google.
- **Job runner:** SQLite lưu project/scene/job/artifact và nhật ký; mỗi cảnh có trạng thái draft/queued/submitting/generating/completed/failed/needs_review. Chỉ chạy tuần tự ban đầu. Gặp timeout sau khi gửi thì chờ kiểm tra tác vụ cũ, không tự gửi lại làm tiêu thêm tín dụng. Có tạm dừng/tiếp tục và khôi phục sau khởi động.
- **Tín dụng:** hỗ trợ nhập tay số dư để lập kế hoạch hoặc đọc số dư hiển thị từ Flow. Hàng đợi kiểm tra số dư thực tế trước mỗi cảnh, không còn trần tín dụng nhập tay; không hứa số clip cố định từ số tín dụng.
- **Xuất bản:** lưu clip theo cảnh và manifest; FFmpeg ghép video, âm thanh, phụ đề khi đủ tài sản. Không tự đăng mạng xã hội.

Giai đoạn 1 là bản hiện tại. Giai đoạn 2: tích hợp Gemini và trình sửa cảnh. Giai đoạn 3: thử một cảnh Flow với tài khoản thật rồi triển khai hàng đợi, ngân sách và tải clip. Giai đoạn 4: ghép phim và bộ cài.

## Tài liệu Google

- https://support.google.com/flow/answer/16353333 — hướng dẫn bắt đầu; Google khuyến nghị trình duyệt Chromium trên desktop.
- https://support.google.com/flow/answer/16526234 — quy định tín dụng. Tài liệu tra cứu ngày 28/10/2026 ghi Pro có 1.000 tín dụng mỗi tháng; số dư thực tế, ưu đãi và chi phí cần kiểm tra trong tài khoản. Ô ngân sách cho phép nhập 1.050 nếu đó là số dư bạn có.

Gói đăng ký web được sử dụng qua giao diện web trong thiết kế này; ứng dụng chưa tích hợp Gemini API hay dịch vụ Veo tính phí riêng.

## Kho mẫu Em gái gara

Trong Kịch bản → Thể loại & cấu hình có hai thể loại lớn: Review & kiến thức xe và Đời thường & hài hước. Chọn thể loại rồi cấu hình công thức viết, nhân vật, người nói và âm thanh. Có thể áp dụng hoặc lưu cấu hình dùng lại mà không cần nhập chủ đề tập. Ý tưởng mỗi video nhập riêng trong bảng dự án. Áp dụng cấu hình không thay tên dự án, ý tưởng tập, tỷ lệ, số cảnh hoặc các cảnh hiện có, và không tự gửi Gemini. Cấu hình đã lưu nằm trong dữ liệu trình duyệt của ứng dụng; hồ sơ sản xuất lưu theo từng dự án và bản nháp.

Hồ sơ có tối đa 8 người nói, mỗi người có mã riêng, tên, giới tính giọng, vùng Bắc/Trung/Nam và mô tả âm sắc. Mặc định nữ chính và khách đều giọng Nam; có thể đổi trước khi gửi. Bật/tắt lời dẫn ngoài hình và hội thoại độc lập. JSON Gemini bổ sung `audio` cho từng cảnh: chế độ, danh sách hồ sơ giọng, người dẫn, danh sách lượt thoại theo speaker id, âm thanh môi trường và nhạc. Trong tab Lời & âm thanh có thể sửa từng lượt thoại, đổi người nói và thêm/xóa lượt. Khi gửi Flow, các trường này được biên dịch vào prompt; cảnh cũ chưa có audio vẫn giữ cách tạo không lời như trước.

Giọng nhất quán: mô tả giọng dùng chung chỉ là chỉ dẫn cho mô hình. Google hướng dẫn dùng Voice reference với Omni Flash → Video → Ingredients → Add → Voices, dùng cùng tham chiếu cho các clip. Tool hiện chưa tự chọn/gắn Voice reference. Chế độ lồng tiếng hậu kỳ lưu nội dung thoại nhưng yêu cầu Flow không tạo lời nói; chưa có tạo/ghép TTS tự động. Tài liệu: https://support.google.com/flow/answer/16353334?hl=en (tra cứu 28/10/2026).

Kiểm tra offline: `node scripts/verify-production.cjs` kiểm tra kho mẫu, mẫu riêng, prompt Gemini, lưu giọng/vùng, chỉnh thoại, mở lại và tách dữ liệu dự án; không sử dụng tín dụng Google.

## Biên tập và viết lại cảnh

Với kịch bản đã có, tick các cảnh trong danh sách rồi bấm **Viết lại N cảnh đã chọn**. Nếu chưa chọn cảnh nào, tool yêu cầu chọn trước; không tự thay toàn bộ kịch bản. Nút **Tạo lại cảnh này** chỉ gửi cảnh đang xem. Có ô yêu cầu viết lại tùy chọn trong bảng ý tưởng. Tool lưu chỉnh sửa hiện tại trước khi gửi, đưa toàn bộ mạch truyện làm ngữ cảnh, rồi chỉ ghép kết quả vào các cảnh được yêu cầu. Phản hồi sai số cảnh hoặc dựa trên bản đã thay đổi không được ghi đè tự động. Có thể lấy lại phản hồi hoặc sửa JSON khi Gemini bị ngắt/sai định dạng.

Thanh công cụ cảnh hỗ trợ lên/xuống, chọn vị trí bất kỳ, xóa và hoàn tác thao tác gần nhất trong phiên. Đổi thứ tự/xóa/hoàn tác và kết quả Gemini được lưu vào workspace và bản dự án trong thư viện. Mã cảnh nội bộ không đổi khi di chuyển/xóa để giữ liên kết video cũ; số cảnh hiển thị trong trình biên tập và kế hoạch hàng đợi theo thứ tự dựng hiện tại. Video và hàng đợi đã tạo giữ bản chụp cũ, không tự tạo lại khi sửa kịch bản. Cần tạm dừng Flow trước khi lưu thay đổi kịch bản. Có thể xóa hết cảnh để bắt đầu lại từ ý tưởng.

Thể loại review áp dụng hook và cấu trúc tư vấn cụ thể, nhịp nói nhanh vừa với mục tiêu 28–36 đơn vị tách bằng khoảng trắng cho một cảnh 8 giây, có điều chỉnh theo hành động/ngắt nghỉ. Đây là ước lượng; cần nghe thử clip thực tế. Không dùng các mốc bảo hành, chai pin hoặc chi phí sửa chữa chung cho mọi xe khi chưa có dữ kiện. Gemini vẫn cần được kiểm tra nội dung trước khi xuất bản.

`node scripts/verify-script-edit.cjs` kiểm tra Electron IPC và luồng gửi/nhận bằng Chrome với trang Gemini giả lập nội bộ, không gọi Google: viết lại nhiều/một cảnh, giữ các cảnh không chọn, đổi thứ tự, xóa/hoàn tác, mở lại dự án và bảo toàn mã cảnh.

## Nhật ký hoạt động

Nút **Nhật ký** trên thanh đầu trang mở bảng tiến trình trực tiếp trên mọi trang. Có lọc mức độ (thông tin/cảnh báo/lỗi), dự án và tìm kiếm; chọn sự kiện để xem thời gian, thao tác, bước dừng, mã cảnh, mã hàng đợi/tác vụ và lỗi kỹ thuật đầy đủ. Lỗi gần nhất được giữ trong bảng và nút Nhật ký đổi màu khi có lỗi; thông tin không phụ thuộc vào toast. Có sao chép sự kiện, xuất JSONL và mở thư mục logs.

Các thao tác IPC được ghi bắt đầu/hoàn tất/thất bại; riêng Flow ghi các bước cấu hình, điền prompt, tìm/upload/chọn/gắn/kiểm tra ảnh, đọc chi phí, gửi/chờ/tải video. Lỗi xảy ra trong hàng đợi nền cũng ghi lại. Poll trạng thái không tạo log liên tục. Nhật ký không ghi toàn bộ đối số IPC hoặc prompt, nhưng lỗi trình duyệt có thể chứa nội dung locator và thông tin hiển thị trong trang.

File ở thư mục dữ liệu của ứng dụng: `workspace/logs/activity.jsonl` và `activity.previous.jsonl`, xoay vòng khoảng 5 MB/file. Giao diện và file xuất chứa tối đa 2.000 sự kiện gần nhất, đọc lại khi khởi động. Nếu lỗi ghi đĩa xảy ra, nhật ký vẫn giữ trong bộ nhớ và hiển thị cảnh báo khi tải nhật ký. Nhật ký chỉ ghi từ lúc tính năng hoạt động; không khôi phục lỗi chuẩn bị cảnh đã xảy ra trước đó.

Kiểm tra offline: `node scripts/verify-logs.cjs` kiểm tra lỗi trực tiếp, lọc/tìm kiếm, chi tiết bước, clipboard, xuất file, mở trên trang thư viện và giữ log sau khởi động lại; không gọi Google.

Ảnh tham chiếu Flow: bộ nhận diện hỗ trợ thumbnail `/asb/...` và mã UUID của ảnh đã gắn trong ô prompt. Tool chờ ảnh tải thật, chọn kết quả có tên duy nhất và xác nhận chip ảnh cuối cùng; hỗ trợ cả tự gắn khi chọn và nút “Thêm vào câu lệnh”. Không dùng URL thumbnail để lọc theo UUID vì hai dạng có thể khác nhau. Ảnh đã gắn nhưng chưa được tool xác nhận sẽ yêu cầu gỡ trước, tránh tự thay ảnh khác. Thao tác chuẩn bị chỉ đọc cấu hình/chi phí, không gửi video.

## Tải bản 1080p từ Flow

Trong chi tiết tác vụ video và mỗi cảnh của Thư viện có nút **Tải bản 1080p**. Trang Hàng đợi và chi tiết dự án trong Thư viện có nút **Tải 1080p tất cả cảnh**: xử lý tuần tự video đã chọn của mỗi cảnh qua các đợt sản xuất của dự án, bỏ qua bản đã có từ 1080p trở lên trên máy. Video nhập từ máy không có mã Flow không được gửi nâng độ phân giải. Trong khi tải, thao tác sản xuất/chuyển dự án bị khóa để giữ đúng tab Flow; có thể dừng sau cảnh hiện tại và theo dõi trong Nhật ký.

Tool chọn đúng mã video đã tạo → menu Tải xuống → 1080p, chờ file tối đa 10 phút. Nếu Flow yêu cầu hộp thoại xác nhận thêm, tool dừng mà không tự chấp nhận. File tải tạm được kiểm tra MP4, cạnh ngắn 1080, thời lượng và tỷ lệ trước khi dùng. Bản gốc giữ nguyên, bản nâng cấp nằm trong `job.renditions['1080p']`, lưu file riêng và cập nhật manifest/workspace. Lỗi nâng cấp không làm mất bản gốc, không gửi tạo lại video, và không tự lặp lại yêu cầu chưa rõ kết quả sau khi khởi động lại; có thể kiểm tra Flow rồi thử tải riêng cảnh.

Xem trước, mở file, protocol video và xuất dự án tự chọn bản có độ phân giải cao nhất còn tồn tại của phiên bản nội dung đã chọn. Nếu bản 1080p bị thiếu, tool dùng lại bản thấp hơn còn hợp lệ. Mặc định chọn video chất lượng cao nhất khi chưa có lựa chọn phiên bản riêng; lựa chọn phiên bản nội dung của người dùng vẫn được giữ. Chưa có pipeline ghép phim/TTS tự động; các bước hậu kỳ hiện dùng file xuất chất lượng cao nhất này.

Kiểm tra: `node scripts/verify-upscale-ui.cjs` dùng Flow giả lập và MP4 thực để xác nhận tải riêng/tất cả, bỏ qua bản đã có, phát 1080p, xuất 1080p và giữ sau mở lại. `node scripts/verify-upscale-live.cjs` tải 1080p của video Flow hiện tại vào thư mục kiểm thử, không tạo clip mới.

## Bảng cảnh toàn dự án và lỗi đã xem

Tab Tác vụ sản xuất lấy dữ liệu từ mọi manifest của dự án, không chỉ đợt chạy gần nhất. Mỗi cảnh hiển thị lượt sản xuất mới nhất; các lượt trước vẫn ở Thư viện. Bộ đếm hoàn tất theo cảnh, tín dụng cộng qua các đợt và bản xem trước/tải 1080p sử dụng đúng mã đợt của video, kể cả cảnh từ đợt cũ. Trong Cảnh đã chọn, bấm hàng cảnh mở Thiết lập và chọn đúng cảnh trong ô xem trước. Trong Tác vụ sản xuất, bấm hàng cảnh mở Chi tiết tác vụ để xem video/prompt. Độ phân giải sản xuất mặc định là 720p, vẫn có thể chọn 360p.

Trong Nhật ký, bấm Xem lỗi hoặc chọn một dòng lỗi sẽ đánh dấu các lỗi hiện có là đã xem, tắt nhãn “có lỗi” và giữ nguyên lịch sử lỗi. Lỗi mới có mã sự kiện mới sẽ bật lại nhãn. Danh sách mã lỗi đã xem lưu trên máy qua các lần mở ứng dụng.

`node scripts/verify-production-controls.cjs` kiểm tra ba đợt sản xuất, cảnh cũ và lượt mới nhất, phát video từ đợt cũ, không còn ô trần tín dụng, chọn cảnh mở Thiết lập, ghi nhớ lỗi đã xem và báo lỗi mới. Không gọi Google.

Đối soát video: nhận diện cả URL UUID và video `/asb/...` với tùy chọn phát như `=mm,22,15`; mã proxy cũ được chuẩn hóa trước khi dùng locator. Thẻ video được tìm theo mã media thay vì vị trí trong lưới. Bảng thông tin được mở sau khi trạng thái hover cũ đóng, và chờ đủ prompt/mô hình/tỷ lệ/thời lượng/độ phân giải trước khi chấp nhận kết quả. Bảng mở lỗi được thử đọc lại tối đa ba lần; không gửi lại lệnh Generate. Nếu đường dẫn thay đổi sau khi tải lại Flow, tool đối chiếu lại nội dung và vẫn dừng nếu có nhiều kết quả khớp. `node scripts/verify-collect-ui.cjs` kiểm tra thẻ di chuyển, video đổi thứ tự, metadata tải chậm và đường dẫn ASB bằng giao diện giả lập.

## Xử lý hậu kỳ

Menu **Xử lý hậu kỳ** cho phép chọn dự án, phiên bản ưu tiên, các cảnh cần dùng và đổi thứ tự bằng ↑/↓. Thứ tự mặc định theo kịch bản, kể cả sau khi đổi vị trí cảnh. Có ba tác vụ: xóa watermark từng cảnh, ghép các cảnh, hoặc xóa rồi ghép. Nên dùng **Tải 1080p tất cả cảnh** trước khi hậu kỳ; tool tự lấy bản độ phân giải cao nhất đã có của phiên bản ưu tiên.

Bộ xử lý video được đóng gói từ dự án `gemini-watermark-remover` (MIT), chạy cục bộ bằng Chrome/Edge headless riêng, không dùng hồ sơ đăng nhập Flow và không gọi dịch vụ tạo video. Nhận diện watermark kim cương/chữ Veo, áp dụng inverse alpha và cleanup vùng watermark. Bản tích hợp hiện dùng backend `none` cho bước denoise thử nghiệm; không tải mô hình AI bên ngoài. Có thể còn dấu vết watermark, nhất là khi nhận diện độ tin cậy thấp; ứng dụng vẫn xuất bản xử lý và hiện cảnh báo.

Chất lượng: giữ kích thước và timestamp khung hình nguồn, mã hóa H.264 với bitrate ít nhất 40 Mbps hoặc 1,5 lần bitrate file nguồn. Mã hóa lại không bảo đảm giống tuyệt đối bản Flow. Khi chỉ xóa watermark, sao chép âm thanh nếu codec được hỗ trợ; báo rõ nếu không thể sao chép. Ghép dùng packet copy cho phần hình và không mã hóa lại lần thứ hai. Các cảnh khác cấu hình codec/kích thước bị từ chối ghép để tránh tự giảm độ phân giải. Âm thanh khi ghép được chuẩn hóa stereo 48 kHz, 192 kbps.

Đầu ra nằm tại `projects/<projectId>/postproduction/<runId>/`: `final.mp4` hoặc các `scene-xxx-clean.mp4`, kèm `manifest.json` ghi nguồn, kết quả nhận diện, thông số và cảnh báo. File gốc giữ nguyên. Nút **Mở kết quả** mở file trong Explorer. Có tiến trình và nút dừng; tác vụ bị gián đoạn không tự chạy lại. Lượt gần nhất được khôi phục khi mở app, các lượt trước còn trong thư mục dự án. Kết quả chưa được nhập ngược thành phiên bản trong thư viện.

Giới hạn hiện tại: xử lý/ghép giữ video trong bộ nhớ; kiểm tra MP4 hiện giới hạn 512 MB mỗi file đầu ra. Nên chia dự án dài thành nhiều nhóm cảnh. HDR/chuyển màu không được đảm bảo bởi pipeline xuất BT.709 hiện tại.

Kiểm tra: `npm.cmd run check`, `npm.cmd test`, `node scripts/verify-postproduction.cjs` (video mẫu từ checkout watermark-remover), `node scripts/verify-postproduction-ui.cjs`. Script UI dùng `--no-sandbox` chỉ cho phiên kiểm thử do ACL Electron trên máy; cấu hình sandbox ứng dụng giữ nguyên. Build lại engine khi cập nhật thuật toán: `node scripts/build-postproduction.cjs <đường dẫn checkout watermark-remover>`. License đi kèm tại `src/vendor/gwr/LICENSE`.

## Flow báo lỗi và giới hạn chờ tạo video

Mỗi lượt tạo chờ tối đa 5 phút (không áp dụng cho yêu cầu tải bản upscale 1080p). Tool kiểm tra thẻ lỗi `Không thành công` / `Failed` khi chờ; nếu có duy nhất một thẻ lỗi mới thuộc lượt đang chạy, tool bấm nút **Thử lại** trên chính thẻ đó, tối đa 2 lần cho mỗi cảnh. Mỗi lần thử lại bắt đầu một lượt chờ tối đa 5 phút mới. Lỗi còn lại sau lần thử thứ hai sẽ tạm dừng hàng đợi, giữ các cảnh tiếp theo ở trạng thái chờ.

Bộ đếm và trạng thái bấm thử lại được lưu trong manifest. Không tự bấm lại khi lần bấm trước chưa rõ kết quả, khi có nhiều thẻ lỗi mới, hoặc khi không nhận diện được duy nhất nút thử lại. Hết 5 phút mà không có thẻ lỗi thì tạm dừng để đối soát, không gửi một yêu cầu tạo mới. Các thẻ lỗi đã có trước khi gửi cảnh được loại khỏi thao tác thử lại. Tool không sửa prompt để vượt lỗi chính sách; Flow có thể tiếp tục từ chối và hàng đợi sẽ dừng theo giới hạn trên.

Kiểm thử offline bằng Chrome, không gửi yêu cầu Google: `node scripts/verify-flow-retry.cjs`.

### Xem trước toàn bộ cảnh trước khi hậu kỳ

Trang **Xử lý hậu kỳ** có trình phát **Xem trước toàn bộ cảnh**: phát nối tiếp các bản video gốc chất lượng cao nhất đã tải, theo đúng danh sách cảnh được chọn và thứ tự ↑/↓. Bấm **Phát tất cả**, dùng nút cảnh trước/sau hoặc thanh **Tua toàn bộ video** để kiểm tra. Hết cảnh cuối thì dừng; đổi lựa chọn hoặc thứ tự sẽ đặt lại trình phát về cảnh đầu. Rời trang sẽ tạm dừng âm thanh/video. Xem trước không ghép/mã hóa file và không chạy xóa watermark; giữa hai cảnh có thể có khoảng chờ nạp clip ngắn. Nếu thiếu hoặc không đọc được file, trình phát báo cảnh bị lỗi để kiểm tra.

Kiểm tra MP4 thật trong Electron: `node scripts/verify-postproduction-preview.cjs` (fixture video từ checkout watermark-remover).

## Quản lý profile Google

Menu **Quản lý profile** nằm ngay dưới **Tổng quan**. Mỗi profile là một thư mục Chrome/Edge độc lập, có cookie và phiên đăng nhập riêng. Hồ sơ cũ được giữ nguyên tại `browser-profile`, hiển thị là **Tài khoản hiện tại**. Các hồ sơ mới nằm tại `browser-profiles/<profileId>` trong thư mục dữ liệu ứng dụng. Danh sách, email ghi chú, thứ tự ưu tiên và số dư gần nhất được lưu trong `browser-profiles.json`; tool không yêu cầu hoặc lưu mật khẩu Google.

1. Thêm tên profile và email ghi chú.
2. Bấm **Mở Flow / Đăng nhập**, tự đăng nhập một tài khoản Google trong cửa sổ riêng của profile đó. Cấu hình Flow theo mô hình được tool hỗ trợ như với tài khoản hiện tại.
3. Bấm **Kiểm tra tín dụng** để đọc số dư thực tế. Chỉ profile đã kiểm tra mới được dùng khi tự chuyển. Email là ghi chú do người dùng nhập, không phải xác minh danh tính đăng nhập.
4. Bật **Dùng khi tự chuyển** trên các profile cần dùng; sắp xếp ưu tiên bằng ↑/↓.
5. Bật **Tự chuyển profile khi không đủ tín dụng**. Đây là tùy chọn được lưu, mặc định tắt khi nâng cấp.

Trước khi gửi cảnh, hàng đợi đọc số dư Flow và đối chiếu với chi phí cấu hình. Khi thiếu tín dụng, tool lần lượt kiểm tra trực tiếp những profile đủ điều kiện theo thứ tự ưu tiên, bỏ qua hồ sơ chưa đăng nhập/đã tắt và chuyển sang hồ sơ còn đủ tín dụng. Mỗi tài khoản có liên kết project Flow riêng cho cùng dự án VideoStudio; tool mở hoặc tạo project tương ứng, chuẩn bị lại cùng cảnh/ảnh tham chiếu rồi mới gửi. Không tự chia sẻ project hoặc cookie giữa tài khoản. Nếu mọi profile đều hết tín dụng, không đăng nhập hoặc không truy cập được, hàng đợi tạm dừng trước khi gửi cảnh. Trạng thái đăng nhập hết hạn được đánh dấu để kiểm tra lại.

Mỗi clip mới ghi `profileId` và `projectUrl` vào manifest. Đối soát, tải lại và tải 1080p dùng đúng profile đã tạo clip; không gửi lại cảnh đang chờ kết quả khi chuyển profile. Clip cũ chưa có profile được coi là thuộc **Tài khoản hiện tại**. Số dư cache trên trang profile chỉ để theo dõi; quyết định gửi video dùng số dư đọc trực tiếp. Tool giữ nguyên cách tính tín dụng dự trù hiện có, không tự coi khoản hoàn tín dụng Flow là đã về tài khoản.

Thao tác chuyển/sửa profile bị khóa khi đang tạo kịch bản, chạy/đối soát Flow, tải 1080p hoặc kiểm tra kết nối. Sau khi đổi profile, Gemini cũng dùng hồ sơ mới; muốn lấy phản hồi của yêu cầu Gemini đang dở cần chọn lại hồ sơ đã gửi. Hậu kỳ trên máy vẫn dùng chung thư viện video của dự án.

Kiểm tra: `npm.cmd run check`, `npm.cmd test`, `node scripts/verify-profiles-ui.cjs`. Kiểm thử giao diện dùng hai Chrome headless riêng, cookie và số dư giả lập độc lập; không đăng nhập hay tạo video Google thật. Kiểm thử hàng đợi xác nhận chuyển khi thiếu tín dụng, gửi đúng cảnh vào đúng project/tài khoản, không tạo trùng yêu cầu chưa rõ kết quả, và tạm dừng khi không còn tài khoản dùng được.

## Nhiều ảnh tham chiếu theo vai trò

Trong **Hàng đợi video → Thiết lập → Ảnh tham chiếu chung**, ảnh được chia thành **Nhân vật → Nữ chính / Nam chính**, **Bối cảnh**, **Sản phẩm**. Mỗi nhóm cho phép chọn nhiều PNG/JPG/WebP cùng lúc (tối đa 20 MB mỗi ảnh), xem thumbnail, ghi mô tả, đổi vai trò và bỏ từng ảnh hoặc toàn bộ. Ảnh được sao chép vào dữ liệu dự án; thumbnail chỉ phục vụ ảnh được dự án ghi nhận, không nhận đường dẫn tùy ý từ giao diện. Mô tả cần bấm **Lưu** để áp dụng. Ảnh cũ duy nhất được hiển thị mặc định trong nhóm **Nữ chính**; có thể đổi vai trò nếu ảnh thuộc mục khác.

Prompt video được bổ sung bảng phân công từng ảnh theo đúng thứ tự đính kèm: nữ chính → nam chính → bối cảnh → sản phẩm, giữ thứ tự ảnh trong mỗi nhóm. Mỗi dòng ghi số ảnh, tên file upload, nhiệm vụ của ảnh và mô tả bổ sung đã lưu. Prompt yêu cầu giữ đúng khuôn mặt/trang phục của từng nhân vật, không hoán đổi nữ chính với nam chính; ảnh bối cảnh chỉ dẫn môi trường/không gian/ánh sáng; ảnh sản phẩm chỉ dẫn thiết kế/màu sắc/vật liệu và danh tính sản phẩm. Nhiều ảnh trong cùng nhóm được hiểu là nhiều góc nhìn của cùng đối tượng. Vai trò tham chiếu không tự thêm nhân vật hay sản phẩm vào cảnh vốn không gọi tới đối tượng đó.

Tool tìm/upload và gắn lần lượt mọi ảnh trên Flow, kiểm tra ID và thứ tự các chip ảnh trước khi gửi video. Nếu Flow không cho thêm đủ ảnh, ảnh chưa tải xong hoặc có chip ảnh không được xác nhận, tool dừng trước khi gửi; không âm thầm tạo cảnh với thiếu ảnh. Khả năng giữ giống nhân vật/sản phẩm còn phụ thuộc mô hình Flow, không bảo đảm chỉ bằng mô tả prompt. Đổi bộ ảnh sẽ gỡ các chip đã biết và xóa bản nháp do tool chuẩn bị nếu nội dung vẫn khớp nguyên bản; bản nháp đã được sửa tay được giữ nguyên để người dùng xử lý trước khi chuẩn bị lại.

Danh sách `flowReferences` lưu theo từng dự án và được chụp vào cấu hình hàng đợi. Khi đổi profile Google, tool dùng các file cục bộ để gắn/upload trong tài khoản mới; ID ảnh Flow được kiểm tra theo URL project tương ứng. Clip đang chờ kết quả vẫn giữ nguyên bộ ảnh/prompt đã gửi, không tự gửi lại với bộ ảnh mới.

Kiểm thử: `node scripts/verify-references-ui.cjs` kiểm tra chọn nhiều ảnh, thumbnail native, mô tả, bỏ ảnh và khôi phục sau khởi động; `node scripts/verify-multiple-references.cjs` kiểm tra gắn bốn vai trò, hai kiểu xác nhận Flow, thứ tự chip, dùng lại ảnh và từ chối ảnh ngoài danh sách bằng Chrome với DOM mô phỏng. Không gửi ảnh hoặc yêu cầu tạo video lên Google trong các kiểm thử này.

## Sản xuất video tự động từ trang Kịch bản

Nút **Sản xuất video** ở trang **Kịch bản** dùng thông tin đã điền trong **Ý tưởng & thiết lập**, cấu hình độ phân giải Flow và bộ ảnh tham chiếu đã lưu để chạy lần lượt:

1. Gửi Gemini tạo toàn bộ kịch bản.
2. Tạo tất cả phân cảnh theo thứ tự kịch bản trên Flow (giữ cơ chế kiểm tra số dư/chuyển profile và tối đa 2 lần thử lại khi có thẻ lỗi).
3. Tải bản **1080p** cho mọi phân cảnh; bỏ qua cảnh đã có bản hợp lệ từ 1080p trở lên. Chưa đủ bản chất lượng cao thì chưa chạy hậu kỳ.
4. Xóa watermark từng cảnh, lưu các file đã xử lý riêng.
5. Ghép các cảnh đã xử lý thành video hoàn chỉnh, giữ nguyên luồng hình khi các clip tương thích. Có nút **Mở video hoàn chỉnh** sau khi xong.

Quy trình được lưu theo dự án trong `productionPipeline` ở workspace và bản lưu dự án, gồm trạng thái, bước hiện tại, đầu vào, mã yêu cầu Gemini, hàng đợi video, kết quả từng bước và đường dẫn phim cuối. Thanh tiến trình hiển thị 5 bước và lỗi đang gặp. Khi lỗi, bấm **Tiếp tục từ bước lỗi**: không chạy lại bước đã hoàn tất; trong bước 1080p chỉ thử lại cảnh chưa có bản chất lượng cao. Nếu lỗi ở bước ghép, dùng lại các cảnh đã xóa watermark. File nguồn giữ nguyên.

Yêu cầu Gemini có baseline và cảnh Flow đã gửi nhưng chưa rõ kết quả được đối soát/đọc lại, không tự gửi tạo mới. Mỗi lần người dùng chủ động đối soát có cửa sổ đọc tối đa 5 phút, vẫn giữ nguyên mã yêu cầu và bộ đếm thử lại Flow. Lỗi đăng nhập, mô hình chưa đúng hoặc lỗi chính sách không thể tự khắc phục: sửa trên trình duyệt rồi bấm Tiếp tục. Với lỗi upscale, nút Tiếp tục cho phép thử lại tải 1080p của cảnh đó; thao tác không tự lặp vô hạn. Đăng nhập Gemini/Flow vẫn do người dùng thực hiện trong các profile.

Nút **Tạm dừng** yêu cầu dừng sau thao tác trình duyệt đang thực hiện; hậu kỳ cục bộ đang chạy sẽ bị dừng. **Kết thúc quy trình** kết thúc trạng thái điều phối khi đã dừng, không xóa clip hoặc hủy tác vụ đã gửi tới Google. Không bắt đầu quy trình mới khi còn hàng đợi Flow hoặc yêu cầu Gemini chưa rõ kết quả. Khi đóng/mở app, quy trình bị gián đoạn được giữ ở trạng thái tạm dừng, chỉ chạy tiếp sau khi bấm Tiếp tục. Các thao tác sửa dự án/profile và chạy riêng từng bước bị khóa trong lúc quy trình tự động đang chạy.

Chất lượng vẫn theo pipeline hậu kỳ: giữ kích thước/timestamp nguồn, H.264 từ 40 Mbps khi xóa watermark, ghép không mã hóa lại hình khi tương thích. Âm thanh ghép chuẩn hóa stereo 48 kHz/192 kbps. Bộ kiểm tra MP4 cho đầu ra hậu kỳ nay đọc metadata theo khối đối với phim lớn, không còn chặn đầu ra chỉ vì vượt 512 MB; giới hạn nhập clip 512 MB vẫn giữ nguyên. Xử lý và ghép trong trình duyệt còn phụ thuộc RAM/codec và không bảo đảm tương đương từng pixel hoặc sạch watermark trên mọi cảnh.

Kiểm tra: `npm.cmd run check`, `npm.cmd test`; `node scripts/verify-pipeline.cjs [file-1080p.mp4]` chạy các runner thật với Gemini/Flow mô phỏng và MP4 1080p, cố ý làm lỗi upscale cảnh thứ hai rồi tiếp tục, kiểm tra không tạo lại kịch bản/video và xuất phim thật; `node scripts/verify-pipeline-ui.cjs [thư-mục-fixture-pipeline]` khôi phục bước ghép trong Electron, chạy ghép phim cục bộ thật và kiểm tra giao diện ở 1366/1050px. Không gửi yêu cầu tạo video hoặc dùng tín dụng Google thật trong các kiểm thử này.

### Gemini mở trang nhưng chưa nhận ô nhập

Bước gửi Gemini chờ tối đa 30 giây cho trình soạn thảo thật sự sẵn sàng, nhận cả `rich-textarea`/`ql-editor` và ô `role=textbox`, loại các bản sao bị ẩn. Tool đưa tab Gemini lên trước và chờ nút Gửi được bật sau khi điền prompt. Khi tiếp tục một bước chưa gửi, dùng cùng bộ nhận diện này để chỉ xóa bản nháp trùng nguyên văn yêu cầu do tool tạo. Nhiều ô nhập hiển thị hoặc bản nháp của người dùng vẫn khiến thao tác dừng để tránh gửi nhầm/ghi đè.

Kiểm tra không gọi Google: `node scripts/verify-gemini-composer.cjs` (Chrome, ô nhập xuất hiện trễ/không có role, bản sao ẩn, nút Gửi bật chậm, giữ bản nháp); `node scripts/verify-gemini-readiness.cjs` (Electron, quy trình tự mở Gemini, gửi đúng một lần, nhận JSON rồi chuyển sang Flow với số dư mô phỏng bằng 0).
