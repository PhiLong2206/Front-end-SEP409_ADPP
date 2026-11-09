# ADPP – TÀI LIỆU KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

**Dự án:** AI Debate Practice Platform (ADPP) – Nền tảng Luyện tập Tranh biện ứng dụng Trí tuệ Nhân tạo  
**Mã đề tài:** SEP409 – KLTN Kì 9 FPT University  
**Ngày cập nhật:** 09/11/2026

---

## 1. TỔNG QUAN KIẾN TRÚC (ARCHITECTURE OVERVIEW)

Hệ thống **ADPP** được thiết kế theo mô hình **Microservices kết hợp API Gateway**, tách biệt rõ ràng giữa:
1. **Frontend SPA (React 19 + TypeScript + Vite):** Đảm nhiệm trải nghiệm người dùng theo thời gian thực cho 4 vai trò (Debater, Organizer, Judge, Admin).
2. **API Gateway (.NET 8 YARP):** Điểm tiếp nhận tập trung (Single Point of Entry), điều phối luồng request tới các dịch vụ phía sau.
3. **Core System Service (.NET 8 Clean Architecture - 3-Tier):** Xử lý nghiệp vụ lõi có tính toàn vẹn giao dịch cao (Tài khoản, Giải đấu, Trận đấu, Phòng tranh biện, Ví & Thanh toán PayOS).
4. **AI Microservices (Python FastAPI):** Tách rời 2 dịch vụ chuyên biệt gồm **AI Opponent** (Đối thủ tranh biện tự động) và **AI Evaluator** (Chấm điểm, phân tích lập luận & phát hiện ngụy biện).

---

## 2. SƠ ĐỒ KIẾN TRÚC TỔNG THỂ (HIGH-LEVEL SYSTEM ARCHITECTURE)

![Sơ đồ Kiến trúc Hệ thống ADPP](./adpp-system-architecture.svg)

```mermaid
flowchart TD
    subgraph ClientTier["1. CLIENT TIER (Frontend - React 19 + TypeScript + Vite - Port 5173)"]
        UI_Debater["Debater / Learner Space (AI 1v1, P2P 1v1/2v2, PayOS)"]
        UI_Organizer["Organizer Space (Quản lý giải đấu, Bracket, Giám sát)"]
        UI_Judge["Judge Space (Chấm điểm đa tiêu chí, AI Suggestion)"]
        UI_Admin["Admin Space (Quản lý người dùng, Chủ đề, Doanh thu)"]
    end

    subgraph GatewayTier["2. API GATEWAY TIER (.NET 8 YARP Reverse Proxy - Port 5000)"]
        YARP["YARP API Gateway (JWT Verification, Routing, CORS)"]
    end

    subgraph BackendTier["3. BACKEND SERVICES TIER"]
        subgraph SystemServiceApp["SystemService (.NET 8 Web API - Port 5001)"]
            AuthModule["Identity & Auth Module (JWT, Google OAuth, OTP)"]
            DebateEngine["Debate Engine (Sessions, Turns, Timers, Transcript)"]
            CompEngine["Competition Engine (Lifecycle, Registrations, Bracket, Matches)"]
            PaymentEngine["Payment & Wallet Engine (PayOS SDK, Balance, Packages)"]
            TopicEngine["Topic Management (Motions, Categories, Materials)"]
        end

        subgraph AiServicesApp["AI Microservices (Python 3.11 + FastAPI)"]
            AIOpponent["AI Opponent Service (Port 8002 - Sinh lập luận & phản biện)"]
            AIEvaluator["AI Evaluator Service (Port 8000 - Chấm điểm & phát hiện ngụy biện)"]
        end
    end

    subgraph DataTier["4. DATA TIER (Databases & Storage)"]
        SQLServer[("MS SQL Server (DebatePracticePlatformDB)")]
        Postgres[("PostgreSQL Docker Port 5433 (adpp-ai-generation-postgres)")]
    end

    subgraph ExternalTier["5. EXTERNAL SERVICES TIER"]
        PayOS["PayOS Gateway (VietQR Checkout & Webhook)"]
        GoogleOAuth["Google Identity (OAuth 2.0 Single Sign-On)"]
        GmailSMTP["Google SMTP (Gửi OTP & Thông báo)"]
        LLMProviders["AI LLM Engines (Google Gemini, OpenAI GPT-4o, Claude)"]
    end

    %% REQUEST & RESPONSE CONNECTIONS
    ClientTier -->|"Request: HTTPS REST + Bearer JWT"| YARP
    YARP -.->|"Response: ApiResponse<T> JSON"| ClientTier

    YARP -->|"Request: /api/auth, /debate, /competitions"| SystemServiceApp
    SystemServiceApp -.->|"Response: DTO JSON (Session, Bracket, Token)"| YARP

    YARP -->|"Request: /api/opponent/* (Motion, Argument)"| AIOpponent
    AIOpponent -.->|"Response: TurnResponse (AI Counter-Speech)"| YARP

    YARP -->|"Request: /api/evaluate/* (Transcript)"| AIEvaluator
    AIEvaluator -.->|"Response: EvaluationResult (Scores, Fallacies)"| YARP

    SystemServiceApp -->|"Request: EF Core SQL Query / Command"| SQLServer
    SQLServer -.->|"Response: Entity Records & Commit Status"| SystemServiceApp

    AIOpponent -->|"Request: Save Turn & Context"| Postgres
    Postgres -.->|"Response: Session History & Case Plan"| AIOpponent

    AIEvaluator -->|"Request: Read / Write Score Cache"| Postgres
    Postgres -.->|"Response: Cached Evaluation Data"| AIEvaluator

    SystemServiceApp -->|"Request: Create Payment Link"| PayOS
    PayOS -.->|"Response: CheckoutUrl & Webhook PAID"| SystemServiceApp

    SystemServiceApp -->|"Request: Verify ID Token"| GoogleOAuth
    GoogleOAuth -.->|"Response: User Claims & Email"| SystemServiceApp

    SystemServiceApp -->|"Request: Send OTP Mail"| GmailSMTP
    GmailSMTP -.->|"Response: 250 OK Delivery"| SystemServiceApp

    AIOpponent -->|"Request: Prompt + Debate Context"| LLMProviders
    LLMProviders -.->|"Response: Generated Counter-Argument"| AIOpponent

    AIEvaluator -->|"Request: Transcript + Rubric Prompt"| LLMProviders
    LLMProviders -.->|"Response: Structured Score & Coaching JSON"| AIEvaluator
```

