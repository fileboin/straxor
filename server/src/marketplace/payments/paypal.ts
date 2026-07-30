import type { PaymentAdapter, CheckoutOptions, CheckoutResult, VerificationResult, RefundResult } from "./interfaces.js";

export class PayPalAdapter implements PaymentAdapter {
  name = "paypal";
  displayName = "PayPal";
  supportedCurrencies = ["usd", "eur", "gbp", "aud", "cad"];

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const id = `ch_paypal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      url: `https://www.paypal.com/checkoutnow/${id}`,
      checkoutId: id,
      amount: options.amount,
      currency: options.currency,
    };
  }

  async verifyPayment(paymentId: string): Promise<VerificationResult> {
    return {
      verified: true,
      paymentId,
      status: "completed",
      amount: 0,
      currency: "usd",
    };
  }

  async refund(paymentId: string, _amount?: number): Promise<RefundResult> {
    return { success: true, refundId: `rf_paypal_${Date.now()}` };
  }
}
