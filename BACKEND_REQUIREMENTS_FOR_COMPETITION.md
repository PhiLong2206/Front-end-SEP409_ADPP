# ADPP – TÀI LIỆU YÊU CẦU KỸ THUẬT BACKEND (COMPETITION MODULE)
**Dự án:** AI Debate Practice Platform (ADPP)  
**Phân hệ:** Cuộc thi & Giải đấu (Competition, Bracket, Match, Judge Scoring)  
**Đối tượng:** Backend Engineering Team (.NET 8 Web API / EF Core)  
**Ngày phát hành:** 08/11/2026  
**Trạng thái Frontend:** Đã hoàn thiện giao diện & contracts sẵn sàng kết nối.

---

## 1. TỔNG QUAN HIỆN TRẠNG & NGUYÊN NHÂN CẦN TRIỂN KHAI

### 1.1. Hiện trạng
- Database SQL Server của dự án (`AIDebate-V0.7.sql`) đã có sẵn cấu trúc bảng cho:
  - `Competitions`
  - `CompetitionRegistrations`
  - `CompetitionTeams`, `CompetitionTeamMembers`, `TeamRequests`
  - `CompetitionJudges`
  - `CompetitionRounds`
  - `CompetitionMatches`
  - `MatchParticipants`
  - `JudgeScores`
- Backend C# (.NET 8) hiện mới chỉ hoàn thành các Controller:
  - `CompetitionsController` (CRUD cuộc thi, Open/Close/Start/Complete/Cancel)
  - `CompetitionRegistrationsController` (Đăng ký cá nhân, duyệt, từ chối)
  - `CompetitionTeamsController` (Tạo đội, mời thành viên, duyệt đơn)
  - `CompetitionJudgesController` (Thêm, xóa giám khảo)
- **Khoảng trống (Gap):** Toàn bộ các API liên quan đến **Sinh Cây thi đấu (Bracket)**, **Quản lý trận đấu (Matches)**, **Chuẩn bị phòng thi (DebateSession)**, và **Chấm điểm giám khảo (Judge Evaluation)** chưa có Controller và Service tương ứng trong code C# (hiện trả về HTTP 404).

### 1.2. Mục tiêu yêu cầu
Xây dựng đầy đủ các Endpoint và nghiệp vụ xử lý dữ liệu cho Bracket và Match để hoàn thiện chu trình thi đấu thực tế, kết nối liền mạch với Frontend.

---

## 2. DANH SÁCH ENDPOINT CẦN TRIỂN KHAI

### 2.1. Quản lý Bracket & Vòng đấu
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/competitions/{id}/bracket/generate` | Creator / Admin | Khởi tạo cây thi đấu loại trực tiếp (Single Elimination) dựa trên các đăng ký hợp lệ (`Approved` đối với Cá nhân, `Active` đối với Đội). |
| `GET` | `/api/competitions/{id}/bracket` | Public / Authenticated | Lấy toàn bộ cây thi đấu gồm các Vòng (Rounds) và các Trận (Matches) đã được sắp xếp theo thứ tự. |
| `GET` | `/api/competitions/{id}/rounds` | Public / Authenticated | Lấy danh sách các vòng thi đấu của cuộc thi kèm trạng thái vòng. |

### 2.2. Quản lý Trận đấu (Match Operations)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/competitions/{id}/matches` | Public / Authenticated | Lấy danh sách tất cả các trận đấu của giải, hỗ trợ query `?roundNumber=...&status=...`. |
| `GET` | `/api/competitions/{id}/matches/{matchId}` | Public / Authenticated | Lấy chi tiết một trận đấu cụ thể (PRO, CON, Giám khảo, Topic, DebateSessionId). |
| `POST` | `/api/competitions/{id}/matches/{matchId}/assign-judge` | Creator / Admin | Phân công Giám khảo vào trận đấu cụ thể (`judgeUserId`). |
| `POST` | `/api/competitions/{id}/matches/{matchId}/prepare-debate` | Creator / Admin | Khởi tạo phòng tranh biện thực (`DebateSessions`), gán `topicId`, cấu hình hai bên PRO/CON, trả về `debateSessionId`. |

### 2.3. Chấm điểm & Phán quyết Trận đấu (Judge Evaluation)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/competitions/{id}/matches/{matchId}/score-criteria` | Creator / Judge | Lấy bảng tiêu chí chấm điểm và điểm gợi ý từ AI Evaluator (nếu phòng thi đã kết thúc). |
| `POST` | `/api/competitions/{id}/matches/{matchId}/finalize` | Creator / Judge phụ trách | Nộp bảng điểm chính thức, chọn bên thắng cuộc (`winnerParticipantId` hoặc `winnerSide`), cập nhật người thắng vào trận vòng sau. |