---

## 3. KIẾN TRÚC PHÂN TẦNG NỘI BỘ (INTERNAL LAYER ARCHITECTURE)

### 3.1. Kiến trúc Frontend (`d:\Kì_9_FPT\KLTN\Front-end-ADPP\src`)
```mermaid
flowchart LR
    Pages["Pages & Views<br/>(Debater / Organizer / Admin / Public)"] --> Components["Domain Components<br/>(Debate / Competition / Common / Layout)"]
    Pages --> Hooks["Custom Hooks<br/>(useAuth, useDebateNavigationGuard)"]
    Components --> Context["React Contexts<br/>(AuthContext, ThemeContext)"]
    Pages --> APILayer["API Services Layer<br/>(authApi, debateApi, competitionApi, aiApi, paymentApi)"]
    APILayer --> AxiosClient["Axios Interceptors<br/>(JWT Bearer Injection & Refresh Queue)"]
```

### 3.2. Kiến trúc Backend SystemService (`SEP409-AI-DEBATE/Services`)
```mermaid
flowchart LR
    Controllers["Presentation Layer<br/>SystemService (Controllers)<br/>• CompetitionsController<br/>• DebateController<br/>• AuthController<br/>• PaymentController"] --> BLL["Business Logic Layer<br/>SystemService.BLL (Services)<br/>• CompetitionService<br/>• DebateSessionService<br/>• AuthService<br/>• PayOsService"]
    BLL --> DAL["Data Access Layer<br/>SystemService.DAL (Repositories & EF Core)<br/>•DbContext<br/>• Entities & Migrations"]
    DAL --> DB[("MS SQL Server<br/>DebatePracticePlatformDB")]
```

---

## 4. SƠ ĐỒ TUẦN TỰ CÁC LUỒNG NGHIỆP VỤ CHÍNH (CORE SEQUENCE DIAGRAMS)

### 4.1. Luồng Tranh biện với AI & Chấm điểm Tự động (Debate & AI Evaluation Flow)
```mermaid
sequenceDiagram
    autonumber
    actor Debater as Người học / Thí sinh
    participant FE as Frontend (DebateRoom)
    participant GW as YARP Gateway (Port 5000)
    participant SS as SystemService (Port 5001)
    participant AI_Opp as AI Opponent (Port 8002)
    participant AI_Eval as AI Evaluator (Port 8000)
    participant DB as SQL Server & Postgres

    Debater->>FE: Bắt đầu phiên tranh biện (Chọn Chủ đề & Phe PRO/CON)
    FE->>GW: POST /api/debate/sessions
    GW->>SS: Tạo phiên tranh biện mới
    SS->>DB: Lưu DebateSession (Status: Ongoing)
    SS-->>FE: Trả về SessionId & Cấu hình hiệp đấu

    loop 3 Vòng tranh biện (Mở đầu - Phản biện - Kết luận)
        Debater->>FE: Nhập / Nói lập luận
        FE->>GW: POST /api/debate/{id}/arguments
        GW->>SS: Lưu lượt phát biểu (ArgumentTurn)
        SS->>DB: Insert ArgumentTurn

        par Đối thủ AI phản biện
            FE->>GW: POST /api/opponent/sessions/{id}/turns
            GW->>AI_Opp: Yêu cầu sinh luận điểm đối kháng
            AI_Opp->>DB: Đọc lịch sử ngữ cảnh (Postgres)
            AI_Opp-->>FE: Trả về phản biện của AI
        and AI Evaluator chấm điểm tức thời
            FE->>GW: POST /api/evaluate/argument
            GW->>AI_Eval: Phân tích chất lượng lập luận & ngụy biện
            AI_Eval-->>FE: Điểm thành phần + Gợi ý cải thiện (Coaching)
        end
    end

    Debater->>FE: Hoàn tất 3 vòng & Nộp bài
    FE->>GW: POST /api/evaluate/session
    GW->>AI_Eval: Tổng hợp điểm toàn phiên tranh biện
    AI_Eval-->>FE: Bảng điểm tổng kết & Nhận xét chuyên sâu
```

