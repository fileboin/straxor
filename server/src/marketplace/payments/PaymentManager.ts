import type { PaymentAdapter, CheckoutOptions, CheckoutResult, VerificationResult, RefundResult, PaymentRecord } from "./interfaces.js";

export class PaymentManager {
  private adapters = new Map<string, PaymentAdapter>();
  private records = new Map<string, PaymentRecord[]>();

  registerAdapter(adapter: PaymentAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  unregisterAdapter(name: string): void {
    this.adapters.delete(name);
  }

  getAdapter(name: string): PaymentAdapter | undefined {
    return this.adapters.get(name);
  }

  listAdapters(): PaymentAdapter[] {
    return Array.from(this.adapters.values());
  }

  async createCheckout(adapterName: string, options: CheckoutOptions): Promise<CheckoutResult> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) throw new Error(`Payment adapter "${adapterName}" not found`);

    const result = await adapter.createCheckout(options);

    const record: PaymentRecord = {
      id: result.checkoutId,
      packageId: options.packageId,
      packageName: options.packageName,
      userId: options.userId,
      amount: options.amount,
      currency: options.currency,
      status: "pending",
      provider: adapterName,
      createdAt: new Date().toISOString(),
    };

    const userRecords = this.records.get(options.userId) ?? [];
    userRecords.push(record);
    this.records.set(options.userId, userRecords);

    return result;
  }

  async verifyPayment(adapterName: string, paymentId: string): Promise<VerificationResult> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) throw new Error(`Payment adapter "${adapterName}" not found`);

    const result = await adapter.verifyPayment(paymentId);

    for (const records of this.records.values()) {
      const record = records.find(r => r.id === paymentId);
      if (record) {
        record.status = result.status;
        if (result.status === "completed") record.completedAt = new Date().toISOString();
      }
    }

    return result;
  }

  async refund(adapterName: string, paymentId: string, amount?: number): Promise<RefundResult> {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) throw new Error(`Payment adapter "${adapterName}" not found`);

    const result = await adapter.refund(paymentId, amount);

    if (result.success) {
      for (const records of this.records.values()) {
        const record = records.find(r => r.id === paymentId);
        if (record) record.status = "refunded";
      }
    }

    return result;
  }

  getPaymentRecords(userId: string): PaymentRecord[] {
    return this.records.get(userId) ?? [];
  }

  getAllPaymentRecords(): PaymentRecord[] {
    const all: PaymentRecord[] = [];
    for (const records of this.records.values()) all.push(...records);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
