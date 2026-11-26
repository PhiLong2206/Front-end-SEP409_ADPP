import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Payments from "../pages/debater/Payments/Payments";
import paymentApi from "../api/paymentApi";

vi.mock("../api/paymentApi", () => ({
  default: {
    getMyWallet: vi.fn(),
    getActivePackages: vi.fn(),
    getMyWalletTransactions: vi.fn(),
    createTopUpPayment: vi.fn(),
    getPaymentStatus: vi.fn(),
    getPaymentStatusByOrderCode: vi.fn(),
    cancelOrderByOrderCode: vi.fn(),
    getPrices: vi.fn(),
    getRewardStatus: vi.fn(),
    createCustomTopUp: vi.fn(),
    getCustomTopUpQuote: vi.fn(),
  },
}));

const mockPackages = [
  {
    packageId: 2,
    packageCode: "BASIC",
    packageName: "Gói Cơ Bản",
    price: 20000,
    currency: "VND",
    creditAmount: 2000,
    bonusCredit: 0,
  },
];

describe("PayOS Payment Lifecycle & Cancel Flow (PAY01 - PAY22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(paymentApi.getMyWallet).mockResolvedValue({
      success: true,
      message: "OK",
      data: { walletId: 4, balance: 95575, updatedAt: "" },
    });

    vi.mocked(paymentApi.getActivePackages).mockResolvedValue({
      success: true,
      message: "OK",
      data: mockPackages,
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

    vi.mocked(paymentApi.getRewardStatus).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        canClaimDailyLogin: true,
        dailyLoginAmount: 20,
        canClaimFirstLogin: false,
        firstLoginAmount: 200,
      },
    });

    vi.mocked(paymentApi.getCustomTopUpQuote).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        creditAmount: 500,
        unitPriceVnd: 12,
        totalAmountVnd: 6000,
        currency: "VND",
        minCredits: 100,
        maxCredits: 100000,
      },
    });
  });

  it("PAY01 & PAY02: Khi PayOS trả về cancel callback, tuyệt đối không hiển thị thông báo thành công và hiển thị banner hủy", async () => {
    vi.mocked(paymentApi.cancelOrderByOrderCode).mockResolvedValue({
      success: true,
      message: "Payment cancelled successfully.",
      data: {
        paymentId: 36,
        providerOrderCode: 1795713630001,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        status: "Cancelled",
        isCompleted: false,
        isCancelled: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&cancel=true&status=CANCELLED&orderCode=1795713630001"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Must show cancelled banner
      expect(
        screen.getByText(/Bạn đã hủy thanh toán đơn hàng #1795713630001/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Số dư Credit của bạn không thay đổi/i)
      ).toBeInTheDocument();
    });

    // CRITICAL: MUST NOT show success message even though code='00' was in URL
    expect(
      screen.queryByText(/thành công qua PayOS/i)
    ).not.toBeInTheDocument();
  });

  it("PAY03: Khi có cancel callback, hệ thống gọi API backend cancelOrderByOrderCode để đồng bộ trạng thái", async () => {
    vi.mocked(paymentApi.cancelOrderByOrderCode).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        paymentId: 36,
        providerOrderCode: 1795713630001,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        status: "Cancelled",
        isCompleted: false,
        isCancelled: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&cancel=true&status=CANCELLED&orderCode=1795713630001"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(paymentApi.cancelOrderByOrderCode).toHaveBeenCalledWith("1795713630001");
    });
  });

  it("PAY07 & PAY08: Khi thanh toán thành công (status=PAID), xác minh với backend trước khi hiển thị success banner", async () => {
    vi.mocked(paymentApi.getPaymentStatusByOrderCode).mockResolvedValue({
      success: true,
      message: "Success",
      data: {
        paymentId: 37,
        providerOrderCode: 1795713630002,
        amount: 50000,
        currency: "VND",
        creditAmount: 5200,
        status: "Paid",
        isCompleted: true,
        isCancelled: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&status=PAID&orderCode=1795713630002"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(paymentApi.getPaymentStatusByOrderCode).toHaveBeenCalledWith("1795713630002");
      expect(
        screen.getByText(/Thanh toán đơn hàng #1795713630002 thành công qua PayOS/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/\+5\.200 Credit/i)
      ).toBeInTheDocument();
    });
  });

  it("PAY11: Giả mạo code=00 nhưng backend trả về Pending hoặc Cancelled thì không hiển thị success banner", async () => {
    vi.mocked(paymentApi.getPaymentStatusByOrderCode).mockResolvedValue({
      success: true,
      message: "Pending",
      data: {
        paymentId: 38,
        providerOrderCode: 1795713630003,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        status: "Pending",
        isCompleted: false,
        isCancelled: false,
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&orderCode=1795713630003"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(paymentApi.getPaymentStatusByOrderCode).toHaveBeenCalledWith("1795713630003");
    });

    // Should not show success
    expect(
      screen.queryByText(/thành công qua PayOS! \+/i)
    ).not.toBeInTheDocument();
  });

  it("PAY14: Khi người dùng chọn gói nạp khác sau khi hủy, các thông báo cũ bị xóa", async () => {
    vi.mocked(paymentApi.cancelOrderByOrderCode).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        paymentId: 36,
        providerOrderCode: 1795713630001,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        status: "Cancelled",
        isCompleted: false,
        isCancelled: true,
      },
    });

    vi.mocked(paymentApi.createTopUpPayment).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        paymentId: 39,
        providerOrderCode: 1795713630004,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        provider: "PayOS",
        status: "Pending",
        checkoutUrl: "https://pay.payos.vn/checkout-new",
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&cancel=true&status=CANCELLED&orderCode=1795713630001"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bạn đã hủy thanh toán đơn hàng #1795713630001/i)).toBeInTheDocument();
    });

    const topUpBtn = await screen.findByRole(
      "button",
      { name: /Nạp ngay qua PayOS/i },
      { timeout: 3000 }
    );
    fireEvent.click(topUpBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Bạn đã hủy thanh toán đơn hàng #1795713630001/i)).not.toBeInTheDocument();
    });
  });

  it("PAY15: Khi người dùng thay đổi số lượng credit nạp tự do, thông báo hủy thanh toán cũ bị xóa", async () => {
    vi.mocked(paymentApi.cancelOrderByOrderCode).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        paymentId: 36,
        providerOrderCode: 1795713630001,
        amount: 20000,
        currency: "VND",
        creditAmount: 2000,
        status: "Cancelled",
        isCompleted: false,
        isCancelled: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/debater/payments?code=00&cancel=true&status=CANCELLED&orderCode=1795713630001"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bạn đã hủy thanh toán đơn hàng #1795713630001/i)).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1000" } });

    await waitFor(() => {
      expect(screen.queryByText(/Bạn đã hủy thanh toán đơn hàng #1795713630001/i)).not.toBeInTheDocument();
    });
  });

  it("PAY13: Khi vào trang không có query params, không hiển thị bất kỳ thông báo thanh toán nào", async () => {
    render(
      <MemoryRouter initialEntries={["/debater/payments"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Ví điểm tín chỉ & Nạp Credit/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Bạn đã hủy thanh toán/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thành công qua PayOS/i)).not.toBeInTheDocument();
  });
});