### 4.2. Luồng Giải đấu & Chấm thi Giám khảo (Competition & Judge Scoring Flow)
```mermaid
sequenceDiagram
    autonumber
    actor Org as Ban tổ chức (Organizer)
    actor Debater as Thí sinh / Đội thi
    actor Judge as Giám khảo (Judge)
    participant FE as Frontend (Competition UI)
    participant SS as SystemService (Port 5001)
    participant AI_Eval as AI Evaluator (Port 8000)

    Org->>FE: Tạo giải đấu (1v1 Individual hoặc 2v2 Team)
    FE->>SS: POST /api/competitions
    Org->>FE: Mở đăng ký (Open Registration)
    FE->>SS: POST /api/competitions/{id}/open-registration

    Debater->>FE: Đăng ký tham gia / Lập đội 2v2
    FE->>SS: POST /api/competitions/{id}/registrations (hoặc /teams)
    Org->>FE: Duyệt thí sinh & Đóng đăng ký
    FE->>SS: POST /api/competitions/{id}/close-registration

    Org->>FE: Sinh cây thi đấu (Generate Bracket) & Chuẩn bị trận
    FE->>SS: POST /api/competitions/{id}/bracket
    FE->>SS: POST /api/competitions/matches/{matchId}/prepare-debate
    SS-->>FE: Trả về DebateSessionId chính thức cho cặp đấu

    Debater->>FE: Vào phòng thi đấu theo DebateSessionId
    Note over Debater,SS: Hai bên PRO & CON thi đấu trực tiếp, Organizer giám sát qua MatchMonitorModal (Read-only)

    Judge->>FE: Mở bảng chấm điểm (JudgeEvaluationModal)
    FE->>SS: GET /api/competitions/{id}/matches/{matchId}/review
    SS->>AI_Eval: Lấy gợi ý đánh giá từ AI Evaluator
    SS-->>FE: Trả về bảng tiêu chí + AI Suggestion

    Judge->>FE: Nhập điểm các tiêu chí, chọn Winner & xác nhận
    FE->>SS: POST /api/competitions/{id}/matches/{matchId}/finalize
    SS-->>FE: Cập nhật người thắng đi tiếp vào vòng sau / Vinh danh Champion
```

---

## 5. VỊ TRÍ THƯC TẾ CỦA CÁC THÀNH PHẦN TRONG WORKSPACE

| Thành phần | Đường dẫn thư mục trong dự án | Công nghệ | Cổng (Port) |
| :--- | :--- | :--- | :---: |
| **Frontend Web App** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\src` | React 19, TypeScript, Tailwind v4, Vite | `5173` |
| **API Gateway** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\Gateway` | .NET 8, YARP Reverse Proxy | `5000` |
| **System Service (API)** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\Services\SystemService` | .NET 8 Web API | `5001` |
| **System Service (BLL)** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\Services\SystemService.BLL` | C# Class Library (Business Logic) | - |
| **System Service (DAL)** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\Services\SystemService.DAL` | EF Core, Repositories, Entities | - |
| **AI Evaluator Service** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\AiServices\ai-evaluator-service` | Python, FastAPI, Google GenAI / OpenAI | `8000` |
| **AI Opponent Service** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\AiServices\ai-opponent-service` | Python, FastAPI, SQLAlchemy, Alembic | `8002` |
| **PostgreSQL AI DB** | `SEP409-AI-DEBATE\AiServices\ai-opponent-service\docker-compose.yml` | PostgreSQL 16 Alpine (Docker) | `5433` |
| **Script khởi chạy tổng** | `d:\Kì_9_FPT\KLTN\Front-end-ADPP\SEP409-AI-DEBATE\start-all.ps1` | PowerShell Automation | - |