---

## 3. CẤU TRÚC DTO (CONTRACTS VỚI FRONTEND)

Frontend đã triển khai sẵn sàng các Types tại `src/types/competition.types.ts`. Backend cần trả về đúng định dạng JSON sau:

### 3.1. Bracket & Rounds DTO
```csharp
// Response: GET /api/competitions/{id}/bracket
public class CompetitionBracketResponse
{
    public int CompetitionId { get; set; }
    public string CompetitionTitle { get; set; }
    public string CompetitionType { get; set; } // "INDIVIDUAL" | "TEAM"
    public string Status { get; set; }          // "Scheduled" | "Ongoing" | "Completed"
    public List<CompetitionRoundDto> Rounds { get; set; }
}

public class CompetitionRoundDto
{
    public int RoundId { get; set; }
    public int RoundNumber { get; set; }        // 1, 2, 3...
    public string RoundName { get; set; }       // "Vòng loại", "Tứ kết", "Bán kết", "Chung kết"
    public string Status { get; set; }          // "Pending" | "Ongoing" | "Completed"
    public List<CompetitionMatchDto> Matches { get; set; }
}
```

### 3.2. Match Detail DTO
```csharp
// Response: GET /api/competitions/{id}/matches/{matchId}
public class CompetitionMatchDto
{
    public int MatchId { get; set; }
    public int CompetitionId { get; set; }
    public int RoundNumber { get; set; }
    public string RoundName { get; set; }
    public int MatchOrder { get; set; }
    public string Status { get; set; }          // "Scheduled" | "InDebate" | "Completed" | "Cancelled"
    
    // Thí sinh / Đội phía Ủng hộ (PRO)
    public int? ProParticipantId { get; set; }
    public string ProParticipantName { get; set; }
    public double? ProScore { get; set; }
    
    // Thí sinh / Đội phía Phản đối (CON)
    public int? ConParticipantId { get; set; }
    public string ConParticipantName { get; set; }
    public double? ConScore { get; set; }
    
    // Trạng thái miễn đấu hoặc thắng cuộc
    public bool IsBye { get; set; }
    public int? WinnerParticipantId { get; set; }
    public string WinnerParticipantName { get; set; }
    
    // Giám khảo phụ trách
    public int? JudgeUserId { get; set; }
    public string JudgeName { get; set; }
    
    // Phiên tranh biện liên kết
    public int? DebateSessionId { get; set; }
    public int? TopicId { get; set; }
    public string TopicTitle { get; set; }
    public DateTime? ScheduledStartTime { get; set; }
}
```

### 3.3. Request DTOs
```csharp
// POST /api/competitions/{id}/matches/{matchId}/assign-judge
public class AssignJudgeRequest
{
    [Required]
    public int JudgeUserId { get; set; }
}

// POST /api/competitions/{id}/matches/{matchId}/prepare-debate
public class PrepareMatchDebateRequest
{
    [Required]
    public int TopicId { get; set; }
}

// POST /api/competitions/{id}/matches/{matchId}/finalize
public class FinalizeMatchScoreRequest
{
    [Required]
    public int WinnerParticipantId { get; set; }
    
    [Range(0, 100)]
    public double ProScore { get; set; }
    
    [Range(0, 100)]
    public double ConScore { get; set; }
    
    public string DecisionReason { get; set; }
    public List<JudgeScoreCriteriaItemDto> CriteriaScores { get; set; }
}

public class JudgeScoreCriteriaItemDto
{
    public string CriteriaName { get; set; }   // "Argumentation", "Rebuttal", "Delivery", "Structure"
    public double ProScore { get; set; }
    public double ConScore { get; set; }
    public double Weight { get; set; }         // 0.4, 0.3, 0.2, 0.1
}
```

---

## 4. QUY TẮC NGHIỆP VỤ CỐT LÕI (BUSINESS RULES)

### 4.1. Quy tắc sinh Bracket (Generate Bracket)
1. **Điều kiện kích hoạt:**
   - Cuộc thi phải ở trạng thái `RegistrationClosed`.
   - Số lượng thí sinh hợp lệ (`Approved` với Cá nhân, `Active` với Đội) tối thiểu là **2**.
