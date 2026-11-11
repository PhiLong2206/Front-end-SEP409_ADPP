# ADPP – BÁO CÁO TRIỂN KHAI FRONTEND CUỘC THI & GIẢI ĐẤU (FE FIRST)
**Dự án:** AI Debate Practice Platform (ADPP)  
**Ngày báo cáo:** 08/11/2026  
**Người thực hiện:** Senior Fullstack & React Frontend Specialist  
**Chiến lược triển khai:** Frontend First (Xây dựng hoàn thiện toàn bộ luồng người dùng và giao diện trước; tích hợp sẵn sàng API chuẩn cho Backend).

---

## 1. TỔNG QUAN VÀ MỤC TIÊU TRIỂN KHAI

Báo cáo này tổng kết việc tái cấu trúc và hoàn thiện toàn bộ phân hệ Cuộc thi & Giải đấu (Competition Module) trên Frontend theo quyết định **FE First**. 

Mọi hành vi giả lập session cục bộ, mock data gây nhầm lẫn, và các lỗi chuyển hướng sai quyền hạn (P0) đã được khắc phục triệt để. Hệ thống giao diện hiện tại được phân định rõ ràng giữa các vai trò (Ban tổ chức, Giám khảo, Thí sinh, Khán giả), cung cấp đầy đủ các màn hình quản trị Cây thi đấu (Bracket), Quản lý từng trận (Match Management), Giám sát trực tiếp (Match Monitoring), và Chấm thi (Judge Evaluation).

---

## 2. PHẠM VI & CHUẨN HÓA THỂ THỨC (FORMAT SCOPE)

Theo nghiệp vụ cốt lõi của giải đấu đối kháng, tính năng Cuộc thi chỉ hỗ trợ **2 thể thức**:
1. **FormatId 2 (1v1 – Cá nhân đối kháng):** Áp dụng cho cuộc thi loại hình `INDIVIDUAL`.
2. **FormatId 4 (Team Debate – 2v2 Đội đối kháng):** Áp dụng cho cuộc thi loại hình `TEAM`.

### Xử lý loại trừ:
- **FormatId 1 (User vs AI)** và **FormatId 3 (Solo Practice)** đã bị loại bỏ hoàn toàn khỏi giao diện tạo cuộc thi (`CompetitionFormModal.tsx`).
- Khi người dùng chuyển đổi giữa loại hình Cá nhân và Đội nhóm, `formatId` tự động được đồng bộ về đúng mã `2` hoặc `4`.

---

## 3. KHẮC PHỤC LỖI NGHIỆM TRỌNG (P0 FIXES)

### 3.1. Triệt tiêu hoàn toàn định danh giả `session-comp-${competitionId}`
- **Nguyên nhân gốc rễ trước đây:** Frontend tự ghép chuỗi `session-comp-${competitionId}` rồi điều hướng vào `DebateRoom.tsx`. Hàm `parseInt()` tại đây trả về `NaN`, khiến phòng tưởng là phiên tập luyện AI cục bộ và gán quyền Debater cho người dùng.
- **Giải pháp:** 
  - Đã loại bỏ 100% việc điều hướng đến `session-comp-${competitionId}` trên toàn bộ codebase (`CompetitionAdminDetailModal`, `CompetitionDetailModal`, `Competitions.tsx`).
  - Trong `DebateRoom.tsx`, nếu người dùng truy cập trực tiếp bằng URL cũ dạng `session-comp-*`, giao diện lập tức chặn lại và hiển thị cảnh báo giải thích đây là định danh cũ, hướng dẫn người dùng quay lại Cây thi đấu để vào đúng DebateSession ID của trận.

### 3.2. Sửa lỗi Organizer/Judge bị ép làm Debater
- Loại bỏ hoàn toàn giá trị hardcode `userRoleInRoom="Debater"`.
- Vai trò trong phòng (`userRoleInRoom`) được tính toán động dựa trên thực tế:
  - Nếu `userId` nằm trong danh sách thí sinh của trận đấu: `Debater`.
  - Nếu có tham số `role=judge` hoặc người dùng là Giám khảo của trận: `Judge`.
  - Nếu là Ban tổ chức hoặc khán giả: `Spectator`.
- **Cơ chế khóa lượt nói:** Khi `userRoleInRoom !== "Debater"`, các nút phát biểu, khung nhập lập luận, và nút ghi âm mic đều bị vô hiệu hóa kèm thông báo rõ ràng: `"Bạn đang ở chế độ Giám khảo / Khán giả theo dõi trận đấu (Read-only)"`.

