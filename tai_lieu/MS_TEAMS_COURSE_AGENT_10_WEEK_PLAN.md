# MS Teams Course Advisor Agent

## 1. Mục đích tài liệu

Tài liệu này là **nguồn sự thật cho Codex/AI khi tiếp tục phát triển dự án**. Nó mô tả:

- mã nguồn chatbot Microsoft Teams đang có;
- yêu cầu mở rộng của giảng viên;
- kiến trúc mục tiêu dùng **Gemini API** và ToolHub;
- dữ liệu cần lưu, KPI cần thống kê;
- lộ trình thực hiện trong 10 tuần, với một mục tiêu chính và đầu ra kiểm chứng cho mỗi tuần.

Không tự thay đổi phạm vi, nhà cung cấp LLM, hay API nguồn dữ liệu nếu chưa được người dùng yêu cầu.

---

## 2. Bối cảnh và mục tiêu sản phẩm

Xây dựng chatbot chạy trong **Microsoft Teams Web**. Bot nhận tin nhắn của người khác trong cuộc trò chuyện, tư vấn về học phần HUST dựa trên dữ liệu ToolHub, và gửi câu trả lời lại Teams.

Bot không được chỉ “đoán” bằng LLM. Với các câu hỏi về học phần, điều kiện tiên quyết, tín chỉ, nội dung môn, hoặc cây phụ thuộc, bot phải lấy dữ liệu từ **ToolHub API** trước khi tạo câu trả lời.

### Mục tiêu cuối cùng

1. Người dùng có thể hỏi tự nhiên bằng tiếng Việt, ví dụ:
   - `IT3030 học gì?`
   - `Điều kiện học IT4735 là gì?`
   - `Môn nào cần học trước Hệ nhúng?`
   - `Vẽ cây phụ thuộc của IT3030.`
2. Agent nhận diện ý định, gọi ToolHub đúng endpoint và trả lời có căn cứ.
3. Toàn bộ lượt tương tác được lưu theo người dùng Teams hoặc anonymous session.
4. Mỗi lượt lưu được prompt/answer, lần gọi tool, token Gemini, thời gian xử lý và trạng thái thành công/lỗi.
5. Có API/dashboard KPI để theo dõi mức sử dụng và chất lượng vận hành.

### Không thuộc phạm vi ban đầu

- Không crawl SIS, không tự vận hành Graphviz/CourseDependency.
- Không yêu cầu RAG/vector database trước khi hoàn thành ToolHub Agent.
- Không tự đăng nhập hay thu mật khẩu HUST/SIS của người dùng.
- Không hứa hẹn dữ liệu học phần ngoài dữ liệu trả về từ ToolHub.

---

## 3. Trạng thái mã nguồn hiện tại

Repository hiện tại: `MSTeam_Chatbot-main`.

### Công nghệ hiện có

| Thành phần | Hiện tại |
|---|---|
| Ngôn ngữ/runtime | Node.js + TypeScript |
| API server | Express |
| Kênh chat | Microsoft Teams Web |
| Tự động hóa Teams | Selenium WebDriver + Chrome |
| CSDL | PostgreSQL (`pg`) |
| Memory | bảng `messages` theo `user_id` |
| LLM | **Gemini API** — người dùng đã đổi từ OpenRouter sang Gemini |

### Cấu trúc hiện tại

```text
MSTeam_Chatbot-main/
├── scripts/teamsBot.ts            # Đọc/gửi tin nhắn Teams bằng Selenium
├── src/
│   ├── index.ts                   # Express app, POST /chat
│   ├── bot/handler.ts             # Validate body và gọi AI service
│   ├── services/openai.ts         # Service AI cũ; phải thay bằng Gemini
│   ├── memory/dbMemory.ts         # Đọc/lưu 10 message gần nhất
│   └── db/index.ts                # PostgreSQL Pool
├── rag/                           # Chưa hoàn thiện, không sử dụng trong pha đầu
└── README.md
```

### Luồng hiện tại thực tế

