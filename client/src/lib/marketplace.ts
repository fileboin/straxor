import { api } from "./api.js";

export interface MarketplaceItem {
  id: string;
  name: string;
  type: string;
  version: string;
  description: string | null;
  longDescription: string | null;
  icon: string | null;
  authorId: string | null;
  authorName: string | null;
  tags: string;
  category: string | null;
  content: string;
  configSchema: string;
  isPublic: boolean;
  orgId: string | null;
  installCount: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  reviews?: MarketplaceReview[];
  totalInstallations?: number;
}

export interface MarketplaceReview {
  id: string;
  itemId: string;
  userId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface MarketplaceListResponse {
  items: MarketplaceItem[];
  total: number;
  limit: number;
  offset: number;
  categories: { category: string; count: number }[];
}

export interface MarketplaceType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const marketplaceApi = {
  list: (params?: { type?: string; category?: string; search?: string; sort?: string; limit?: number; offset?: number }) =>
    api<MarketplaceListResponse>("GET", `/api/marketplace?${new URLSearchParams((params as Record<string, string>) || {}).toString()}`),

  seed: () => api<{ message: string; items?: MarketplaceItem[] }>("POST", "/api/marketplace/seed"),

  publish: (data: {
    name: string; type: string; version?: string; description?: string; longDescription?: string;
    icon?: string; tags?: string[] | string; category?: string; content?: string; configSchema?: string;
    isPublic?: boolean; orgId?: string;
  }) => api<MarketplaceItem>("POST", "/api/marketplace", data),

  get: (id: string) => api<MarketplaceItem & { reviews: MarketplaceReview[]; totalInstallations: number }>("GET", `/api/marketplace/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string; longDescription: string; icon: string; tags: string[]; category: string; content: string; isPublic: boolean; version: string }>) =>
    api<MarketplaceItem>("PUT", `/api/marketplace/${id}`, data),

  delete: (id: string) => api<{ success: boolean }>("DELETE", `/api/marketplace/${id}`),

  install: (id: string, data?: { projectId?: string; config?: string }) =>
    api<{ success: boolean; item: MarketplaceItem }>("POST", `/api/marketplace/${id}/install`, data || {}),

  addReview: (id: string, data: { rating: number; comment?: string }) =>
    api<MarketplaceReview>("POST", `/api/marketplace/${id}/reviews`, data),

  getMyItems: () => api<MarketplaceItem[]>("GET", "/api/marketplace/my"),

  getTypes: () => api<{ types: MarketplaceType[] }>("GET", "/api/marketplace/types"),
};