---

## 4. CÁC COMPONENT MỚI ĐÃ XÂY DỰNG

### 4.1. `CompetitionBracketView.tsx` (Cây thi đấu Single-Elimination)
- **Đường dẫn:** `src/components/competition/CompetitionBracketView.tsx`
- **Tính năng:**
  - Hiển thị trực quan các vòng đấu (Vòng loại, Tứ kết, Bán kết, Chung kết).
  - Thể hiện rõ nét 2 bên tranh biện: Phía **Ủng hộ (PRO)** và Phía **Phản đối (CON)**.
  - Hỗ trợ cả 2 thể thức: Cá nhân (hiển thị thí sinh) và Đội nhóm (hiển thị tên đội và thành viên).
  - Đánh dấu trực quan các trạng thái: Đang diễn ra, Đã hoàn thành, Thí sinh đi tiếp (Winner highlight), và lượt miễn đấu (BYE).
  - Tích hợp nút **"Sinh cây nhánh đấu (Generate Bracket)"** dành riêng cho Ban tổ chức khi giải đấu đã đóng đăng ký (`RegistrationClosed`).
  - **Graceful Backend Waiting:** Nếu Backend chưa có API `/bracket` (trả về 404), giao diện hiển thị thông báo trạng thái chuyên nghiệp `"Chức năng bốc thăm cây nhánh đấu đang chờ Backend triển khai"`, tuyệt đối không dùng mock data giả lập để đánh lừa người dùng.

### 4.2. `MatchDetailModal.tsx` (Bảng điều phối chi tiết trận đấu)
- **Đường dẫn:** `src/components/competition/MatchDetailModal.tsx`
- **Tính năng:**
  - Hiển thị đầy đủ thông tin: Mã trận (Match ID), Vòng đấu, Trạng thái (Scheduled, InDebate, Completed, Cancelled).
  - Thẻ thông tin hai bên PRO vs CON kèm điểm số từng hiệp.
  - **Phân công Giám khảo (Assign Judge):** Cho phép Organizer chọn giám khảo từ danh sách giám khảo của giải đấu và gọi API `competitionApi.assignMatchJudge`.
  - **Chuẩn bị phòng thi đấu (Prepare Debate):** Cho phép chọn chủ đề từ danh sách chủ đề chính thức (`topicApi.getAll`) và khởi tạo phiên thi đấu qua API `competitionApi.prepareDebate`.
  - Các nút hành động nghiệp vụ: Mở Giám sát trận (`MatchMonitorModal`), Mở Chấm điểm (`JudgeEvaluationModal`), hoặc Vào phòng tranh biện (`/debater/debate/${debateSessionId}`).

### 4.3. `MatchMonitorModal.tsx` (Màn hình Giám sát trực tiếp dành cho BTC & Khán giả)
- **Đường dẫn:** `src/components/competition/MatchMonitorModal.tsx`
- **Tính năng:**
  - Giao diện chuyên biệt cho Organizer/Spectator theo dõi diễn biến trận đấu.
  - **Hoàn toàn Read-Only:** Tuyệt đối không có khung soạn thảo bài nói, không có micro ghi âm, không có nút gửi lập luận.
  - Hiển thị thông tin đối đầu PRO vs CON, chủ đề, vòng thi, và giám khảo phụ trách.
  - **Live Transcript Polling:** Tự động cập nhật các lượt phát biểu mới nhất từ phiên tranh biện thực (`debateApi.getSessionDetails`).
  - Xử lý thông báo khi trận đấu chưa chuẩn bị hoặc chưa bắt đầu.

### 4.4. `JudgeEvaluationModal.tsx` (Bảng chấm điểm dành cho Giám khảo)
- **Đường dẫn:** `src/components/competition/JudgeEvaluationModal.tsx`
- **Tính năng:**
  - Cung cấp biểu mẫu chấm điểm đa tiêu chí: Luận điểm & Lập luận (Argumentation - 40%), Phản biện & Bác bỏ (Rebuttal - 30%), Kỹ năng & Phong thái (Delivery - 20%), Cấu trúc & Thời gian (Structure - 10%).
  - Tự động tính điểm tổng có trọng số cho cả hai bên PRO và CON.
  - **AI Evaluator Suggestion:** Hiển thị điểm gợi ý và nhận xét từ AI Evaluator (nếu có) để giám khảo tham khảo.
  - Chọn bên chiến thắng (Winner Selection) và nhập lý do phán quyết (Decision Reason).
  - Gửi kết quả chính thức qua API `competitionApi.finalizeMatch`.

