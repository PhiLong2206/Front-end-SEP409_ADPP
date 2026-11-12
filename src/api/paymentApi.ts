import axiosClient from "./axiosClient";
import {
  ApiResponse,
  DebaterCreditPackage,
  WalletInfo,
  WalletTransactionItem,
  CreateTopUpPaymentRequest,
  PaymentLinkResponse,
  PaymentStatusResponse,
  RewardStatusResponse,
  RewardClaimResponse,
} from "../types";

const paymentApi = {
  // Real Backend .NET 8 Credit Packages & Wallets
  /**
   * GET /api/credit-packages
   * Lấy danh sách các gói nạp credit đang mở bán cho học viên
   */
  getActivePackages: (): Promise<ApiResponse<DebaterCreditPackage[]>> =>
    axiosClient.get("/credit-packages"),

  /**
   * POST /api/payments/top-up
   * Tạo yêu cầu nạp điểm tín chỉ, sinh link PayOS và mã QR quét chuyển khoản
   */
  createTopUpPayment: (
    data: CreateTopUpPaymentRequest
  ): Promise<ApiResponse<PaymentLinkResponse>> =>
    axiosClient.post("/payments/top-up", data),

  /**
   * GET /api/payments/{paymentId}
   * Kiểm tra trạng thái giao dịch nạp tiền
   */
  getPaymentStatus: (paymentId: number | string): Promise<ApiResponse<PaymentStatusResponse>> =>
    axiosClient.get(`/payments/${paymentId}`),

  /**
   * GET /api/wallets/me
   * Lấy số dư ví hiện tại của người dùng
   */
  getMyWallet: (): Promise<ApiResponse<WalletInfo>> =>
    axiosClient.get("/wallets/me"),

  /**
   * GET /api/wallets/me/transactions
   * Lấy lịch sử biến động số dư và giao dịch nạp tiền của người dùng
   */
  getMyWalletTransactions: (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<WalletTransactionItem[]>> =>
    axiosClient.get("/wallets/me/transactions", { params }),

  /**
   * GET /api/rewards/status
   * Kiểm tra trạng thái nhận thưởng điểm danh hàng ngày & lần đầu đăng nhập
   */
  getRewardStatus: (): Promise<ApiResponse<RewardStatusResponse>> =>
    axiosClient.get("/rewards/status"),

  /**
   * POST /api/rewards/daily-login
   * Nhận thưởng điểm tín chỉ đăng nhập hàng ngày
   */
  claimDailyLoginReward: (): Promise<ApiResponse<RewardClaimResponse>> =>
    axiosClient.post("/rewards/daily-login"),
};

export default paymentApi;