```mermaid
flowchart LR
    U["Người dùng Teams"] --> T["Teams Web"]
    T --> S["Selenium: teamsBot.ts"]
    S --> A["getAIResponse()"]
    A --> G["Gemini API"]
    A --> D[("PostgreSQL messages")]
    G --> A
    A --> S
    S --> T
```

`POST /chat` đang tồn tại để test độc lập, nhưng `scripts/teamsBot.ts` hiện gọi service AI trực tiếp, không gọi Express API. Khi phát triển Agent, phải chuyển logic điều phối về API/service dùng chung để tránh có hai luồng xử lý khác nhau.

### Vấn đề kỹ thuật đã biết

- Tên file là `src/services/openai.ts` và import là `openAI`; cần đổi tên nhất quán khi thay bằng Gemini. Linux phân biệt hoa/thường.
- PostgreSQL đang hard-code host, user, database và port; cần chuyển hết sang biến môi trường.
- `lastMessage` chỉ chống trùng dựa trên nội dung text; không đủ khi hai người gửi cùng một câu hoặc người dùng gửi lại cùng câu.
- `senderId` đang lấy theo tên hiển thị Teams; cần ưu tiên ID ổn định nếu DOM Teams cung cấp, hoặc tạo session key có kiểm soát.
- Selenium selector có thể hỏng nếu Teams đổi DOM. Mọi selector phải được gom vào một module và có log lỗi rõ ràng.
- RAG hiện có `data.json`, `ingest.ts` rỗng và không được tích hợp. Không sửa RAG trước khi ToolHub Agent hoạt động.

---

## 4. Yêu cầu giảng viên đã xác định

1. Chatbot Teams kết nối dữ liệu học phần và tư vấn về môn học.
2. Dùng ToolHub API để tìm thông tin và vẽ cây học phần phụ thuộc.
3. Có cơ chế **Agent Proxy** giữa Teams và Gemini/ToolHub.
4. Lưu toàn bộ prompt và answer theo `user` hoặc `anonymous`.
5. Ghi nhận giới hạn token, mức sử dụng và KPI dựa trên prompt/tương tác.
6. Repo `CourseDependency` là tài liệu tham chiếu cho ý nghĩa quan hệ phụ thuộc (AND/OR) và cây môn học, không phải dependency bắt buộc phải nhúng vào dự án.

---

## 5. Dữ liệu và ToolHub API

Base URL:

```text
https://api.toolhub.app
```

### Endpoint bắt buộc

| Agent tool | HTTP | Endpoint | Khi dùng |
|---|---|---|---|
| `search_courses` | GET | `/hust/HocPhan?search={query}` | Hỏi tên/mã môn, tín chỉ, nội dung, mục tiêu, điều kiện |
| `course_dependency_tree` | GET | `/hust/hocphan/{courseCode}?type=svg` | Hỏi cây phụ thuộc của một môn |
| `assumed_dependency_tree` | GET | `/hust/hocphan2/{courseCode}?dkgiadinh={condition}&type=svg` | Chỉ dùng khi người dùng yêu cầu thử điều kiện giả định |
| `group_dependency_tree` | POST | `/hust/nhomhocphan?type=svg` | Vẽ cây cho nhiều mã môn; body là `text/plain` |

### Dữ liệu cần ưu tiên từ `search_courses`

API trả về mảng phần tử có dạng `item.row`. Các trường hữu ích gồm:

- `Mã học phần`
- `Tên học phần`
- `Số tín chỉ`
- `TC học phí`
- `Thời lượng`
- `Viện Quản lý`
- `Học phần điều kiện`
- `Mục tiêu`
- `Nội dung`
- `Tên tiếng anh`

Một truy vấn có thể trả nhiều môn gần giống nhau, ví dụ `IT3030`, `BIT3030`, `IT3030E`. Agent **không được tự chọn bừa**. Nếu không có đúng một mã trùng tuyệt đối hoặc người dùng chưa nêu rõ mã, trả lời ngắn gọn với các lựa chọn và hỏi lại.

