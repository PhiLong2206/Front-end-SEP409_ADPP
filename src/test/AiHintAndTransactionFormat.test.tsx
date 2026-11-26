import { describe, it, expect } from "vitest";
import { formatAiHintContent } from "../utils/aiHintFormatter";

describe("formatAiHintContent", () => {
  it("formats string hints directly", () => {
    const raw = "Tập trung phản biện vào tính khả thi tài chính.";
    expect(formatAiHintContent(raw)).toBe(raw);
  });

  it("safely handles null and undefined without crashing", () => {
    expect(formatAiHintContent(null)).toBe("");
    expect(formatAiHintContent(undefined)).toBe("");
  });

  it("formats structured CoachingResult object into readable text", () => {
    const hintObj = {
      focus_criteria: [
        {
          name: "Tính logic",
          diagnosis: "Luận cứ chưa kết nối chặt chẽ với kết luận",
          methods: ["Sử dụng tam đoạn luận"],
          application: "Liên kết tiền đề A với hệ quả B",
        },
      ],
      idea_development: {
        core_claim: "Chính phủ cần tăng thuế carbon.",
        directions: [
          "So sánh với mô hình của Thụy Điển",
          "Phân tích tác động lên doanh nghiệp nhỏ",
        ],
        evidence_to_look_for: ["Báo cáo của IPCC năm 2023"],
      },
      raw_model_output: "```json\n{\"internal\": 123}\n```",
    };

    const formatted = formatAiHintContent(hintObj);

    // Verifies key business sections are preserved
    expect(formatted).toContain("💡 Luận điểm cốt lõi:");
    expect(formatted).toContain("Chính phủ cần tăng thuế carbon.");
    expect(formatted).toContain("🎯 Hướng phát triển lập luận:");
    expect(formatted).toContain("• So sánh với mô hình của Thụy Điển");
    expect(formatted).toContain("🔍 Bằng chứng / Ví dụ cần bổ sung:");
    expect(formatted).toContain("• Báo cáo của IPCC năm 2023");
    expect(formatted).toContain("⚖️ Trọng tâm cải thiện:");
    expect(formatted).toContain("📌 [Tính logic]: Luận cứ chưa kết nối chặt chẽ với kết luận");
    expect(formatted).toContain("Phương pháp: Sử dụng tam đoạn luận");
    expect(formatted).toContain("Áp dụng: Liên kết tiền đề A với hệ quả B");

    // Verifies raw_model_output is stripped
    expect(formatted).not.toContain("raw_model_output");
    expect(formatted).not.toContain("internal");
  });

  it("handles PascalCase properties as well", () => {
    const hintObj = {
      IdeaDevelopment: {
        CoreClaim: "Học trực tuyến cần được chuẩn hóa.",
        Directions: ["Cải thiện hạ tầng số"],
        EvidenceToLookFor: ["Khảo sát của UNESCO"],
      },
      FocusCriteria: [
        {
          Name: "Bằng chứng",
          Diagnosis: "Thiếu dữ liệu định lượng",
          Methods: ["Trích dẫn số liệu thống kê"],
          Application: "Đưa ra phần trăm cụ thể",
        },
      ],
    };

    const formatted = formatAiHintContent(hintObj);
    expect(formatted).toContain("💡 Luận điểm cốt lõi:\nHọc trực tuyến cần được chuẩn hóa.");
    expect(formatted).toContain("• Cải thiện hạ tầng số");
    expect(formatted).toContain("📌 [Bằng chứng]: Thiếu dữ liệu định lượng");
  });
});
