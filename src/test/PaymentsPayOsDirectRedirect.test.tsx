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
  },
}));

const mockPackages = [
  {
    packageId: 11,
    packageCode: "BASIC",
    packageName: "Gói Khởi Động",
    price: 50000,
    currency: "VNĐ",
    creditAmount: 50,
    bonusCredit: 5,
  },
];

describe("Payments - Direct PayOS Checkout Redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(paymentApi.getMyWallet).mockResolvedValue({
      success: true,
      message: "OK",
      data: { walletId: 1, balance: 100 },
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
  });

  it("chuyển hướng trực tiếp sang checkoutUrl của PayOS thay vì mở modal quét QR cục bộ", async () => {
    const payOsCheckoutUrl = "https://pay.payos.vn/web/test-order-checkout-123456";

    vi.mocked(paymentApi.createTopUpPayment).mockResolvedValue({
      success: true,
      message: "Payment link created successfully.",
      data: {
        paymentId: 1001,
        providerOrderCode: 1793707175147,
        amount: 50000,
        currency: "VNĐ",
        creditAmount: 55,
        provider: "PayOS",
        status: "Pending",
        checkoutUrl: payOsCheckoutUrl,
      },
    });

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    render(
      <MemoryRouter>
        <Payments />
      </MemoryRouter>
    );

    const topUpBtn = await screen.findByRole("button", { name: /Nạp ngay qua PayOS/i });
    expect(topUpBtn).toBeInTheDocument();

    fireEvent.click(topUpBtn);

    await waitFor(() => {
      expect(paymentApi.createTopUpPayment).toHaveBeenCalledWith({ packageId: 11 });
      expect(window.location.href).toBe(payOsCheckoutUrl);
    });

    // Không còn mở modal quét QR với ảnh fallback QR server
    expect(screen.queryByText(/Quét mã QR bằng ứng dụng Ngân hàng/i)).not.toBeInTheDocument();

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("hiển thị thông báo thành công khi PayOS redirect về với status=PAID", async () => {
    render(
      <MemoryRouter initialEntries={["/debater/payments?status=PAID&orderCode=1793707175147"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Thanh toán đơn hàng #1793707175147 thành công qua PayOS/i)
      ).toBeInTheDocument();
    });
  });

  it("hiển thị thông báo hủy khi PayOS redirect về với cancel=true", async () => {
    render(
      <MemoryRouter initialEntries={["/debater/payments?cancel=true&orderCode=1793707175147"]}>
        <Payments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Giao dịch đơn hàng #1793707175147 đã bị hủy/i)
      ).toBeInTheDocument();
    });
  });
});

