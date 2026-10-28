# Tuần 4 — Intent Router

## Phạm vi đã triển khai

`POST /ai/reply` bây giờ phân loại tin nhắn trước khi gọi dịch vụ ngoài:

| Intent | Điều kiện nhận diện | Hành vi ở Tuần 4 |
| --- | --- | --- |
| `course_search` | Có mã môn hoặc hỏi về học phần, điều kiện, tín chỉ, nội dung, mục tiêu | Gọi ToolHub `search_courses`. Chỉ gọi Gemini khi có đúng một mã môn trùng khớp. |
| `course_dependency_tree` | Yêu cầu cây phụ thuộc của một mã môn | Nhận diện và trả về intent; việc lấy/gửi link SVG để Tuần 5 thực hiện. |
| `course_group_tree` | Yêu cầu cây với nhiều mã môn/nhóm môn | Nhận diện và trả về intent; việc gọi endpoint nhóm để Tuần 5 thực hiện. |
| `general` | Các câu hỏi khác, ví dụ REST API | Không gọi ToolHub; chuyển thẳng sang Gemini. |

Với tìm kiếm theo **tên** hoặc khi ToolHub không có đúng một mã trùng khớp, bot đưa tối đa ba lựa chọn và hỏi lại mã môn. Nó không tự chọn một môn. Khi ToolHub lỗi, bot thông báo minh bạch và không thay bằng câu trả lời suy đoán từ Gemini.

API success có thêm hai trường để dễ quan sát trong giai đoạn này:

```json
{
  "reply": "...",
  "requestId": "...",
  "intent": "course_search",
  "toolUsed": "search_courses"
}
```

## Cài đặt và chạy

```powershell
npm install
Copy-Item .env-example .env
```

Điền tối thiểu `GEMINI_API_KEY` vào `.env`; giữ `TOOLHUB_BASE_URL` như mẫu. Để lưu memory, PostgreSQL cần có bảng sau (nếu chưa có):

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Chạy API:

```powershell
npm run dev
```

Mở PowerShell khác để chạy bot Teams (đăng nhập và mở đúng cuộc trò chuyện khi Chrome xuất hiện):

```powershell
npm run bot
```

## Kiểm tra tự động

```powershell
npm test
```

Test bao gồm ToolHub của Tuần 3 và các tình huống Tuần 4: mã môn rõ ràng, tên môn mơ hồ, cây một/nhiều môn và câu hỏi REST không gọi ToolHub.

## Kiểm tra thủ công API

Khi API đang chạy, dùng các lệnh sau trong PowerShell:

```powershell
$body = @{ source = "api"; userKey = "manual-test"; text = "Điều kiện để học IT4735 là gì?" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/ai/reply -ContentType "application/json" -Body $body
```

Thử thay `text` bằng các câu sau và quan sát `intent`, `toolUsed`:

| Tin nhắn | Khác biệt mong đợi ở Tuần 4 |
| --- | --- |
| `Kiến trúc máy tính học gì?` | `course_search`, `search_courses`; bot liệt kê tối đa 3 lựa chọn và hỏi mã môn, không gọi Gemini để đoán. |
| `Điều kiện để học IT4735 là gì?` | `course_search`, `search_courses`; Gemini chỉ nhận dữ liệu ToolHub của IT4735. |
| `Giải thích REST API là gì?` | `general`, `none`; không có lượt gọi ToolHub. |
| `Vẽ cây phụ thuộc IT3030` | `course_dependency_tree`, `none`; đã nhận diện nhưng link SVG là phạm vi Tuần 5. |
| `Vẽ cây phụ thuộc IT3030 và IT4735` | `course_group_tree`, `none`; endpoint nhóm môn là phạm vi Tuần 5. |

Nếu chỉ muốn kiểm tra ToolHub mà không cần Gemini/PostgreSQL:

```powershell
npm run toolhub:search -- IT3030
npm run toolhub:search -- "Kiến trúc máy tính"
```
