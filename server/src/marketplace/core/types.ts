export type PackageCategory =
  | "ai-agent" | "plugin" | "template" | "project-starter" | "workflow"
  | "prompt-pack" | "mcp-server" | "adapter-pack" | "theme" | "icons"
  | "ui-component" | "documentation-pack" | "automation-pack" | "image-style"
  | "deploy-recipe" | "api-integration";

export const ALL_CATEGORIES: PackageCategory[] = [
  "ai-agent", "plugin", "template", "project-starter", "workflow",
  "prompt-pack", "mcp-server", "adapter-pack", "theme", "icons",
  "ui-component", "documentation-pack", "automation-pack", "image-style",
  "deploy-recipe", "api-integration",
];

export type LicenseType =
  | "mit" | "apache-2.0" | "gpl-3.0" | "bsd-3-clause"
  | "commercial" | "private" | "enterprise" | "custom";

export type VerificationStatus = "pending" | "passed" | "failed" | "not-submitted";

export type PackageVisibility = "public" | "private" | "unlisted";

export interface PackageAuthor {
  id: string;
  name: string;
  email?: string;
  url?: string;
}

export interface PackageDependency {
  name: string;
  version: string;
  optional?: boolean;
  category?: PackageCategory;
}

export interface PackageCompatibility {
  straxorVersion?: string;
  nodeVersion?: string;
  platforms?: string[];
  browsers?: string[];
}

export interface PackageManifest {
  name: string;
  displayName: string;
  description: string;
  category: PackageCategory;
  tags: string[];
  author: PackageAuthor;
  license: LicenseType;
  licenseUrl?: string;
  visibility: PackageVisibility;
  icon?: string;
  screenshotUrls?: string[];
  readmeUrl?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  dependencies: PackageDependency[];
  compatibility: PackageCompatibility;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PackageVersion {
  version: string;
  changelog: string;
  manifest: PackageManifest;
  fileUrl?: string;
  fileHash?: string;
  fileSize?: number;
  dependencies: PackageDependency[];
  peerDependencies: PackageDependency[];
  straxorVersion?: string;
  isDeprecated: boolean;
  deprecationMessage?: string;
  publishedAt: string;
}

export interface PackageStats {
  downloads: number;
  installs: number;
  currentInstalls: number;
  averageRating: number;
  totalReviews: number;
  stars: number;
  forks: number;
}

export interface VerificationResult {
  status: VerificationStatus;
  securityScore: number;
  compatibilityScore: number;
  qualityScore: number;
  overallScore: number;
  digitalSignature?: string;
  dependencyIssues: string[];
  securityIssues: string[];
  qualityIssues: string[];
  malwareScanResult: "clean" | "suspicious" | "malicious" | "not-scanned";
  reviewedByAI: boolean;
  reviewedByHuman: boolean;
  verifiedAt?: string;
}

export interface PackageListing {
  id: string;
  manifest: PackageManifest;
  versions: PackageVersion[];
  latestVersion: string;
  stats: PackageStats;
  verification: VerificationResult;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  packageId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  websiteUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  packages: string[];
  totalDownloads: number;
  totalStars: number;
  followers: number;
  following: number;
  joinedAt: string;
  isVerified: boolean;
}

export interface SearchQuery {
  query: string;
  category?: PackageCategory;
  tags?: string[];
  license?: LicenseType;
  minScore?: number;
  sortBy?: "popularity" | "downloads" | "rating" | "newest" | "name";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  listings: PackageListing[];
  total: number;
  query: string;
  facets?: {
    categories: Record<string, number>;
    licenses: Record<string, number>;
    tags: Record<string, number>;
  };
}

export interface RecommendationContext {
  recentInstalls?: string[];
  favorites?: string[];
  categories?: PackageCategory[];
  tags?: string[];
  userId?: string;
}

export interface MarketplaceEvent {
  type: "package:published" | "package:updated" | "package:deprecated" | "package:archived" | "package:deleted" | "review:created" | "review:updated" | "creator:registered";
  packageId?: string;
  userId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface MarketplacePlugin {
  name: string;
  version: string;
  onEvent?(event: MarketplaceEvent): Promise<void>;
  onBeforePublish?(manifest: PackageManifest): Promise<PackageManifest>;
  onAfterInstall?(packageId: string, userId: string): Promise<void>;
  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface PaymentAdapter {
  name: string;
  displayName: string;
  createCheckout(packageId: string, price: number, currency: string, userId: string): Promise<{ url: string; id: string }>;
  verifyPayment(paymentId: string): Promise<boolean>;
  refund(paymentId: string): Promise<boolean>;
}

export interface LicenseInfo {
  type: LicenseType;
  name: string;
  url?: string;
  allowsCommercial: boolean;
  allowsModification: boolean;
  allowsDistribution: boolean;
  requiresAttribution: boolean;
  requiresShareAlike: boolean;
}

export const LICENSE_INFO: Record<LicenseType, LicenseInfo> = {
  "mit": { type: "mit", name: "MIT License", url: "https://opensource.org/licenses/MIT", allowsCommercial: true, allowsModification: true, allowsDistribution: true, requiresAttribution: true, requiresShareAlike: false },
  "apache-2.0": { type: "apache-2.0", name: "Apache License 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0", allowsCommercial: true, allowsModification: true, allowsDistribution: true, requiresAttribution: true, requiresShareAlike: false },
  "gpl-3.0": { type: "gpl-3.0", name: "GNU General Public License v3.0", url: "https://www.gnu.org/licenses/gpl-3.0.html", allowsCommercial: true, allowsModification: true, allowsDistribution: true, requiresAttribution: true, requiresShareAlike: true },
  "bsd-3-clause": { type: "bsd-3-clause", name: "BSD 3-Clause License", url: "https://opensource.org/licenses/BSD-3-Clause", allowsCommercial: true, allowsModification: true, allowsDistribution: true, requiresAttribution: true, requiresShareAlike: false },
  "commercial": { type: "commercial", name: "Commercial License", allowsCommercial: true, allowsModification: false, allowsDistribution: false, requiresAttribution: false, requiresShareAlike: false },
  "private": { type: "private", name: "Private License", allowsCommercial: false, allowsModification: false, allowsDistribution: false, requiresAttribution: false, requiresShareAlike: false },
  "enterprise": { type: "enterprise", name: "Enterprise License", allowsCommercial: true, allowsModification: true, allowsDistribution: true, requiresAttribution: false, requiresShareAlike: false },
  "custom": { type: "custom", name: "Custom License", allowsCommercial: false, allowsModification: false, allowsDistribution: false, requiresAttribution: false, requiresShareAlike: false },
};

export const CATEGORY_DISPLAY: Record<PackageCategory, string> = {
  "ai-agent": "AI Agents",
  "plugin": "Plugins",
  "template": "Templates",
  "project-starter": "Project Starters",
  "workflow": "Workflows",
  "prompt-pack": "Prompt Packs",
  "mcp-server": "MCP Servers",
  "adapter-pack": "Adapter Packs",
  "theme": "Themes",
  "icons": "Icons",
  "ui-component": "UI Components",
  "documentation-pack": "Documentation Packs",
  "automation-pack": "Automation Packs",
  "image-style": "Image Styles",
  "deploy-recipe": "Deploy Recipes",
  "api-integration": "API Integrations",
};