### 4.5. `CompetitionChampionBanner.tsx` (Vinh danh Quán quân)
- **Đường dẫn:** `src/components/competition/CompetitionChampionBanner.tsx`
- **Tính năng:**
  - Banner vinh danh với hiệu ứng đồ họa cúp vàng dành cho các cuộc thi ở trạng thái `Completed`.
  - Hiển thị tên Thí sinh vô địch (INDIVIDUAL) hoặc Đội quán quân (TEAM).

---

## 5. TÍCH HỢP VÀO HỆ THỐNG HIỆN HỮU

| File sửa đổi | Nội dung tích hợp |
| :--- | :--- |
| `src/components/competition/CompetitionAdminDetailModal.tsx` | - Thêm tab **"Cây thi đấu & Trận đấu"**.<br>- Nhúng component `CompetitionBracketView`.<br>- Thay nút chuyển hướng mock sang nút mở Tab Bracket.<br>- Tích hợp `CompetitionChampionBanner` khi giải đấu hoàn thành. |
| `src/components/competition/CompetitionDetailModal.tsx` | - Thêm tab **"Cây thi đấu & Trận đấu"** cho thí sinh & người xem.<br>- Loại bỏ 4 vị trí điều hướng `session-comp-*`, thay bằng hành động mở tab Cây thi đấu để thí sinh chọn đúng trận.<br>- Tích hợp `CompetitionChampionBanner`. |
| `src/pages/debater/Competitions/Competitions.tsx` | - Nút hành động của cuộc thi đang diễn ra (`Ongoing`) chuyển sang mở trực tiếp bảng Quản trị Cây thi đấu thay vì điều hướng đến session giả. |
| `src/pages/debater/DebatePractice/DebateRoom.tsx` | - Chặn và hiển thị thông báo lỗi khi có URL truy cập vào `session-comp-*`.<br>- Tính toán vai trò thực tế (`userRoleInRoom`: Debater / Judge / Spectator).<br>- Khóa chức năng phát biểu đối với Giám khảo và Giám sát viên. |

---

## 6. KẾT QUẢ KIỂM THỬ VÀ XÁC MINH

### 6.1. Kiểm thử biên dịch Production (Vite Build)
```bash
> npm run build
✓ 2625 modules transformed.
dist/index.html                         1.02 kB
dist/assets/index-B1DY7vr6.js       1,355.92 kB
✓ built in 533ms
```
=> **Biên dịch thành công 100%, không có lỗi TypeScript hay JSX.**

### 6.2. Kiểm thử tự động (Vitest Suite)
Đã bổ sung bộ kiểm thử chuyên biệt `src/test/CompetitionFrontendFeatures.test.tsx` kiểm tra:
1. Vinh danh Quán quân cá nhân và đội tuyển qua `CompetitionChampionBanner`.
2. Kiểm tra `MatchMonitorModal` chuẩn Read-only (không có input, không có composer).
3. Kiểm tra các luồng bảo vệ và điều hướng.

**Kết quả chạy toàn bộ test suites:**
```bash
> vitest run --config vitest.config.ts --run

 ✓ src/test/competitionDebateLifecycle.test.ts (24 tests)
 ✓ src/test/App.test.tsx (2 tests)
 ✓ src/test/CompetitionFrontendFeatures.test.tsx (3 tests)
 ✓ src/test/P2pRoomCreation.test.tsx (2 tests)
 ✓ src/test/PaymentsPayOsDirectRedirect.test.tsx (3 tests)
 ✓ src/test/DebateNavigationProtection.test.tsx (5 tests)
 ✓ src/test/DebateRoom.test.tsx (8 tests)

 Test Files  7 passed (7)
      Tests  47 passed (47)
   Duration  3.54s
```
=> **100% kiểm thử thành công (47/47 tests pass).**

---

## 7. KẾT LUẬN

Phần Frontend của luồng Cuộc thi & Giải đấu đã đạt mức độ hoàn thiện cao, tuân thủ đúng kiến trúc chuẩn:
- Không còn bất kỳ mã mock hay session giả nào trong giao diện thi đấu.
- Luồng điều hướng và phân quyền minh bạch, an toàn.
- Sẵn sàng kết nối ngay khi Backend hoàn thiện các API Cây thi đấu và Trận đấu.
- Chi tiết yêu cầu kỹ thuật dành cho Backend Developer được trình bày trong tài liệu `BACKEND_REQUIREMENTS_FOR_COMPETITION.md`.