### Quy tắc diễn giải điều kiện học phần

Theo quy ước của dữ liệu tham chiếu:

- Dấu phẩy `,`: cần đồng thời các điều kiện (**AND**).
- Dấu gạch chéo `/`: các môn thay thế, chỉ cần một nhánh (**OR**).
- Ngoặc `()`: nhóm điều kiện.

Agent được phép giải thích bằng tiếng Việt dễ hiểu, nhưng không được tự suy diễn môn nào đã học hay chưa học nếu người dùng không cung cấp thông tin đó.

---

## 6. Kiến trúc mục tiêu: Agent Proxy

```mermaid
flowchart LR
    T["Teams Web"] --> S["Selenium Adapter"]
    S --> P["POST /ai/reply"]
    P --> I["Intent Router"]
    I -->|"Câu hỏi học phần"| H["ToolHub Client"]
    I -->|"Câu hỏi chung"| G["Gemini Client"]
    H --> G
    G --> L[("PostgreSQL: logs, memory, KPI")]
    G --> P
    P --> S
```

### Trách nhiệm từng lớp

| Lớp | Trách nhiệm | Không được làm |
|---|---|---|
| Selenium Adapter | Lấy tin của người khác, lấy định danh, gọi API nội bộ, gửi reply | Không xây prompt, không gọi Gemini/ToolHub trực tiếp |
| Agent Controller | Validate input, tạo request ID, điều phối service, trả JSON | Không chứa selector Teams |
| Intent Router | Nhận diện câu hỏi học phần/cây phụ thuộc/chung | Không trả lời bằng dữ liệu tưởng tượng |
| ToolHub Client | Gọi timeout, validate HTTP, rút gọn dữ liệu tool | Không dùng dữ liệu ToolHub làm lệnh thực thi |
| Gemini Client | Gọi Gemini, đọc usage, xử lý timeout/lỗi | Không ghi API key vào log |
| Persistence | Lưu memory, audit log, KPI | Không làm mất log vì lỗi thống kê |

### Luồng xử lý một message

1. Selenium nhận message mới của người khác, có `userKey`, `messageId`, `text`.
2. Gọi `POST /ai/reply` với `source: "teams"`.
3. API loại duplicate bằng `messageId`; nếu không có messageId, dùng hash của `conversation + sender + text + time bucket`.
4. Intent Router xác định có phải truy vấn học phần hay không.
5. Nếu có, ToolHub Client gọi endpoint phù hợp và rút gọn kết quả.
6. Tạo prompt Gemini gồm system instruction, history tối thiểu, câu hỏi, dữ liệu ToolHub. Không đưa API key vào prompt/log.
7. Gemini tạo câu trả lời bằng tiếng Việt, nêu rõ khi không tìm được dữ liệu.
8. Lưu interaction log bất kể thành công hay lỗi; lưu usage tokens nếu Gemini trả về.
9. API trả `reply`, `requestId`, `toolUsed`, `courseLinks` cho Selenium.
10. Selenium gửi reply; với yêu cầu cây, gửi kèm URL SVG hoặc một tin thứ hai chứa link.

---

## 7. Gemini: cấu hình và quy tắc

