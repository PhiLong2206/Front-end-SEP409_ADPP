# BĂO CĂO TOĂ€N DIá»†N: KIá»‚M TOĂN TĂNH NÄ‚NG CUá»˜C THI & GIáº¢I Äáº¤U (ADPP COMPETITION AUDIT)
**Dá»± Ă¡n:** AI Debate Practice Platform (ADPP)
**Vai trĂ²:** Senior Fullstack Engineer & Software QA Auditor
**Pháº¡m vi:** ToĂ n bá»™ luá»“ng Cuá»™c thi tá»« Frontend (`Front-end-ADPP/src`) Ä‘áº¿n Backend (`SEP409-AI-DEBATE`) vĂ  Database (`AIDebate-V0.7.sql`).
**NguyĂªn táº¯c thá»±c hiá»‡n:** CHá»ˆ KIá»‚M TRA, PHĂ‚N TĂCH VĂ€ BĂO CĂO - TUYá»†T Äá»I KHĂ”NG Sá»¬A CODE / KHĂ”NG THAY Äá»”I DATABASE.

---

## PHáº¦N A â€“ Tá»”NG QUAN Káº¾T QUáº¢ KIá»‚M TOĂN

* **Tá»•ng sá»‘ chá»©c nÄƒng/tiĂªu chĂ­ kiá»ƒm tra:** 21 chá»©c nÄƒng thuá»™c chu trĂ¬nh giáº£i Ä‘áº¥u vĂ  giĂ¡m sĂ¡t thi.
* **REAL API VERIFIED (XĂ¡c minh API tháº­t & xá»­ lĂ½ trá»n váº¹n BE-DB):** **5** chá»©c nÄƒng (Táº¡o cuá»™c thi, Má»Ÿ/ÄĂ³ng Ä‘Äƒng kĂ½, ÄÄƒng kĂ½ cĂ¡ nhĂ¢n, ÄÄƒng kĂ½ Ä‘á»™i & lá»i má»i, Duyá»‡t/Tá»« chá»‘i Ä‘Äƒng kĂ½).
* **API WIRED ONLY (FE cĂ³ gá»i API tháº­t nhÆ°ng BE chá»‰ Ä‘á»•i cá» tráº¡ng thĂ¡i chuá»—i text, thiáº¿u logic nghiá»‡p vá»¥ cá»‘t lĂµi):** **2** chá»©c nÄƒng (`StartCompetition`, `CompleteCompetition`).
* **MOCK DATA / HARDCODED (DĂ¹ng dá»¯ liá»‡u giáº£ / URL giáº£ / Session ID giáº£):** **3** chá»©c nÄƒng (VĂ o phĂ²ng thi giáº£i Ä‘áº¥u, GiĂ¡m sĂ¡t cuá»™c thi, Vai trĂ² giĂ¡m sĂ¡t viĂªn trong phĂ²ng).
* **BROKEN / NOT IMPLEMENTED (ChÆ°a triá»ƒn khai trĂªn BE hoáº·c gĂ£y luá»“ng nghiĂªm trá»ng):** **11** chá»©c nÄƒng (Sinh bracket, Xem bracket, PhĂ¢n cĂ´ng giĂ¡m kháº£o tráº­n, Chuáº©n bá»‹ phĂ²ng tranh biá»‡n tráº­n, GiĂ¡m sĂ¡t tá»«ng phiĂªn thi, AI thi Ä‘áº¥u giáº£i User vs AI, Cháº¥m Ä‘iá»ƒm tráº­n Ä‘áº¥u theo tiĂªu chĂ­, Cáº­p nháº­t ngÆ°á»i tháº¯ng tá»± Ä‘á»™ng, NhĂ¡nh BYE, Vinh danh Champion, Giao diá»‡n Read-only cho GiĂ¡m sĂ¡t viĂªn).
* **UNVERIFIED (ChÆ°a xĂ¡c minh runtime do thiáº¿u backend controller):** 0 (ÄĂ£ kiá»ƒm tra trá»±c tiáº¿p mĂ£ nguá»“n C# DAL, BLL, Controllers vĂ  Database Schema).

> [!CAUTION]
> **Káº¾T LUáº¬N Cá»T LĂ•I Cá»¦A AUDITOR:**
> Há»‡ thá»‘ng hiá»‡n táº¡i **CHá»ˆ HOĂ€N THIá»†N ÄÆ¯á»¢C GIAI ÄOáº N ÄÄ‚NG KĂ VĂ€ Táº O GIáº¢I**. ToĂ n bá»™ giai Ä‘oáº¡n **Sinh Bracket, Váº­n hĂ nh tráº­n Ä‘áº¥u, GiĂ¡m sĂ¡t thi Ä‘áº¥u, Cháº¥m Ä‘iá»ƒm GiĂ¡m kháº£o vĂ  XĂ¡c Ä‘á»‹nh QuĂ¡n quĂ¢n** Ä‘ang bá»‹ **GĂƒY HOĂ€N TOĂ€N** do:
> 1. Backend `SEP409-AI-DEBATE` **hoĂ n toĂ n chÆ°a cĂ³** cĂ¡c Controller/Service/Entity vá» Bracket (`CompetitionTournamentController`, `CompetitionMatches`, `MatchParticipants`, `JudgeScores`). CĂ¡c API nĂ y chá»‰ má»›i tá»“n táº¡i trĂªn file Ä‘áº·c táº£ tĂ i liá»‡u vĂ  trong file unit test mock (`competitionDebateLifecycle.test.ts`), chÆ°a cĂ³ code C# tháº­t trong Backend.
> 2. Frontend Ä‘ang dĂ¹ng **URL hardcode giáº£ láº­p** `/debater/debate/session-comp-${competitionId}`, dáº«n tá»›i viá»‡c cáº£ Organizer, Judge láº«n ThĂ­ sinh khi báº¥m vĂ o phĂ²ng thi Ä‘á»u bá»‹ Ä‘áº©y vĂ o má»™t phĂ²ng AI Practice cĂ¡ nhĂ¢n rá»—ng cá»¥c bá»™ vá»›i vai trĂ² bá»‹ gĂ¡n cá»©ng lĂ  `Debater`.

---

## PHáº¦N B â€“ Báº¢NG KIá»‚M TRA CHI TIáº¾T Tá»ªNG CHá»¨C NÄ‚NG

| STT | Chá»©c nÄƒng | FormatId | FE File & Line | API Endpoint | BE File & Line | Database Table | Tráº¡ng thĂ¡i | Báº±ng chá»©ng mĂ£ nguá»“n & Thá»±c táº¿ | Váº¥n Ä‘á» phĂ¡t hiá»‡n |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | Táº¡o cuá»™c thi | All (1,2,3,4) | `CompetitionFormModal.tsx:186` | `POST /api/Competitions` | `CompetitionsController.cs:25`<br>`CompetitionService.cs:31` | `Competitions`, `CompetitionJudges` | **REAL API VERIFIED** | LÆ°u thĂ nh cĂ´ng vĂ o DB vá»›i status `Draft`, gĂ¡n `CreatedBy` lĂ m Judge Ä‘áº§u tiĂªn. | Dropdown FormatId cho chá»n 4 thá»ƒ thá»©c nhÆ°ng BE chá»‰ há»— trá»£ 1 kiá»ƒu lÆ°u DB. |
| **2** | Má»Ÿ Ä‘Äƒng kĂ½ | All | `CompetitionAdminDetailModal.tsx:442` | `POST /api/Competitions/{id}/open-registration` | `CompetitionsController.cs:79`<br>`CompetitionService.cs:327` | `Competitions.Status` | **REAL API VERIFIED** | Chuyá»ƒn `Draft` â†’ `OpenRegistration`. | KhĂ´ng kiá»ƒm tra Ä‘iá»u kiá»‡n thá»i gian báº¯t Ä‘áº§u. |
| **3** | ÄĂ³ng Ä‘Äƒng kĂ½ | All | `CompetitionAdminDetailModal.tsx:486` | `POST /api/Competitions/{id}/close-registration` | `CompetitionsController.cs:96`<br>`CompetitionService.cs:332` | `Competitions.Status` | **REAL API VERIFIED** | Chuyá»ƒn `OpenRegistration` â†’ `RegistrationClosed`. | Cho phĂ©p Ä‘Ă³ng báº¥t ká»³ lĂºc nĂ o, chÆ°a cháº·n má»‘c `RegistrationEnd`. |
| **4** | ÄÄƒng kĂ½ cĂ¡ nhĂ¢n (1v1) | 1, 2, 3 | `CompetitionDetailModal.tsx:567` | `POST /api/competitions/{id}/registrations` | `CompetitionRegistrationsController.cs:24`<br>`CompetitionRegistrationService.cs:27` | `CompetitionRegistrations` | **REAL API VERIFIED** | Táº¡o báº£n ghi vá»›i tráº¡ng thĂ¡i `Pending`, cháº·n Ä‘Äƒng kĂ½ trĂ¹ng láº·p. | Hoáº¡t Ä‘á»™ng Ä‘Ăºng spec cho 1v1. |
| **5** | Duyá»‡t / Tá»« chá»‘i Ä‘Äƒng kĂ½ | 1, 2, 3 | `CompetitionAdminDetailModal.tsx:714` | `PUT .../registrations/{id}/approve`<br>`PUT .../registrations/{id}/reject` | `CompetitionRegistrationsController.cs:59`<br>`CompetitionRegistrationService.cs:84` | `CompetitionRegistrations.Status` | **REAL API VERIFIED** | Cáº­p nháº­t `Approved`/`Rejected`, lÆ°u `ReviewedBy`, `ReviewedAt`. | Hoáº¡t Ä‘á»™ng tá»‘t. |
| **6** | Táº¡o Ä‘á»™i & Má»i thĂ nh viĂªn (2v2) | 4 | `CompetitionDetailModal.tsx:945` | `POST .../teams`<br>`POST .../teams/{id}/invitations` | `CompetitionTeamsController.cs:24`<br>`CompetitionTeamRequestsController.cs:24` | `CompetitionTeams`<br>`CompetitionTeamMembers`<br>`CompetitionTeamRequests` | **REAL API VERIFIED** | Captain táº¡o Ä‘á»™i `Active`, gá»­i invite, thĂ nh viĂªn accept chuyá»ƒn vĂ o `CompetitionTeamMembers`. | RĂ ng buá»™c Ä‘á»™i tá»‘i Ä‘a 2 ngÆ°á»i Ä‘Æ°á»£c xá»­ lĂ½ tá»‘t. |
| **7** | Sinh bracket (CĂ¢y nhĂ¡nh Ä‘áº¥u) | 2, 4 | `competitionApi.ts:290`<br>*(UI chÆ°a cĂ³ nĂºt)* | `POST /api/competitions/{id}/bracket` | **KHĂ”NG CĂ“ TRONG BE** | `CompetitionMatches` *(ChÆ°a cĂ³ trong DAL C#)* | **NOT IMPLEMENTED / BROKEN** | Backend C# khĂ´ng cĂ³ `CompetitionTournamentController.cs`. Gá»i API sáº½ tráº£ vá» HTTP 404. | Thiáº¿u hoĂ n toĂ n Controller & Service xá»­ lĂ½ Bracket trĂªn Backend. |
| **8** | Xem cĂ¢y bracket | 2, 4 | `competitionApi.ts:299`<br>*(UI chÆ°a cĂ³ Tab)* | `GET /api/competitions/{id}/bracket` | **KHĂ”NG CĂ“ TRONG BE** | `CompetitionMatches`, `CompetitionRounds` | **NOT IMPLEMENTED** | Cáº£ 2 modal FE (`CompetitionAdminDetailModal`, `CompetitionDetailModal`) Ä‘á»u khĂ´ng cĂ³ tab/view Bracket. | ThĂ­ sinh vĂ  BTC khĂ´ng cĂ³ chá»— xem sÆ¡ Ä‘á»“ thi Ä‘áº¥u. |
| **9** | Báº¯t Ä‘áº§u cuá»™c thi | All | `CompetitionAdminDetailModal.tsx:511` | `POST /api/Competitions/{id}/start` | `CompetitionsController.cs:114`<br>`CompetitionService.cs:337` | `Competitions.Status` | **API WIRED ONLY** | `CompetitionService.cs:339` chá»‰ cháº¡y `UpdateStatusInternalAsync(id, "Ongoing")`. | KhĂ´ng há» xĂ¡c thá»±c bracket, khĂ´ng chuyá»ƒn match sang `Ready` nhÆ° tĂ i liá»‡u mĂ´ táº£. |
| **10** | PhĂ¢n cĂ´ng GiĂ¡m kháº£o tráº­n Ä‘áº¥u | 2, 4 | `competitionApi.ts:308`<br>*(UI chÆ°a cĂ³)* | `PUT .../matches/{matchId}/judge` | **KHĂ”NG CĂ“ TRONG BE** | `CompetitionMatches.AssignedJudgeUserId` | **NOT IMPLEMENTED** | Chá»‰ cĂ³ API thĂªm judge chung vĂ o giáº£i `POST .../judges`, khĂ´ng cĂ³ API/UI gĂ¡n judge cho tá»«ng tráº­n. | ChÆ°a thá»ƒ phĂ¢n cĂ´ng judge cho tráº­n. |
| **11** | Chuáº©n bá»‹ phĂ²ng Debate (Táº¡o Session) | 2, 4 | `competitionApi.ts:322`<br>*(UI chÆ°a cĂ³)* | `POST /api/Competitions/matches/{id}/prepare-debate` | **KHĂ”NG CĂ“ TRONG BE** | `CompetitionMatches.DebateSessionId` | **NOT IMPLEMENTED** | KhĂ´ng cĂ³ endpoint nĂ y trong `CompetitionsController.cs`. | KhĂ´ng táº¡o Ä‘Æ°á»£c `DebateSessionId` gáº¯n vá»›i tráº­n Ä‘áº¥u. |
| **12** | Báº¯t Ä‘áº§u phiĂªn tranh biá»‡n tráº­n | 2, 4 | `DebateRoom.tsx:1650` | `POST /api/Debate/{sessionId}/start` | `DebateController.cs:236` | `DebateSessions.Status` | **REAL API VERIFIED (P2P)**<br>**BROKEN (Giáº£i Ä‘áº¥u)** | Hoáº¡t Ä‘á»™ng tá»‘t vá»›i P2P/AI thÆ°á»ng. Vá»›i giáº£i Ä‘áº¥u, do `sessionId` lĂ  chuá»—i giáº£ nĂªn khĂ´ng bao giá» gá»i Ä‘Æ°á»£c. | Tráº­n giáº£i Ä‘áº¥u khĂ´ng thá»ƒ start. |
| **13** | GiĂ¡m sĂ¡t cuá»™c thi (Organizer) | All | `CompetitionAdminDetailModal.tsx:548`<br>`Competitions.tsx:662` | KhĂ´ng gá»i API | KhĂ´ng cĂ³ | KhĂ´ng cĂ³ | **HARDCODED / BROKEN** | Code FE: `navigate('/debater/debate/session-comp-' + id)`. | Chuyá»ƒn sang URL giáº£ láº­p, khĂ´ng pháº£i phĂ²ng giĂ¡m sĂ¡t. |
| **14** | GiĂ¡m sĂ¡t tá»«ng phiĂªn thi | All | `DebateRoom.tsx:1511, 1901` | KhĂ´ng cĂ³ | KhĂ´ng cĂ³ | KhĂ´ng cĂ³ | **MOCK / HARDCODED** | Code FE: gĂ¡n cá»©ng `userRoleInRoom="Debater"` cho táº¥t cáº£ ngÆ°á»i vĂ o phĂ²ng. | KhĂ´ng cĂ³ cháº¿ Ä‘á»™ xem Read-only cho GiĂ¡m sĂ¡t/KhĂ¡n giáº£. |
| **15** | Gá»­i láº­p luáº­n trong giáº£i | 2, 4 | `DebateRoom.tsx:1095` | `POST /api/Debate/{sessionId}/arguments` | `DebateController.cs:126` | `Arguments` | **REAL API VERIFIED (P2P)**<br>**BROKEN (Giáº£i Ä‘áº¥u)** | `sessionId` cá»§a giáº£i Ä‘áº¥u lĂ  `session-comp-2` â†’ `parseInt` ra `NaN` â†’ khĂ´ng lÆ°u DB. | Luáº­n Ä‘iá»ƒm giáº£i Ä‘áº¥u khĂ´ng Ä‘Æ°á»£c lÆ°u vĂ o há»‡ thá»‘ng. |
| **16** | AI Opponent pháº£n biá»‡n giáº£i | 1 | `DebateRoom.tsx:1210` | Port 8000: `/opponent/turn` | Microservice Python | KhĂ´ng qua System DB | **REAL API VERIFIED (Táº­p luyá»‡n)**<br>**MOCK (Giáº£i Ä‘áº¥u)** | Chá»‰ hoáº¡t Ä‘á»™ng á»Ÿ cháº¿ Ä‘á»™ táº­p luyá»‡n AI cĂ¡ nhĂ¢n. | Giáº£i Ä‘áº¥u Format 1 khĂ´ng cĂ³ lÆ°u Ä‘iá»ƒm/xáº¿p háº¡ng. |
| **17** | AI Evaluator cháº¥m Ä‘iá»ƒm | All | `DebateRoom.tsx:1269` | Port 8000: `/evaluate` | Microservice Python | KhĂ´ng qua System DB | **REAL API VERIFIED (Táº­p luyá»‡n)** | Gá»i trá»±c tiáº¿p microservice Ä‘Ă¡nh giĂ¡ turn vĂ  session. | KhĂ´ng lÆ°u vĂ o `JudgeScores` cá»§a cuá»™c thi. |
| **18** | GiĂ¡m kháº£o xem Review & AI gá»£i Ă½ | 2, 4 | `competitionApi.ts:332`<br>*(UI chÆ°a cĂ³)* | `GET .../matches/{id}/review` | **KHĂ”NG CĂ“ TRONG BE** | KhĂ´ng cĂ³ | **NOT IMPLEMENTED** | KhĂ´ng cĂ³ endpoint trong backend C#. | GiĂ¡m kháº£o khĂ´ng thá»ƒ xem há»“ sÆ¡ tráº­n Ä‘á»ƒ cháº¥m. |
| **19** | GiĂ¡m kháº£o Finalize káº¿t quáº£ | 2, 4 | `competitionApi.ts:344`<br>*(UI chÆ°a cĂ³)* | `POST .../matches/{id}/finalize` | **KHĂ”NG CĂ“ TRONG BE** | `JudgeScores` *(chÆ°a cĂ³ trong DAL C#)* | **NOT IMPLEMENTED** | KhĂ´ng cĂ³ controller nháº­n request cháº¥m Ä‘iá»ƒm. | Káº¿t quáº£ khĂ´ng Ä‘Æ°á»£c ghi nháº­n, nhĂ¡nh Ä‘áº¥u khĂ´ng cháº¡y tiáº¿p. |
| **20** | HoĂ n thĂ nh cuá»™c thi | All | `CompetitionAdminDetailModal.tsx:536` | `POST /api/Competitions/{id}/complete` | `CompetitionsController.cs:132`<br>`CompetitionService.cs:342` | `Competitions.Status` | **API WIRED ONLY** | `CompetitionService.cs:344` chá»‰ set `Status = "Completed"`. | KhĂ´ng kiá»ƒm tra tráº­n Final, khĂ´ng tĂ­nh QuĂ¡n quĂ¢n. |
| **21** | Hiá»ƒn thá»‹ Champion | All | *(UI chÆ°a cĂ³)* | `GET /api/competitions/{id}/bracket` | **KHĂ”NG CĂ“ TRONG BE** | KhĂ´ng cĂ³ | **NOT IMPLEMENTED** | Khi giáº£i Completed, khĂ´ng cĂ³ chá»— nĂ o trĂªn UI hiá»ƒn thá»‹ Champion. | Tráº£i nghiá»‡m káº¿t thĂºc giáº£i bá»‹ cá»¥t. |

---

## PHáº¦N C â€“ PHĂ‚N TĂCH RIĂNG Tá»ªNG THá»‚ THá»¨C (FORMATID 1, 2, 3, 4)

Trong báº£ng cÆ¡ sá»Ÿ dá»¯ liá»‡u `DebateFormats` (`AIDebate-V0.7.sql:1908-1935`), há»‡ thá»‘ng cĂ³ 4 báº£n ghi Ä‘Æ°á»£c seed sáºµn:
1. `FormatId = 1`: **User vs AI** (`MaxParticipants = 2`, `TotalRounds = 3`, `RoundDurationSeconds = 180`)
2. `FormatId = 2`: **1 vs 1** (`MaxParticipants = 2`, `TotalRounds = 3`, `RoundDurationSeconds = 180`)
3. `FormatId = 3`: **Solo Practice** (`MaxParticipants = 1`, `TotalRounds = 3`, `RoundDurationSeconds = 180`)
4. `FormatId = 4`: **Team Debate** (`MaxParticipants = 6`, `TotalRounds = 3`, `RoundDurationSeconds = 300`)

### 1. FormatId 1: "User vs AI"
* **Ká»³ vá»ng nghiá»‡p vá»¥:** ThĂ­ sinh Ä‘Äƒng kĂ½ tham gia cuá»™c thi, má»—i ngÆ°á»i sáº½ Ä‘Æ°á»£c cáº¥p má»™t lÆ°á»£t thi Ä‘áº¥u riĂªng vá»›i AI Opponent. AI Evaluator sáº½ cháº¥m Ä‘iá»ƒm cho bĂ i thi cá»§a tá»«ng thĂ­ sinh, lÆ°u vĂ o báº£ng xáº¿p háº¡ng (Leaderboard) cá»§a cuá»™c thi Ä‘á»ƒ xĂ¡c Ä‘á»‹nh ngÆ°á»i chiáº¿n tháº¯ng theo Ä‘iá»ƒm sá»‘ cao nháº¥t.
* **Thá»±c táº¿ Backend:** **HOĂ€N TOĂ€N KHĂ”NG CĂ“ NGHIá»†P Vá»¤ NĂ€Y.**
  * `CompetitionService.cs:96` chá»‰ lÆ°u trÆ°á»ng sá»‘ `FormatId = 1` vĂ o báº£ng `Competitions`.
  * KhĂ´ng cĂ³ API nĂ o táº¡o phiĂªn Ä‘áº¥u vá»›i AI gáº¯n vá»›i `CompetitionId` hay `RegistrationId`.
  * KhĂ´ng cĂ³ báº£ng lÆ°u Ä‘iá»ƒm bĂ i thi AI cá»§a cuá»™c thi.
  * Khi báº¥m "VĂ o phĂ²ng thi Ä‘áº¥u", FE chuyá»ƒn Ä‘áº¿n `/debater/debate/session-comp-2` (cháº¡y AI Practice Ä‘á»™c láº­p trong bá»™ nhá»› trĂ¬nh duyá»‡t, Ä‘iá»ƒm sá»‘ khĂ´ng Ä‘Æ°á»£c lÆ°u vĂ o cuá»™c thi).
* **Káº¿t luáº­n:** **BROKEN / KHĂ”NG KHáº¢ Dá»¤NG CHO CUá»˜C THI.**

### 2. FormatId 2: "1 vs 1 Äá»‘i khĂ¡ng"
* **Ká»³ vá»ng nghiá»‡p vá»¥:** Thi Ä‘áº¥u Ä‘á»‘i khĂ¡ng loáº¡i trá»±c tiáº¿p (Single Elimination Bracket) giá»¯a 2 ngÆ°á»i tháº­t. CĂ³ bá»‘c thÄƒm háº¡t giá»‘ng, chia cáº·p PRO/CON, phĂ¢n cĂ´ng GiĂ¡m kháº£o, thi Ä‘áº¥u trong `DebateRoom`, AI há»— trá»£ gá»£i Ă½ vĂ  GiĂ¡m kháº£o cháº¥m Ä‘iá»ƒm chĂ­nh thá»©c Ä‘á»ƒ Ä‘áº©y ngÆ°á»i tháº¯ng vĂ o vĂ²ng trong.
* **Thá»±c táº¿ Backend:**
  * Giai Ä‘oáº¡n 1 & 2 (Táº¡o giáº£i, ÄÄƒng kĂ½, Duyá»‡t thĂ­ sinh): **Hoáº¡t Ä‘á»™ng tháº­t 100% trĂªn DB.**
  * Giai Ä‘oáº¡n 3, 4, 5 (Bracket, Match, PhĂ¢n cĂ´ng Judge, Prepare Debate, Finalize): **CHÆ¯A ÄÆ¯á»¢C CODE TRĂN BACKEND.**
  * MĂ£ nguá»“n C# trong `SEP409-AI-DEBATE` chÆ°a cĂ³ `CompetitionTournamentController.cs` vĂ  chÆ°a cĂ³ cĂ¡c Entity `CompetitionMatch`, `CompetitionRound`.
* **Káº¿t luáº­n:** **Má»I HOĂ€N THIá»†N ÄÆ¯á»¢C 40% (KHĂ‚U ÄÄ‚NG KĂ). PHáº¦N THI Äáº¤U CHÆ¯A THá»°C THI ÄÆ¯á»¢C.**

### 3. FormatId 3: "Solo Practice"
* **Ká»³ vá»ng nghiá»‡p vá»¥:** Luyá»‡n táº­p cĂ¡ nhĂ¢n má»™t mĂ¬nh (tá»± nĂ³i tá»± ghi Ă¢m vĂ  AI phĂ¢n tĂ­ch).
* **Thá»±c táº¿ Backend:** Trong báº£ng `DebateFormats`, `Solo Practice` cĂ³ `MaxParticipants = 1`. Tuy nhiĂªn, cuá»™c thi báº£n cháº¥t lĂ  so tĂ i giá»¯a nhiá»u ngÆ°á»i. KhĂ´ng cĂ³ báº¥t ká»³ logic nĂ o trong Backend há»— trá»£ tá»• chá»©c má»™t cuá»™c thi theo thá»ƒ thá»©c "Solo Practice".
* **Káº¿t luáº­n:** **KHĂ”NG Há»¢P Lá»† Vá»I NGHIá»†P Vá»¤ GIáº¢I Äáº¤U (CHá»ˆ DĂ€NH CHO Tá»° Há»ŒC).**

### 4. FormatId 4: "Team Debate"
* **Ká»³ vá»ng nghiá»‡p vá»¥:** Giáº£i Ä‘áº¥u Ä‘á»“ng Ä‘á»™i. Theo tĂ i liá»‡u Ä‘áº·c táº£ cá»§a dá»± Ă¡n lĂ  **Team 2v2** (Captain + 1 Member = 2 ngÆ°á»i).
* **Thá»±c táº¿ Backend:**
  * Báº£ng `DebateFormats` trong SQL seed láº¡i Ä‘á»‹nh nghÄ©a `Team Debate` cĂ³ `MaxParticipants = 6` (tá»©c 3v3).
  * Trong khi Ä‘Ă³, cĂ¡c Controller `CompetitionTeamsController.cs` vĂ  `CompetitionTeamRequestsController.cs` láº¡i code theo nghiá»‡p vá»¥ Ä‘á»™i 2 ngÆ°á»i (Captain + 1 Member).
  * Giá»‘ng nhÆ° FormatId 2, thá»ƒ thá»©c nĂ y thiáº¿u toĂ n bá»™ pháº§n Bracket vĂ  Match trĂªn Backend.
* **Káº¿t luáº­n:** **XUNG Äá»˜T SCHEMA GIá»®A DATABASE SEED (6 NGÆ¯á»œI) VĂ€ CONTROLLER (2 NGÆ¯á»œI). THIáº¾U Táº¦NG BRACKET/MATCH.**

### 5. TrÆ°á»ng "Máº·c Ä‘á»‹nh há»‡ thá»‘ng" trĂªn UI (`CompetitionFormModal.tsx:296`)
* Khi ngÆ°á»i dĂ¹ng Ä‘á»ƒ `-- Máº·c Ä‘á»‹nh há»‡ thá»‘ng --`:
  * GiĂ¡ trá»‹ gá»­i lĂªn lĂ  `formatId: undefined`.
  * Dá»¯ liá»‡u lÆ°u vĂ o Database: `Competitions.FormatId = NULL`.
  * Backend **KHĂ”NG tá»± Ä‘á»™ng gĂ¡n** vá» FormatId 1 hay 2. Cá»™t `FormatId` bá»‹ Ä‘á»ƒ trá»‘ng `NULL`.

---

## PHáº¦N D â€“ PHĂ‚N TĂCH CHUYĂN SĂ‚U Lá»–I GIĂM SĂT (MONITORING BUG)

### 1. Hiá»‡n tÆ°á»£ng
Khi Organizer hoáº·c Judge nháº¥n nĂºt **"VĂ o phĂ²ng giĂ¡m sĂ¡t & cháº¥m thi"** hoáº·c **"GiĂ¡m sĂ¡t & Cháº¥m thi"**, mĂ n hĂ¬nh bá»‹ chuyá»ƒn hÆ°á»›ng sang:
`/debater/debate/session-comp-2`
Táº¡i Ä‘Ă¢y:
* Giao diá»‡n hiá»ƒn thá»‹ y há»‡t mĂ n hĂ¬nh cá»§a ThĂ­ sinh (Debater).
* CĂ³ Ă´ nháº­p vÄƒn báº£n láº­p luáº­n, nĂºt báº¥m gá»­i phĂ¡t biá»ƒu, nĂºt ghi Ă¢m micro.
* Hiá»ƒn thá»‹ phe PRO / CON.
* KhĂ´ng cĂ³ báº£ng Ä‘iá»ƒm, khĂ´ng cĂ³ há»“ sÆ¡ cháº¥m thi, khĂ´ng cĂ³ cháº¿ Ä‘á»™ xem thá»¥ Ä‘á»™ng (Read-only).

### 2. NguyĂªn nhĂ¢n gá»‘c rá»… (Root Cause Analysis)

#### A. Táº¡i cĂ¡c nĂºt báº¥m má»Ÿ phĂ²ng thi (Frontend UI):
* File [`CompetitionAdminDetailModal.tsx`](file:///d:/KĂ¬_9_FPT/KLTN/Front-end-ADPP/src/components/competition/CompetitionAdminDetailModal.tsx) dĂ²ng 548:
  ```tsx
  onClick={() => {
    onClose();
    navigate(`/debater/debate/session-comp-${competition.competitionId}`);
  }}
  ```
* File [`Competitions.tsx`](file:///d:/KĂ¬_9_FPT/KLTN/Front-end-ADPP/src/pages/debater/Competitions/Competitions.tsx) dĂ²ng 662:
  ```tsx
  onClick={() => navigate(`/debater/debate/session-comp-${comp.competitionId}`)}
  ```
* File [`CompetitionDetailModal.tsx`](file:///d:/KĂ¬_9_FPT/KLTN/Front-end-ADPP/src/components/competition/CompetitionDetailModal.tsx) cĂ¡c dĂ²ng 614, 643, 875, 1109 Ä‘á»u `navigate` vá» cĂ¹ng chuá»—i template literal:
  ```tsx
  `/debater/debate/session-comp-${competition.competitionId}`
  ```

#### B. Táº¡i bá»™ xá»­ lĂ½ phĂ²ng thi [`DebateRoom.tsx`](file:///d:/KĂ¬_9_FPT/KLTN/Front-end-ADPP/src/pages/debater/DebatePractice/DebateRoom.tsx):
1. **Ă‰p kiá»ƒu ID tháº¥t báº¡i:**
   * DĂ²ng 226-227:
     ```tsx
     const numSessionId = parseInt(sessionId, 10);
     const isBackendSession = !isNaN(numSessionId) && numSessionId > 0;
     ```
   * Khi `sessionId = "session-comp-2"`, hĂ m `parseInt("session-comp-2", 10)` tráº£ vá» `NaN`.
   * Há»‡ quáº£: `isBackendSession = false`! `DebateRoom` káº¿t luáº­n Ä‘Ă¢y khĂ´ng pháº£i phiĂªn tá»« Backend vĂ  **khĂ´ng gá»i báº¥t ká»³ API nĂ o Ä‘á»ƒ táº£i dá»¯ liá»‡u tháº­t**.
2. **Fallback vá» phiĂªn AI Practice rá»—ng trong bá»™ nhá»›:**
   * DĂ²ng 236-238: Do `!isBackendSession`, biáº¿n `isAiSession` bá»‹ Ă©p thĂ nh `true`. PhĂ²ng thi rÆ¡i vĂ o cháº¿ Ä‘á»™ luyá»‡n táº­p AI giáº£ láº­p.
3. **Hardcode vai trĂ² ngÆ°á»i dĂ¹ng:**
   * DĂ²ng 1511 vĂ  1901:
     ```tsx
     <DebateHeader ... userRoleInRoom="Debater" />
     <DebateSidebar ... userRoleInRoom="Debater" />
     ```
   * GiĂ¡ trá»‹ `userRoleInRoom` bá»‹ gĂ¡n cá»©ng lĂ  `"Debater"`, hoĂ n toĂ n khĂ´ng kiá»ƒm tra xem ngÆ°á»i dĂ¹ng hiá»‡n táº¡i cĂ³ pháº£i lĂ  Organizer, Judge hay Spectator hay khĂ´ng.
4. **KhĂ´ng kiá»ƒm tra quyá»n truy cáº­p:**
   * Báº¥t ká»³ ngÆ°á»i dĂ¹ng nĂ o gĂµ URL `/debater/debate/session-comp-{id}` Ä‘á»u cĂ³ thá»ƒ vĂ o phĂ²ng, khĂ´ng cĂ³ middleware hoáº·c guard nĂ o xĂ¡c thá»±c quyá»n GiĂ¡m sĂ¡t.

---

## PHáº¦N E â€“ PHĂ‚N TĂCH SESSION ID: THá»°C Táº¾ vs GIáº¢ Láº¬P

### 1. Session tháº­t trong há»‡ thá»‘ng Ä‘Æ°á»£c táº¡o á»Ÿ Ä‘Ă¢u?
* Trong cÆ¡ sá»Ÿ dá»¯ liá»‡u (`DebateSessions`), má»™t phiĂªn tranh biá»‡n tháº­t chá»‰ Ä‘Æ°á»£c táº¡o qua:
  * `POST /api/Debate/ai-practice` (`DebateService.cs:34`) â†’ Sinh `DebateSessionId` dáº¡ng sá»‘ nguyĂªn (VD: `101`, `102`).
  * `POST /api/Debate/p2p` (`DebateService.cs:100`) â†’ Sinh `DebateSessionId` dáº¡ng sá»‘ nguyĂªn.
  * `POST /api/Debate/2v2` (`DebateService.cs:344`) â†’ Sinh `DebateSessionId` dáº¡ng sá»‘ nguyĂªn.

### 2. Sá»± thiáº¿u liĂªn káº¿t vá»›i Cuá»™c thi (Competition)
* Entity `DebateSession` (`DebateSession.cs:9-29`) **khĂ´ng há» cĂ³ trÆ°á»ng `CompetitionId`**.
* Trong SQL schema (`AIDebate-V0.7.sql:1547`), má»‘i liĂªn káº¿t duy nháº¥t Ä‘Æ°á»£c thiáº¿t káº¿ lĂ :
  * Báº£ng `CompetitionMatches` cĂ³ cá»™t `DebateSessionId INT NULL` trá» Ä‘áº¿n `DebateSessions(DebateSessionId)`.
* **Tuy nhiĂªn:** Do báº£ng `CompetitionMatches` chÆ°a Ä‘Æ°á»£c Ä‘Æ°a vĂ o mĂ£ nguá»“n C# cá»§a Backend, nĂªn hiá»‡n táº¡i **khĂ´ng cĂ³ báº¥t ká»³ cÆ¡ cháº¿ nĂ o káº¿t ná»‘i má»™t `DebateSession` vá»›i má»™t cuá»™c thi `Competition`**.
* Chuá»—i `"session-comp-2"` hoĂ n toĂ n lĂ  má»™t giĂ¡ trá»‹ **hardcode giáº£ láº­p á»Ÿ Frontend** nháº±m má»¥c Ä‘Ă­ch demo giao diá»‡n, khĂ´ng há» tá»“n táº¡i trong cÆ¡ sá»Ÿ dá»¯ liá»‡u.

---

## PHáº¦N F â€“ DANH SĂCH MOCK & HARDCODE TOĂ€N Bá»˜ FRONTEND

DÆ°á»›i Ä‘Ă¢y lĂ  danh sĂ¡ch chi tiáº¿t cĂ¡c vá»‹ trĂ­ Ä‘ang sá»­ dá»¥ng giĂ¡ trá»‹ hardcode vĂ  mock trong luá»“ng Cuá»™c thi á»Ÿ mĂ´i trÆ°á»ng cháº¡y (Production UI):

1. **Chuá»—i Session ID giáº£ láº­p:**
   * `src/components/competition/CompetitionAdminDetailModal.tsx:548`: `navigate('/debater/debate/session-comp-' + competition.competitionId)`
   * `src/components/competition/CompetitionDetailModal.tsx:614`: `navigate('/debater/debate/session-comp-' + competition.competitionId)`
   * `src/components/competition/CompetitionDetailModal.tsx:643`: `navigate('/debater/debate/session-comp-' + competition.competitionId)`
   * `src/components/competition/CompetitionDetailModal.tsx:875`: `navigate('/debater/debate/session-comp-' + competition.competitionId)`
   * `src/components/competition/CompetitionDetailModal.tsx:1109`: `navigate('/debater/debate/session-comp-' + competition.competitionId)`
   * `src/pages/debater/Competitions/Competitions.tsx:662`: `navigate('/debater/debate/session-comp-' + comp.competitionId)`
2. **GĂ¡n cá»©ng vai trĂ² Debater trong phĂ²ng tranh biá»‡n:**
   * `src/pages/debater/DebatePractice/DebateRoom.tsx:1511`: `userRoleInRoom="Debater"`
   * `src/pages/debater/DebatePractice/DebateRoom.tsx:1901`: `userRoleInRoom="Debater"`
3. **GiĂ¡ trá»‹ FormatId hardcode tÄ©nh trĂªn dropdown táº¡o giáº£i:**
   * `src/components/competition/CompetitionFormModal.tsx:297-300`: GĂ¡n cá»©ng 4 giĂ¡ trá»‹ `<option value="1">`, `<option value="2">`, `<option value="3">`, `<option value="4">` mĂ  khĂ´ng kiá»ƒm tra xem thá»ƒ thá»©c Ä‘Ă³ Backend cĂ³ há»— trá»£ quy trĂ¬nh thi Ä‘áº¥u hay khĂ´ng.
4. **Mock trong Unit Test:**
   * `src/test/competitionDebateLifecycle.test.ts`: Mock toĂ n bá»™ `axiosClient` Ä‘á»ƒ pass 24 bĂ i test vá»›i dá»¯ liá»‡u giáº£ láº­p vá» Bracket, Match, Review vĂ  Finalize (trong khi Backend tháº­t chÆ°a há» cĂ³ cĂ¡c API nĂ y).

---

## PHáº¦N G â€“ DANH SĂCH API THIáº¾U HOáº¶C KHĂ”NG KHá»P

### 1. API Ä‘Ă£ cĂ³ trĂªn Backend nhÆ°ng Frontend chÆ°a dĂ¹ng Ä‘Ăºng hoáº·c thiáº¿u xá»­ lĂ½
* `POST /api/Competitions/{id}/start`: Frontend gá»i khi cuá»™c thi á»Ÿ `RegistrationClosed`, nhÆ°ng Backend chá»‰ Ä‘á»•i cá» status sang `Ongoing` mĂ  khĂ´ng kiá»ƒm tra hay sinh cĂ¡c tráº­n Ä‘áº¥u.
* `POST /api/Competitions/{id}/complete`: Frontend cĂ³ nĂºt báº¥m gá»i API nĂ y, nhÆ°ng theo tĂ i liá»‡u thiáº¿t káº¿ thĂ¬ cuá»™c thi chá»‰ Ä‘Æ°á»£c hoĂ n táº¥t khi tráº­n Chung káº¿t cĂ³ káº¿t quáº£. Náº¿u báº¥m thá»§ cĂ´ng sáº½ gĂ¢y sai lá»‡ch tiáº¿n trĂ¬nh.

### 2. API hoĂ n toĂ n CHÆ¯A CĂ“ TRĂN BACKEND (Chá»‰ má»›i cĂ³ trong tĂ i liá»‡u vĂ  file test FE)
ToĂ n bá»™ nhĂ³m API Quáº£n lĂ½ VĂ²ng Ä‘áº¥u & Tráº­n Ä‘áº¥u Ä‘Æ¡n loáº¡i (Single Elimination Tournament) Ä‘á»u **CHÆ¯A CĂ“ TRONG BACKEND C#**:
1. `POST /api/competitions/{competitionId}/bracket` (Sinh Bracket) â†’ **404 Not Found**
2. `GET /api/competitions/{competitionId}/bracket` (Láº¥y dá»¯ liá»‡u Bracket & Champion) â†’ **404 Not Found**
3. `PUT /api/competitions/{competitionId}/matches/{matchId}/judge` (GĂ¡n GiĂ¡m kháº£o cho tráº­n) â†’ **404 Not Found**
4. `POST /api/Competitions/matches/{matchId}/prepare-debate` (Táº¡o phiĂªn DebateSession cho tráº­n) â†’ **404 Not Found**
5. `GET /api/competitions/{competitionId}/matches/{matchId}/review` (Xem há»“ sÆ¡ cháº¥m Ä‘iá»ƒm tráº­n Ä‘áº¥u) â†’ **404 Not Found**
6. `POST /api/competitions/{competitionId}/matches/{matchId}/finalize` (GiĂ¡m kháº£o chá»‘t Ä‘iá»ƒm vĂ  Ä‘áº©y Winner) â†’ **404 Not Found**
7. `POST /api/Debate/{sessionId}/evaluate` & `GET /api/Debate/{sessionId}/evaluation` (TĂ­ch há»£p AI Judgement cá»§a Backend) â†’ **404 Not Found** (Hiá»‡n táº¡i FE Ä‘ang gá»i sang Python AI Evaluator port 8000 chá»© Backend .NET chÆ°a cĂ³ endpoint nĂ y).

---

## PHáº¦N H â€“ Káº¾ HOáº CH Sá»¬A THEO Má»¨C Äá»˜ Æ¯U TIĂN

### Má»¨C Äá»˜ P0 â€“ Lá»–I NGHIá»†P Vá»¤ & Há»† THá»NG NGHIĂM TRá»ŒNG (BLOCKER)
1. **Triá»ƒn khai táº§ng Tournament trĂªn Backend .NET:**
   * Táº¡o cĂ¡c Entity DAL: `CompetitionRound`, `CompetitionMatch`, `MatchParticipant`, `JudgeScore` khá»›p vá»›i báº£ng 34, 36, 37, 38 trong SQL.
   * ThĂªm `DbSet` tÆ°Æ¡ng á»©ng vĂ o `SystemDbContext.cs` vĂ  cáº¥u hĂ¬nh quan há»‡ khĂ³a ngoáº¡i.
   * Viáº¿t `CompetitionTournamentService` vĂ  `CompetitionTournamentController` Ä‘á»ƒ cung cáº¥p 6 endpoint cá»‘t lĂµi: sinh bracket, xem bracket, gĂ¡n judge, prepare debate, review vĂ  finalize.
2. **Sá»­a dá»©t Ä‘iá»ƒm lá»—i GiĂ¡m sĂ¡t thi Ä‘áº¥u (Monitoring Bug):**
   * XĂ³a bá» hoĂ n toĂ n chuá»—i Ä‘iá»u hÆ°á»›ng hardcode `session-comp-${competitionId}`.
   * XĂ¢y dá»±ng mĂ n hĂ¬nh/cháº¿ Ä‘á»™ **GiĂ¡m sĂ¡t thi Ä‘áº¥u thá»±c sá»± (Read-only)**:
     * Nháº­n `debateSessionId` thá»±c táº¿ cá»§a tráº­n Ä‘áº¥u.
     * Kiá»ƒm tra quyá»n ngÆ°á»i dĂ¹ng (`isJudge`, `isOrganizer`, `isSpectator`).
     * Khi lĂ  GiĂ¡m sĂ¡t/KhĂ¡n giáº£: áº¨n toĂ n bá»™ Ă´ nháº­p liá»‡u speech input, nĂºt ghi Ă¢m; chá»‰ hiá»ƒn thá»‹ transcript realtime vĂ  thĂ´ng tin cĂ¡c bĂªn.
     * Khi lĂ  GiĂ¡m kháº£o (`isJudge`): Hiá»ƒn thá»‹ thĂªm Panel cháº¥m Ä‘iá»ƒm theo tiĂªu chĂ­ (`criteria`) vĂ  nĂºt chá»‘t káº¿t quáº£ (`finalize`).

### Má»¨C Äá»˜ P1 â€“ THIáº¾U TĂNH NÄ‚NG Cá»T LĂ•I (CORE FEATURES)
1. **HoĂ n thiá»‡n Giao diá»‡n CĂ¢y thi Ä‘áº¥u (Bracket UI) á»Ÿ Frontend:**
   * ThĂªm Tab **"CĂ¢y thi Ä‘áº¥u (Bracket)"** vĂ o cáº£ `CompetitionAdminDetailModal.tsx` vĂ  `CompetitionDetailModal.tsx`.
   * Hiá»ƒn thá»‹ trá»±c quan cĂ¡c vĂ²ng Ä‘áº¥u (VĂ²ng 16, Tá»© káº¿t, BĂ¡n káº¿t, Chung káº¿t), cĂ¡c cáº·p Ä‘áº¥u PRO/CON, tráº¡ng thĂ¡i tráº­n (`Ready`, `Ongoing`, `Evaluating`, `Completed`, `Bye`).
   * Cung cáº¥p nĂºt báº¥m thao tĂ¡c cho BTC: "Sinh Bracket" (á»Ÿ tráº¡ng thĂ¡i `RegistrationClosed`), "PhĂ¢n cĂ´ng GiĂ¡m kháº£o", "Chuáº©n bá»‹ tráº­n Ä‘áº¥u" (chá»n Topic).
2. **Xá»­ lĂ½ rĂµ rĂ ng cĂ¡c thá»ƒ thá»©c thi Ä‘áº¥u (FormatId):**
   * Táº¡m thá»i vĂ´ hiá»‡u hĂ³a hoáº·c áº©n FormatId 1 ("User vs AI") vĂ  FormatId 3 ("Solo Practice") khá»i dropdown táº¡o giáº£i Ä‘áº¥u, hoáº·c ghi chĂº rĂµ "Sáº¯p ra máº¯t" vĂ¬ Backend hiá»‡n táº¡i chá»‰ thiáº¿t káº¿ thi Ä‘áº¥u Ä‘á»‘i khĂ¡ng giá»¯a ngÆ°á»i vá»›i ngÆ°á»i (1v1 vĂ  Team 2v2).
   * Äá»“ng bá»™ láº¡i quy mĂ´ thĂ nh viĂªn cá»§a FormatId 4 giá»¯a DB vĂ  code thĂ nh Ä‘Ăºng 2 ngÆ°á»i/Ä‘á»™i (2v2).

### Má»¨C Äá»˜ P2 â€“ Cáº¢I THIá»†N TRáº¢I NGHIá»†M & HOĂ€N THIá»†N LUá»’NG (UI/UX)
1. **Vinh danh QuĂ¡n quĂ¢n (Champion):** Khi tráº­n Chung káº¿t hoĂ n táº¥t vĂ  cuá»™c thi chuyá»ƒn sang `Completed`, hiá»ƒn thá»‹ Banner/CĂºp vinh danh QuĂ¡n quĂ¢n (`championName`) trĂªn giao diá»‡n chi tiáº¿t cuá»™c thi.
2. **Äá»“ng bá»™ tráº¡ng thĂ¡i cuá»™c thi:** Tá»± Ä‘á»™ng vĂ´ hiá»‡u hĂ³a nĂºt "Báº¯t Ä‘áº§u cuá»™c thi" náº¿u chÆ°a sinh nhĂ¡nh Ä‘áº¥u; cáº£nh bĂ¡o Ä‘iá»u kiá»‡n sá»‘ lÆ°á»£ng thĂ­ sinh/Ä‘á»™i trÆ°á»›c khi sinh bracket.

---

*BĂ¡o cĂ¡o Ä‘Æ°á»£c láº­p ngĂ y 08/11/2026 bá»Ÿi Senior Fullstack QA Auditor. TuĂ¢n thá»§ tuyá»‡t Ä‘á»‘i quy táº¯c: KhĂ´ng tá»± Ă½ sá»­a code khi chÆ°a cĂ³ sá»± phĂª duyá»‡t tá»« cáº¥p quáº£n trá»‹.*

