# Tuần 3 — ToolHub Course Search

`ToolHubClient` là lớp duy nhất gọi ToolHub trong tuần này. Nó chưa được nối vào
`POST /ai/reply`; Intent Router của Tuần 4 sẽ quyết định lúc nào dùng nó.

## Cấu hình

Sao chép `.env-example` thành `.env`, sau đó giữ hoặc điều chỉnh các biến sau:

```env
TOOLHUB_BASE_URL=https://api.toolhub.app
TOOLHUB_TIMEOUT_MS=8000
TOOLHUB_RETRY_COUNT=1
```

## Kiểm chứng

```powershell
npm run test:toolhub
npm run toolhub:search -- IT3030
npm run toolhub:search -- "Kiến trúc máy tính"
```

Lệnh tìm kiếm in danh sách đã chuẩn hoá. Một kết quả có thể có `null` ở trường
ToolHub không cung cấp; client không tự bịa dữ liệu.

Timeout, lỗi mạng, HTTP 429 và 5xx được thử lại tối đa theo
`TOOLHUB_RETRY_COUNT`. Các lỗi khác trả về `ToolHubError` có mã an toàn để tầng
Intent Router xử lý ở Tuần 4.