### Biến môi trường

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME
GEMINI_API_KEY=replace_me
GEMINI_MODEL=configure_the_selected_model
TOOLHUB_BASE_URL=https://api.toolhub.app
AGENT_MAX_OUTPUT_TOKENS=600
AGENT_DAILY_TOKEN_LIMIT_PER_USER=20000
```

- Chỉ dùng `GEMINI_API_KEY`. Không giữ hay đọc `OPENROUTER_API_KEY` trong logic mới.
- Không commit `.env`.
- Model Gemini phải lấy từ `GEMINI_MODEL`, không hard-code vào nhiều file.
- Chỉ log tên model và metadata an toàn, không log secret, header Authorization hay raw environment variables.

### System instruction đề xuất

```text
Bạn là trợ lý tư vấn học phần HUST trên Microsoft Teams.
Với câu hỏi về học phần, chỉ sử dụng dữ liệu ToolHub được cung cấp trong ngữ cảnh.
Nếu kết quả mơ hồ hoặc không có dữ liệu, nói rõ điều đó và hỏi lại; không bịa.
Giải thích điều kiện tiên quyết ngắn gọn: dấu phẩy là cần đồng thời, dấu / là lựa chọn thay thế.
Trả lời bằng tiếng Việt, ngắn gọn, dễ đọc trên Teams.
Không yêu cầu hoặc xử lý mật khẩu HUST/SIS.
```

### Kiểm soát token

- Giới hạn history: 6–10 messages gần nhất hoặc số token cấu hình, không chỉ giới hạn số bản ghi một cách mù quáng.
- ToolHub search: chỉ chọn tối đa 5 kết quả liên quan; chỉ gửi các trường cần cho câu hỏi.
- Truncate `Mục tiêu`/`Nội dung` dài trước khi đưa vào Gemini.
- Với mỗi user/session, kiểm tra tổng token trong ngày trước khi gọi Gemini. Nếu vượt ngưỡng, trả thông báo lịch sự và vẫn có thể trả dữ liệu ToolHub ngắn gọn nếu không cần Gemini.

---

## 8. Database và KPI

Giữ bảng `messages` để memory tương thích ngược, nhưng thêm các bảng dưới đây qua migration SQL.

### Bảng đề xuất

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,                  -- teams | api
  user_key TEXT NOT NULL,                -- stable Teams ID hoặc anonymous UUID
  identity_type TEXT NOT NULL,           -- teams | anonymous
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, user_key)
);

CREATE TABLE chat_interactions (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  conversation_id UUID REFERENCES conversations(id),
  source_message_id TEXT,
  user_message TEXT NOT NULL,
  final_prompt JSONB,                    -- messages cuối cùng gửi Gemini, không có secret
  tool_name TEXT,                        -- search_courses | course_dependency_tree | none
  tool_request JSONB,
  tool_response_summary JSONB,           -- response đã rút gọn, không lưu binary SVG/png
  assistant_answer TEXT,
  model_name TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  status TEXT NOT NULL,                  -- success | tool_error | model_error | rate_limited
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_conversation_created
  ON chat_interactions(conversation_id, created_at DESC);
CREATE INDEX idx_interactions_created ON chat_interactions(created_at DESC);
```

### KPI tối thiểu

| KPI | Cách tính | Mục đích |
|---|---|---|
| Tổng lượt tương tác | `count(chat_interactions)` | Mức sử dụng |
| Người dùng duy nhất | distinct `conversation_id` | Mức tiếp cận |
| Tỷ lệ ToolHub thành công | success tool calls / total tool calls | Độ tin cậy nguồn dữ liệu |
| Tỷ lệ trả lời thành công | status = success / tổng lượt | Độ ổn định Agent |
| Tổng / trung bình token | sum / avg `total_tokens` | Kiểm soát quota/chi phí |
| P50/P95 latency | percentile `latency_ms` | Trải nghiệm Teams |
| Tỷ lệ câu hỏi học phần | tool_name != none / tổng lượt | Đánh giá đúng phạm vi |

### API quản trị tối thiểu

```text
GET /health
POST /ai/reply
GET /admin/kpi?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /admin/interactions?limit=50&status=success
```

`/admin/*` phải được bảo vệ trước khi deploy ngoài máy local. Trong demo local có thể dùng `ADMIN_API_KEY` header; không mở công khai không xác thực.

---

## 9. Hành vi mong đợi và acceptance criteria

### Ví dụ 1 — hỏi điều kiện môn

**Input:** `Điều kiện để học IT4735 là gì?`

**Yêu cầu:** Agent gọi `search_courses` hoặc endpoint cây cho `IT4735`, sau đó diễn đạt điều kiện theo dữ liệu ToolHub. Interaction log có `tool_name`, token, latency, status.

