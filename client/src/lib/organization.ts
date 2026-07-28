import { api } from "./api.js";

// ── Types ──

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  billingEmail: string | null;
  plan: string;
  createdAt: string;
  updatedAt: string;
  role?: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
}

export interface OrgApiKey {
  id: string;
  orgId: string;
  provider: string;
  label: string | null;
  encryptedKey: string;
  createdBy: string | null;
  createdAt: string;
}

export interface OrgPolicy {
  id: string;
  orgId: string;
  type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLimit {
  id: string;
  orgId: string;
  projectId: string | null;
  monthlyLimit: number;
  currentUsage: number;
  currency: string;
  alertAtPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgDetail extends Organization {
  members: OrgMember[];
  apiKeys: OrgApiKey[];
  policies: OrgPolicy[];
  budgets: BudgetLimit[];
  userRole: string;
}

export interface OrgUsage {
  totalMonthlyBudget: number;
  totalCurrentUsage: number;
  usagePercent: number;
  providerCount: number;
  apiKeyCount: number;
  budgetCount: number;
  providers: string[];
}

// ── API ──

export async function listOrganizations(): Promise<Organization[]> {
  return api("/organizations");
}

export async function createOrganization(name: string, billingEmail?: string): Promise<Organization> {
  return api("/organizations", { method: "POST", body: JSON.stringify({ name, billingEmail }) });
}

export async function getOrganization(id: string): Promise<OrgDetail> {
  return api(`/organizations/${id}`);
}

export async function updateOrganization(id: string, data: { name?: string; billingEmail?: string; plan?: string }): Promise<Organization> {
  return api(`/organizations/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteOrganization(id: string): Promise<void> {
  await api(`/organizations/${id}`, { method: "DELETE" });
}

// Members
export async function addOrgMember(orgId: string, email: string, role?: string): Promise<OrgMember> {
  return api(`/organizations/${orgId}/members`, { method: "POST", body: JSON.stringify({ email, role }) });
}

export async function removeOrgMember(orgId: string, memberId: string): Promise<void> {
  await api(`/organizations/${orgId}/members/${memberId}`, { method: "DELETE" });
}

// API Keys
export async function listOrgApiKeys(orgId: string): Promise<OrgApiKey[]> {
  return api(`/organizations/${orgId}/api-keys`);
}

export async function addOrgApiKey(orgId: string, provider: string, key: string, label?: string): Promise<OrgApiKey> {
  return api(`/organizations/${orgId}/api-keys`, { method: "POST", body: JSON.stringify({ provider, key, label }) });
}

export async function deleteOrgApiKey(orgId: string, keyId: string): Promise<void> {
  await api(`/organizations/${orgId}/api-keys/${keyId}`, { method: "DELETE" });
}

// Policies
export async function listOrgPolicies(orgId: string): Promise<OrgPolicy[]> {
  return api(`/organizations/${orgId}/policies`);
}

export async function addOrgPolicy(orgId: string, data: { type: string; name: string; description?: string; config?: Record<string, unknown>; isEnabled?: boolean }): Promise<OrgPolicy> {
  return api(`/organizations/${orgId}/policies`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateOrgPolicy(orgId: string, policyId: string, data: { name?: string; description?: string; config?: Record<string, unknown>; isEnabled?: boolean }): Promise<OrgPolicy> {
  return api(`/organizations/${orgId}/policies/${policyId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteOrgPolicy(orgId: string, policyId: string): Promise<void> {
  await api(`/organizations/${orgId}/policies/${policyId}`, { method: "DELETE" });
}

// Budget
export async function listOrgBudgets(orgId: string): Promise<BudgetLimit[]> {
  return api(`/organizations/${orgId}/budgets`);
}

export async function addOrgBudget(orgId: string, data: { projectId?: string; monthlyLimit: number; currency?: string; alertAtPercent?: number }): Promise<BudgetLimit> {
  return api(`/organizations/${orgId}/budgets`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateOrgBudget(orgId: string, budgetId: string, data: { monthlyLimit?: number; currentUsage?: number; alertAtPercent?: number }): Promise<BudgetLimit> {
  return api(`/organizations/${orgId}/budgets/${budgetId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteOrgBudget(orgId: string, budgetId: string): Promise<void> {
  await api(`/organizations/${orgId}/budgets/${budgetId}`, { method: "DELETE" });
}

// Usage
export async function getOrgUsage(orgId: string): Promise<OrgUsage> {
  return api(`/organizations/${orgId}/usage`);
}
