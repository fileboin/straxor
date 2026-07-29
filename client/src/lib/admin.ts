import { api } from "./api.js";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tariff {
  id: string;
  name: string;
  price: number;
  currency: string | null;
  billingCycle: string | null;
  maxProjects: number | null;
  maxAgents: number | null;
  maxRuntimes: number | null;
  maxMembers: number | null;
  storageLimit: number | null;
  bandwidthLimit: number | null;
  aiLimits: string | null;
  allowedIntegrations: string | null;
  features: string | null;
  isActive: boolean | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletAccount {
  id: string;
  userId: string;
  balance: number;
  currency: string | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string | null;
  description: string | null;
  reference: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tariffId: string | null;
  status: string | null;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: string | null;
  discountValue: number | null;
  maxUses: number | null;
  currentUses: number;
  minAmount: number | null;
  appliesToTariffs: string | null;
  expiresAt: string | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRegistryEntry {
  id: string;
  type: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  config: string | null;
  isEnabled: boolean | null;
  isBuiltin: boolean | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardStats {
  users: number;
  apiKeys: number;
  tariffs: number;
  subscriptions: number;
  wallets: number;
  featureFlags: { active: number; total: number };
}

// ── Feature Flags ──

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  return api("/admin/feature-flags");
}

export async function toggleFeatureFlag(id: string, isEnabled: boolean): Promise<FeatureFlag> {
  return api(`/admin/feature-flags/${id}`, { method: "PUT", body: { isEnabled } });
}

// ── Tariffs ──

export async function getTariffs(): Promise<Tariff[]> {
  return api("/admin/tariffs");
}

export async function createTariff(data: Partial<Tariff>): Promise<Tariff> {
  return api("/admin/tariffs", { method: "POST", body: data });
}

export async function updateTariff(id: string, data: Partial<Tariff>): Promise<Tariff> {
  return api(`/admin/tariffs/${id}`, { method: "PUT", body: data });
}

export async function deleteTariff(id: string): Promise<{ success: boolean }> {
  return api(`/admin/tariffs/${id}`, { method: "DELETE" });
}

// ── Registry ──

export async function getRegistry(type?: string): Promise<AdminRegistryEntry[]> {
  const params = type ? `?type=${encodeURIComponent(type)}` : "";
  return api(`/admin/registry${params}`);
}

export async function createRegistryEntry(data: Partial<AdminRegistryEntry>): Promise<AdminRegistryEntry> {
  return api("/admin/registry", { method: "POST", body: data });
}

export async function updateRegistryEntry(id: string, data: Partial<AdminRegistryEntry>): Promise<AdminRegistryEntry> {
  return api(`/admin/registry/${id}`, { method: "PUT", body: data });
}

export async function deleteRegistryEntry(id: string): Promise<{ success: boolean }> {
  return api(`/admin/registry/${id}`, { method: "DELETE" });
}

// ── Wallet ──

export async function getWallets(userId?: string): Promise<WalletAccount[]> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api(`/admin/wallet${params}`);
}

export async function creditWallet(userId: string, amount: number, description?: string): Promise<{ wallet: WalletAccount; transaction: WalletTransaction }> {
  return api("/admin/wallet/credit", { method: "POST", body: { userId, amount, description } });
}

export async function getWalletTransactions(walletId?: string): Promise<WalletTransaction[]> {
  const params = walletId ? `?walletId=${encodeURIComponent(walletId)}` : "";
  return api(`/admin/wallet/transactions${params}`);
}

// ── Subscriptions ──

export async function getSubscriptions(): Promise<Subscription[]> {
  return api("/admin/subscriptions");
}

export async function updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription> {
  return api(`/admin/subscriptions/${id}`, { method: "PUT", body: data });
}

// ── Promo Codes ──

export async function getPromoCodes(): Promise<PromoCode[]> {
  return api("/admin/promo-codes");
}

export async function createPromoCode(data: Partial<PromoCode>): Promise<PromoCode> {
  return api("/admin/promo-codes", { method: "POST", body: data });
}

export async function deletePromoCode(id: string): Promise<{ success: boolean }> {
  return api(`/admin/promo-codes/${id}`, { method: "DELETE" });
}

// ── Logs ──

export async function getAdminLogs(type?: string, limit = 50, offset = 0): Promise<{ logs: any[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return api(`/admin/logs?${params.toString()}`);
}

// ── Dashboard Stats ──

export async function getAdminDashboard(): Promise<AdminDashboardStats> {
  return api("/admin/dashboard");
}

// ── Plugins ──

export async function getPlugins(): Promise<any[]> {
  return api("/admin/plugins");
}

export async function createPlugin(data: any): Promise<any> {
  return api("/admin/plugins", { method: "POST", body: data });
}

export async function updatePlugin(id: string, data: any): Promise<any> {
  return api(`/admin/plugins/${id}`, { method: "PUT", body: data });
}

export async function deletePlugin(id: string): Promise<{ success: boolean }> {
  return api(`/admin/plugins/${id}`, { method: "DELETE" });
}

// ── API Keys (admin) ──

export async function getAdminApiKeys(providerId?: string): Promise<any[]> {
  const params = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
  return api(`/admin/api-keys${params}`);
}

export async function deleteAdminApiKey(id: string): Promise<{ success: boolean }> {
  return api(`/admin/api-keys/${id}`, { method: "DELETE" });
}

// ── Audit Logs ──

export async function getAuditLogs(severity?: string, action?: string, limit = 50, offset = 0): Promise<{ logs: any[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (severity) params.set("severity", severity);
  if (action) params.set("action", action);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return api(`/admin/audit-logs?${params.toString()}`);
}

// ── System Settings ──

export async function getSystemSettings(): Promise<any[]> {
  return api("/admin/settings");
}

export async function updateSystemSetting(id: string, value: string): Promise<any> {
  return api(`/admin/settings/${id}`, { method: "PUT", body: { value } });
}

// ── Notifications ──

export async function getAdminNotifications(): Promise<any[]> {
  return api("/admin/notifications");
}

export async function createAdminNotification(data: any): Promise<any> {
  return api("/admin/notifications", { method: "POST", body: data });
}

export async function updateAdminNotification(id: string, data: any): Promise<any> {
  return api(`/admin/notifications/${id}`, { method: "PUT", body: data });
}

export async function deleteAdminNotification(id: string): Promise<{ success: boolean }> {
  return api(`/admin/notifications/${id}`, { method: "DELETE" });
}

// ── Users (admin) ──

export async function blockUser(id: string, isBlocked: boolean): Promise<any> {
  return api(`/admin/users/${id}/block`, { method: "PUT", body: { isBlocked } });
}

export async function setUserPlan(id: string, plan: string): Promise<any> {
  return api(`/admin/users/${id}/plan`, { method: "PUT", body: { plan } });
}