### Ví dụ 2 — hỏi mơ hồ

**Input:** `Kiến trúc máy tính học gì?`

**Yêu cầu:** Nếu ToolHub trả nhiều môn có tên gần giống, bot liệt kê tối đa 3 mã môn nổi bật và hỏi người dùng muốn mã nào. Không tự chọn `IT3030` nếu chưa đủ rõ.

### Ví dụ 3 — yêu cầu cây

**Input:** `Vẽ cây phụ thuộc IT3030`

**Yêu cầu:** Bot trả link `https://api.toolhub.app/hust/hocphan/IT3030?type=svg`, nói đây là cây phụ thuộc, và ghi log `course_dependency_tree`.

### Ví dụ 4 — câu hỏi ngoài phạm vi học phần

**Input:** `Giải thích REST API là gì?`

**Yêu cầu:** Không gọi ToolHub, gọi Gemini bình thường, `tool_name = none`.

### Ví dụ 5 — hết quota cá nhân

**Input:** User vượt `AGENT_DAILY_TOKEN_LIMIT_PER_USER`.

**Yêu cầu:** Không gọi Gemini; ghi `status = rate_limited`; trả thông báo ngắn, không làm bot crash.

---

## 10. Kế hoạch 10 tuần

Mỗi tuần chỉ có **một mục tiêu chính**. Không chuyển sang tuần sau nếu đầu ra của tuần hiện tại chưa kiểm chứng được.

| Tuần | Mục tiêu chính | Công việc cần thực hiện | Kết quả cần đạt / cách kiểm chứng |
|---|---|---|---|
| 1 | Ổn định nền tảng và chuẩn hóa cấu hình | Đổi service AI cũ sang Gemini; sửa tên import/file nhất quán; dùng `.env`; cấu hình `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`; thêm `/health`. | `npm run build` không lỗi; `GET /health` trả DB/API config status an toàn; gọi test Gemini thành công bằng API local. |
| 2 | Chuẩn hóa Agent Proxy API | Tạo `POST /ai/reply`; chuyển Selenium gọi API này thay vì import AI service trực tiếp; thêm schema request/response, request ID, error handler. | Postman/curl gửi message nhận JSON có `reply`, `requestId`; Teams bot dùng đúng endpoint và vẫn gửi được reply. |
| 3 | Tích hợp ToolHub tìm kiếm môn | Tạo `toolhubClient`; implement `search_courses`; timeout/retry hợp lý; parse/normalize `item.row`; test IT3030 và tìm theo tên. | API trả dữ liệu môn có mã, tên, tín chỉ, điều kiện; lỗi ToolHub không làm server chết. |
| 4 | Xây Intent Router | Nhận diện: `course_search`, `course_dependency_tree`, `course_group_tree`, `general`; xử lý mã môn và case mơ hồ; prompt Gemini chỉ dùng ToolHub data với câu hỏi học phần. | Có test cho 5 ví dụ ở mục 9; câu hỏi mơ hồ hỏi lại thay vì bịa; câu hỏi REST không gọi ToolHub. |
| 5 | Cây học phần trên Teams | Tích hợp endpoint một môn/nhóm môn; tạo link SVG an toàn; định dạng reply Teams ngắn; test OR/AND và lỗi 404. | Message “vẽ cây IT3030” trả link SVG hoạt động; message nhiều mã dùng `POST /hust/nhomhocphan`; logs hiển thị tool đúng. |
| 6 | Thiết kế lưu vết và migration | Tạo migration `conversations`, `chat_interactions`; xác định `user_key`/anonymous UUID; chống duplicate bằng message ID/hash; giữ `messages` cho memory. | Một lượt chat tạo đúng một interaction và message memory; chạy lại cùng source message không tạo reply/log trùng. |
| 7 | Prompt log, token và quota | Lưu final prompt, tool summary, answer, model, usage tokens, latency; triển khai limit token/ngày theo user; không log API key. | Database có token và latency sau mỗi gọi Gemini; test user vượt quota tạo `rate_limited`; review log không có secret. |
| 8 | KPI và API quản trị | Implement truy vấn KPI ngày/khoảng ngày, danh sách interactions, thống kê success/tool/latency/token; bảo vệ `/admin` bằng API key local. | `GET /admin/kpi` trả đúng các KPI mục 8 từ dữ liệu test; API không truy cập được khi thiếu admin key. |
| 9 | Kiểm thử end-to-end và độ bền | Viết unit/integration tests cho ToolHub Client, intent, quota, DB log; kiểm tra Selenium message người khác, reconnect/error, selector; chạy test case thật trên Teams. | Test suite pass; bot xử lý tối thiểu 10 câu hỏi liên tiếp không duplicate; có biên bản test gồm input, output, log status. |
| 10 | Hoàn thiện demo và bàn giao | Chốt README, `.env.example`, DB migration, kiến trúc, hướng dẫn run/demo; quay/chụp minh chứng; rà soát bảo mật/secret; chuẩn bị slide/demo script. | Clone mới có thể cài, migrate, cấu hình và chạy theo README; demo đầy đủ Teams → ToolHub → Gemini → PostgreSQL KPI; không có API key trong Git. |

