# Sidebar điều khiển trả lời tự động

Control Panel mở trong **một tab thứ hai** của cùng cửa sổ Chrome với Teams. Nó không là Chrome extension và không tạo cửa sổ Chrome thứ hai.

## Hành vi

- **Bật bot trả lời**: Selenium gọi `POST /ai/reply` và gửi câu trả lời của Agent vào Teams như trước.
- **Dừng bot trả lời**: Selenium không gọi Gemini/ToolHub, không gửi phản hồi tự động. Tin nhắn đến được lưu trong bảng `messages` với `role = 'user'`.
- Khi đang dừng, tin nhắn do người thật gửi từ tài khoản Teams đang chạy Selenium được lưu với `role = 'assistant'`. Nhờ vậy lịch sử chứa cả câu hỏi lẫn phản hồi thủ công để dùng làm memory sau này.

Bot chỉ theo dõi một cuộc chat đang mở trong Teams, như hành vi trước đây. Phản hồi thủ công được gắn với người gửi của tin nhắn ngoài gần nhất trong cuộc chat đó.

## Cách hoạt động

Khi chạy `npm run bot`, Selenium mở Teams ở tab đầu và `CONTROL_PANEL_URL` ở tab kế bên, rồi tự chuyển lại tab Teams để bot tiếp tục hoạt động. Bạn có thể chuyển tab Control Panel bất cứ lúc nào để dừng/bật bot.

Local mặc định dùng `http://localhost:3000/sidebar/`; khi deploy, đặt `CONTROL_PANEL_URL` về domain deploy.

## Chạy và sử dụng

1. Chạy migration một lần để trạng thái dừng/bật tồn tại sau khi API restart:

   ```powershell
   npm run db:migrate:bot-control
   ```

2. Thêm vào `.env` để cấu hình phiên bot local:

   ```env
   TEAMS_AUTO_REPLY=true
   BOT_INSTANCE_ID=teams-local
   ```

   Dùng `false` nếu muốn bot luôn khởi động ở trạng thái dừng. `BOT_INSTANCE_ID` tách trạng thái khi chạy nhiều bot/VM.

3. Chạy API và Selenium bot ở hai PowerShell riêng:

   ```powershell
   npm run dev
   npm run bot
   ```

4. Chỉ một cửa sổ Chrome mở ra với hai tab: Teams và Control Panel. Chuyển sang tab Control Panel và chọn **Dừng bot trả lời**.
5. Sidebar chuyển sang trạng thái manual; người thật có thể trả lời trong Teams.
6. Chọn **Bật bot trả lời** khi muốn trao quyền lại cho bot.

## Kiểm tra thủ công

1. Mở sidebar, nhấn **Dừng bot trả lời** và kiểm tra trạng thái hiện `Bot đang tạm dừng`.
2. Gửi một tin nhắn từ người còn lại trong Teams. Bot không gửi câu trả lời và console có `Manual-mode Teams message recorded`.
3. Gửi một phản hồi thủ công từ tài khoản đang chạy bot. Console có `Manual Teams reply recorded`.
4. Kiểm tra PostgreSQL:

   ```sql
   SELECT user_id, role, content, created_at
   FROM messages
   ORDER BY created_at DESC
   LIMIT 20;
   ```

   Hai tin nhắn phải xuất hiện theo thứ tự `user` rồi `assistant`.
5. Nhấn **Bật bot trả lời**, gửi tin nhắn mới; bot phải trả lời lại như trước.

## Deploy

Selenium vẫn cần chạy trên máy local hoặc một VM giữ phiên đăng nhập Teams. Tuy nhiên API, PostgreSQL và control panel có thể deploy độc lập. Trên máy chạy Selenium, trỏ hai biến về domain deploy:

```env
AGENT_API_BASE_URL=https://bot.example.edu.vn
CONTROL_PANEL_URL=https://bot.example.edu.vn/sidebar/
BOT_INSTANCE_ID=worker-01
```

State được lưu theo `BOT_INSTANCE_ID` trong PostgreSQL; cùng một instance sẽ giữ trạng thái sau khi API restart.

## Lưu ý vận hành

- Trang điều khiển không có xác thực; chỉ dùng trên máy local hoặc mạng tin cậy. Không public cổng API ra Internet trước khi bổ sung bảo vệ cho endpoint `/bot-control/*`.
