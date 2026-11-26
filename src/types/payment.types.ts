import { PaginationParams } from "./api.types";

export type PaymentStatus = "Pending" | "Success" | "Failed" | "Refunded";
export type PaymentMethod = "VNPAY" | "MOMO" | "BANK_TRANSFER" | "STRIPE";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: string[];
  isPopular?: boolean;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  description: string;
  transactionRef: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreatePaymentDto {
  planId?: string;
  competitionId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
}

export interface PaymentFilterParams extends PaginationParams {
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
}

export type LearnerCreditPackage = DebaterCreditPackage;
export interface DebaterCreditPackage {
  packageId: number;
  packageCode: string;
  packageName: string;
  price: number;
  currency: string;
  creditAmount: number;
  bonusCredit: number;
}

export interface WalletInfo {
  walletId: number;
  balance: number;
  updatedAt?: string | null;
}

export interface WalletTransactionItem {
  walletTransactionId: number;
  transactionType: string;
  sourceType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: number | null;
  description?: string | null;
  createdAt: string;
}

export interface CreateTopUpPaymentRequest {
  packageId: number;
}

export interface PaymentLinkResponse {
  paymentId: number;
  providerOrderCode: number;
  amount: number;
  currency: string;
  creditAmount: number;
  provider: string;
  status: string;
  checkoutUrl?: string;
  qrCode?: string;
}

export interface PaymentStatusResponse {
  paymentId: number;
  packageCode?: string;
  packageName?: string;
  amount: number;
  status: string;
  isCompleted: boolean;
}

export interface RewardStatusResponse {
  canClaimDailyLogin: boolean;
  dailyLoginAmount: number;
  canClaimFirstLogin: boolean;
  firstLoginAmount: number;
}

export interface RewardClaimResponse {
  rewardClaimId: number;
  ruleCode: string;
  creditAmount: number;
  newBalance: number;
  claimedAt: string;
}

export interface CreditPricesResponse {
  aiPracticeRag: number;
  aiPracticeNoRag: number;
  isAiPracticeNoRagSupported: boolean;
  aiHint: number;
  competitionSmall: number;
  competitionMedium: number;
  competitionLarge: number;
  customTopUpUnitPriceVnd: number;
  customTopUpMinCredits: number;
  customTopUpMaxCredits: number;
}

export interface CompetitionPriceResponse {
  scale: string;
  requiredCredits: number;
  maxParticipantsOrTeams: number;
  ruleCode: string;
}

export interface CustomTopUpQuoteResponse {
  creditAmount: number;
  unitPriceVnd: number;
  totalAmountVnd: number;
  currency: string;
  minCredits: number;
  maxCredits: number;
}

export interface CustomTopUpPaymentRequest {
  creditAmount: number;
  frontendOrigin?: string;
}

export interface ArgumentHintRequest {
  sessionId: number;
  argumentId?: number;
  roundNumber?: number;
  draftText?: string;
  requestId?: string;
}

export interface ArgumentHintResponse {
  creditsCharged: number;
  remainingBalance: number;
  hint: string;
}

export interface InsufficientCreditsErrorData {
  requiredCredits?: number;
  currentCredits?: number;
  missingCredits?: number;
}
