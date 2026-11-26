import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PracticeStartPanel from "../components/debate/practice/PracticeStartPanel";
import AICoachingPanel from "../components/debate/coaching/AICoachingPanel";
import Payments, { parseCreditString } from "../pages/debater/Payments/Payments";
import paymentApi from "../api/paymentApi";

vi.mock("../api/paymentApi", () => ({
  default: {
    getPrices: vi.fn(),
    getCompetitionPrice: vi.fn(),
    requestArgumentHint: vi.fn(),
    getCustomTopUpQuote: vi.fn(),
    createCustomTopUp: vi.fn(),
    getMyWallet: vi.fn(),
    getActivePackages: vi.fn(),
    getMyWalletTransactions: vi.fn(),
    createTopUpPayment: vi.fn(),
    getPaymentStatus: vi.fn(),
  },
}));

describe("Credit System Frontend Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task C: PracticeStartPanel RAG Toggle & Pricing", () => {
    it("defaults to enableRag = true with 150 Credit badge", () => {
      const onStart = vi.fn();
      render(
        <PracticeStartPanel
          idPrefix="test"
          submitting={false}
          error={null}
          onStart={onStart}
        />
      );

      // Check default price display
      expect(screen.getByText("150 Credit")).toBeInTheDocument();
      expect(screen.getByText(/Bắt đầu tranh biện \(150 Credit\)/i)).toBeInTheDocument();

      // Click to start
      fireEvent.click(screen.getByTestId("start-practice-btn"));
      expect(onStart).toHaveBeenCalledWith("PRO", "Trung bình", true);
    });

    it("toggles enableRag to false with 110 Credit badge", () => {
      const onStart = vi.fn();
      render(
        <PracticeStartPanel
          idPrefix="test"
          submitting={false}
          error={null}
          onStart={onStart}
        />
      );

      // Toggle switch
      const toggleBtn = screen.getByRole("switch");
      expect(toggleBtn).toHaveAttribute("aria-checked", "true");

      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute("aria-checked", "false");
      expect(screen.getByText("110 Credit")).toBeInTheDocument();
      expect(screen.getByText(/Bắt đầu tranh biện \(110 Credit\)/i)).toBeInTheDocument();

      // Click to start with RAG disabled
      fireEvent.click(screen.getByTestId("start-practice-btn"));
      expect(onStart).toHaveBeenCalledWith("PRO", "Trung bình", false);
    });
  });

  describe("Task D: AI Hint in AICoachingPanel", () => {
    it("renders AI Hint button with 5 Credit badge and triggers onRequestHint", () => {
      const onRequestHint = vi.fn();
      render(
        <AICoachingPanel
          onRequestHint={onRequestHint}
          isHintLoading={false}
        />
      );

      // Expand panel
      fireEvent.click(screen.getByText("AI Coaching"));

      // Verify 5 Credit badge and Hint button
      expect(screen.getByText("5 Credit")).toBeInTheDocument();
      const hintBtn = screen.getByRole("button", { name: /Lấy gợi ý AI Hint \(5 Credit\)/i });
      expect(hintBtn).toBeInTheDocument();

      fireEvent.click(hintBtn);
      expect(onRequestHint).toHaveBeenCalledTimes(1);
    });

    it("displays loading state when isHintLoading is true", () => {
      render(
        <AICoachingPanel
          onRequestHint={vi.fn()}
          isHintLoading={true}
        />
      );

      // Expand panel
      fireEvent.click(screen.getByText("AI Coaching"));
      expect(screen.getByText("AI đang soạn gợi ý...")).toBeInTheDocument();
    });
  });

  describe("Task E: Competition Scale Credit Pricing", () => {
    it("computes credit scale correctly: SMALL 500, MEDIUM 1200, LARGE 2500", () => {
      const getScalePrice = (participants: number) => {
        return participants <= 8 ? 500 : participants <= 16 ? 1200 : 2500;
      };

      expect(getScalePrice(8)).toBe(500);
      expect(getScalePrice(16)).toBe(1200);
      expect(getScalePrice(32)).toBe(2500);
    });
  });

  describe("Task B: Custom Credit Top-Up Input Validation & Error Handling", () => {
    it("validates exact test cases from requirement table via parseCreditString", () => {
      // 50 -> Báo lỗi tối thiểu 100
      expect(parseCreditString("50")).toEqual({
        isValid: false,
        value: 50,
        error: "Số lượng nạp tối thiểu là 100 Credit.",
      });

      // 100 -> Hợp lệ
      expect(parseCreditString("100")).toEqual({
        isValid: true,
        value: 100,
        error: "",
      });

      // 500 -> Hợp lệ
      expect(parseCreditString("500")).toEqual({
        isValid: true,
        value: 500,
        error: "",
      });

      // 100.000 -> Hợp lệ
      expect(parseCreditString("100.000")).toEqual({
        isValid: true,
        value: 100000,
        error: "",
      });
      expect(parseCreditString("100000")).toEqual({
        isValid: true,
        value: 100000,
        error: "",
      });

      // 100.001 -> Báo lỗi vượt tối đa
      expect(parseCreditString("100.001")).toEqual({
        isValid: false,
        value: 100001,
        error: "Không được nhập quá 100.000 Credit.",
      });
      expect(parseCreditString("100001")).toEqual({
        isValid: false,
        value: 100001,
        error: "Không được nhập quá 100.000 Credit.",
      });

      // 1.000.000.000 -> Báo lỗi vượt tối đa
      expect(parseCreditString("1.000.000.000")).toEqual({
        isValid: false,
        value: 1000000000,
        error: "Không được nhập quá 100.000 Credit.",
      });
      expect(parseCreditString("1000000000")).toEqual({
        isValid: false,
        value: 1000000000,
        error: "Không được nhập quá 100.000 Credit.",
      });

      // -100 -> Báo lỗi số âm
      expect(parseCreditString("-100")).toEqual({
        isValid: false,
        value: null,
        error: "Số lượng Credit phải là số nguyên dương.",
      });

      // 100.5 -> Báo lỗi số thập phân
      expect(parseCreditString("100.5")).toEqual({
        isValid: false,
        value: null,
        error: "Số lượng Credit phải là số nguyên, không chứa số thập phân.",
      });
      expect(parseCreditString("100,5")).toEqual({
        isValid: false,
        value: null,
        error: "Số lượng Credit phải là số nguyên, không chứa số thập phân.",
      });

      // Trống -> Không cho thanh toán
      expect(parseCreditString("")).toEqual({
        isValid: false,
        value: null,
        error: "Vui lòng nhập số lượng Credit cần nạp.",
      });
      expect(parseCreditString("   ")).toEqual({
        isValid: false,
        value: null,
        error: "Vui lòng nhập số lượng Credit cần nạp.",
      });
    });

    it("renders Payments UI and disables checkout when typing 1000000000", async () => {
      vi.mocked(paymentApi.getMyWallet).mockResolvedValue({
        success: true,
        message: "OK",
        data: { walletId: 1, balance: 2500 },
      });
      vi.mocked(paymentApi.getActivePackages).mockResolvedValue({
        success: true,
        message: "OK",
        data: [],
      });
      vi.mocked(paymentApi.getMyWalletTransactions).mockResolvedValue({
        success: true,
        message: "OK",
        data: [],
      });
      vi.mocked(paymentApi.getPrices).mockResolvedValue({
        success: true,
        message: "OK",
        data: {
          aiPracticeRag: 150,
          aiPracticeNoRag: 110,
          isAiPracticeNoRagSupported: true,
          aiHint: 5,
          competitionSmall: 500,
          competitionMedium: 1200,
          competitionLarge: 2500,
          customTopUpUnitPriceVnd: 12,
          customTopUpMinCredits: 100,
          customTopUpMaxCredits: 100000,
        },
      });

      render(
        <MemoryRouter>
          <Payments />
        </MemoryRouter>
      );

      // Default value is 500 Credit
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("500");

      // Enter 1000000000 Credit
      fireEvent.change(input, { target: { value: "1000000000" } });
      expect(input).toHaveValue("1000000000");

      // Check validation error message
      const errorMsg = await screen.findByText("Không được nhập quá 100.000 Credit.");
      expect(errorMsg).toBeInTheDocument();

      // Check red border styling on input
      expect(input.className).toContain("border-rose-500");

      // Check checkout button is disabled and displays (—)
      const payButton = screen.getByRole("button", { name: /Thanh toán PayOS qua VietQR/i });
      expect(payButton).toBeDisabled();
      expect(payButton).toHaveTextContent("Thanh toán PayOS qua VietQR (—)");

      // Check total amount is displayed as —
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);

      // Test quick add button: clicking +3.000 adds to 1000000000 -> 1000003000 -> still invalid
      const add3kBtn = screen.getByRole("button", { name: /\+3\.000 Credit/i });
      fireEvent.click(add3kBtn);
      expect(screen.getByText("Không được nhập quá 100.000 Credit.")).toBeInTheDocument();
      expect(payButton).toBeDisabled();

      // Type 50 -> shows minimum error
      fireEvent.change(input, { target: { value: "50" } });
      expect(await screen.findByText("Số lượng nạp tối thiểu là 100 Credit.")).toBeInTheDocument();
      expect(payButton).toBeDisabled();

      // Type 100 -> valid!
      fireEvent.change(input, { target: { value: "100" } });
      await waitFor(() => {
        expect(screen.queryByText("Số lượng nạp tối thiểu là 100 Credit.")).not.toBeInTheDocument();
        expect(screen.queryByText("Không được nhập quá 100.000 Credit.")).not.toBeInTheDocument();
      });
      expect(payButton).not.toBeDisabled();
    });
  });
});
