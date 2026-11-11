# Việc tồn đọng

## Chủ đề

- [ ] **Topic nên có trường `Motion` riêng, tách khỏi `Description`.** Khi tạo phiên AI theo `topicId`, Backend đang lấy kiến nghị từ `Topic.Description` (không có thì lấy `Title`). Đây là cách làm tạm. Việc này liên quan đến motion catalog.

- [ ] **Sau khi BE merge `fix/debate-session-lifecycle`, đổi FE đọc `difficulty` thay cho `sessionDifficulty` và bỏ field cũ.** BE trả độ khó đã chọn của phiên qua `difficulty` (không có thì lấy của topic), nên `sessionDifficulty` sẽ không bao giờ có giá trị. Sửa ở `DebateRoom.tsx` và `types/debate.types.ts`.

## Phòng tranh biện

- [ ] **Vào lại `session-comp-N` vẫn thấy trận đã xong.** State của phòng chỉ bị xoá khi xác nhận rời lúc trận còn dở. Trận đã xong thì không có hộp xác nhận, nên `adpp_debate_completed_` và các key khác còn lại trong `sessionStorage` của tab đó. Id phòng cố định theo giải đấu, và phòng giải đấu chưa có phiên Backend thật.

## Trang Tiến độ (`pages/debater/Progress/Progress.tsx`)

- [ ] **"Điểm trung bình" chưa có dữ liệu thật.** `avgScore` đang gán cứng `0` nên luôn hiện `--`. Chưa có API trả điểm: kết quả chấm hiện không được lưu ở Backend.
- [ ] **"Kỹ năng nổi bật" chưa có dữ liệu thật.** Đang là chữ cố định "Đang phân tích".