---

## 11. Đề xuất cấu trúc sau khi refactor

```text
src/
├── app.ts
├── server.ts
├── config/env.ts
├── api/
│   ├── ai.routes.ts
│   ├── admin.routes.ts
│   └── health.routes.ts
├── agent/
│   ├── courseAgent.ts
│   ├── intentRouter.ts
│   ├── promptBuilder.ts
│   └── types.ts
├── services/
│   ├── geminiClient.ts
│   └── toolhubClient.ts
├── repositories/
│   ├── conversationRepository.ts
│   └── interactionRepository.ts
├── db/
│   ├── pool.ts
│   └── migrations/
├── middleware/
│   ├── errorHandler.ts
│   └── adminAuth.ts
└── utils/
    ├── logger.ts
    ├── tokenBudget.ts
    └── deduplication.ts
scripts/
└── teamsBot.ts
tests/
```

---

## 12. Quy tắc triển khai bắt buộc cho Codex

1. Đọc tài liệu này trước khi sửa code.
2. Không tự đổi Gemini sang OpenRouter/OpenAI hay thêm RAG nếu không được yêu cầu.
3. Không gọi ToolHub cho câu hỏi không liên quan học phần.
4. Khi ToolHub lỗi, trả lời minh bạch rằng chưa lấy được dữ liệu; không thay bằng dữ liệu LLM suy đoán.
5. Không commit `.env`, Gemini key, DB password, hoặc raw Authorization header.
6. Không sử dụng endpoint ToolHub liên quan tới mật khẩu HUST/SIS.
7. Không chạy/nhúng trực tiếp `CourseDependency` vào production API; coi đó là tài liệu tham khảo.
8. Mọi thay đổi schema phải có migration và hướng dẫn rollback/upgrade.
9. Mọi feature mới phải có một cách kiểm chứng cụ thể trước khi đánh dấu hoàn thành.
10. Ưu tiên câu trả lời ngắn gọn, tiếng Việt, phù hợp khung chat Microsoft Teams.

---

## 13. Definition of Done của dự án

Dự án chỉ được xem là hoàn thành khi đạt đồng thời:

- Bot Teams nhận và trả lời được tin nhắn của người khác mà không tự loop.
- Câu hỏi học phần dùng ToolHub thật và không bịa thông tin khi ToolHub không trả dữ liệu.
- Cây phụ thuộc một môn và nhóm môn được gửi dưới dạng link hợp lệ.
- Gemini được gọi qua Agent Proxy, có timeout/error handling/quota token.
- Prompt, answer, tool usage, tokens, latency và trạng thái được lưu theo user/anonymous.
- KPI truy vấn được qua API quản trị.
- Build/test chính chạy thành công, README đủ để người khác chạy demo từ đầu.
- Repository không chứa secret.