2. **Xử lý số lượng thí sinh không phải lũy thừa của 2:**
   - Nếu số thí sinh là $N$ nằm giữa $2^{k-1}$ và $2^k$:
   - Tạo vòng đầu tiên gồm các cặp đấu sao cho số người chiến thắng cộng với số người được miễn đấu (BYE) đúng bằng $2^{k-1}$.
   - Thí sinh có hạt giống cao hơn được quyền BYE và tự động đi tiếp vào Vòng tiếp theo (`IsBye = true`, `WinnerParticipantId = participantId`).
3. **Phân bổ PRO / CON:**
   - Ngẫu nhiên hoặc theo hạt giống hạt giống cao làm PRO, hạt giống thấp làm CON.

### 4.2. Quy tắc khởi tạo phòng tranh biện (`prepare-debate`)
Khi Ban tổ chức nhấn **"Chuẩn bị phòng thi"**:
1. Tạo một bản ghi mới trong bảng `DebateSessions`:
   - `Title`: `$"[Giải đấu] {competition.Title} - Trận #{match.MatchId} ({match.RoundName})"`
   - `TopicId`: TopicId được chọn trong modal.
   - `DebateType`: `4` (Competition).
   - `Status`: `0` (Created / Waiting).
   - `CreatedByUserId`: ID của Creator hoặc Judge.
2. Thêm người tham gia vào `DebateParticipants`:
   - Phía PRO: Thí sinh / Thành viên đội PRO (`Side = 1`).
   - Phía CON: Thí sinh / Thành viên đội CON (`Side = 2`).
3. Cập nhật `CompetitionMatches.DebateSessionId` trỏ tới `DebateSessionId` vừa sinh ra.
4. Chuyển trạng thái trận đấu sang `InDebate`.

### 4.3. Quy tắc chấm điểm và chuyển vòng (`finalize`)
Khi Giám khảo hoàn thành chấm điểm:
1. Ghi nhận điểm số `ProScore`, `ConScore` vào `CompetitionMatches` và lưu chi tiết vào bảng `JudgeScores`.
2. Gán `WinnerParticipantId`.
3. Chuyển trạng thái trận đấu hiện tại thành `Completed`.
4. **Tự động đưa Người chiến thắng lên trận tiếp theo:**
   - Xác định trận đấu ở Vòng tiếp theo (`nextRoundMatchId`).
   - Nếu vị trí PRO còn trống: Gán người thắng vào `ProParticipantId`.
   - Nếu PRO đã có người: Gán vào `ConParticipantId`.
5. **Xác định Quán quân:**
   - Nếu trận đấu vừa kết thúc là trận **Chung kết (`RoundName = 'Chung kết'`)**:
   - Cập nhật `Competitions.ChampionUserId` (đối với INDIVIDUAL) hoặc `Competitions.ChampionTeamId` (đối với TEAM).
   - Tự động chuyển trạng thái cuộc thi sang `Completed`.

---

## 5. MA TRẬN PHÂN QUYỀN (RBAC & SECURITY RULES)

| Hành động | Ban tổ chức (Creator) | Giám khảo phân công (Judge) | Thí sinh trong trận | Người ngoài / Khán giả |
| :--- | :---: | :---: | :---: | :---: |
| Sinh Bracket | Cho phép | Không | Không | Không |
| Phân công Giám khảo | Cho phép | Không | Không | Không |
| Chuẩn bị phòng thi | Cho phép | Cho phép | Không | Không |
| Vào phòng tranh luận (Nói / Gửi bài) | **Khóa** (Trừ khi là thí sinh) | **Khóa** | Cho phép | **Khóa** |
| Giám sát trận đấu (Read-only) | Cho phép | Cho phép | Cho phép | Cho phép |
| Chấm điểm & Finalize | Cho phép | Cho phép | Không | Không |

---

## 6. HƯỚNG DẪN KIỂM TRA TÍCH HỢP SAU KHI CODE XONG
Sau khi Backend triển khai xong các Controller trên:
1. Mở giao diện ADPP Frontend (`http://localhost:5173`).
2. Vào một cuộc thi đã đóng đăng ký (`RegistrationClosed`), mở tab **"Cây thi đấu & Trận đấu"**, nhấn **"Sinh cây nhánh đấu"**.
3. Cây thi đấu sẽ hiển thị các nhánh đối đầu trực quan thay vì thông báo chờ Backend.
4. Nhấn vào một trận đấu để kiểm tra tính năng **Chỉ định Giám khảo** và **Chuẩn bị phòng thi đấu**.
5. Mở màn hình Giám sát trận để kiểm tra dữ liệu đọc trực tiếp từ `DebateSessionId`.

