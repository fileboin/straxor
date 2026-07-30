export interface PaymentAdapter {
  name: string;
  displayName: string;
  supportedCurrencies: string[];
  createCheckout(options: CheckoutOptions): Promise<CheckoutResult>;
  verifyPayment(paymentId: string): Promise<VerificationResult>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
}

export interface CheckoutOptions {
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  userId: string;
  userEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  url: string;
  checkoutId: string;
  amount: number;
  currency: string;
}

export interface VerificationResult {
  verified: boolean;
  paymentId: string;
  status: "completed" | "pending" | "failed" | "refunded";
  amount: number;
  currency: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export interface PaymentRecord {
  id: string;
  packageId: string;
  packageName: string;
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  provider: string;
  createdAt: string;
  completedAt?: string;
}
