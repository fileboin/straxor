// ── Remote Git Platform Types ──

export type GitPlatformId = "github" | "gitlab" | "forgejo" | "gitea" | "bitbucket" | "huggingface";

export const GIT_PLATFORM_META: Record<GitPlatformId, { name: string; icon: string; color: string; baseUrl: string; docsUrl: string }> = {
  github: { name: "GitHub", icon: "🐙", color: "text-gray-300", baseUrl: "https://api.github.com", docsUrl: "https://docs.github.com/en/rest" },
  gitlab: { name: "GitLab", icon: "🦊", color: "text-orange-400", baseUrl: "https://gitlab.com/api/v4", docsUrl: "https://docs.gitlab.com/ee/api" },
  forgejo: { name: "Forgejo", icon: "🔨", color: "text-green-400", baseUrl: "", docsUrl: "https://forgejo.org/docs/latest" },
  gitea: { name: "Gitea", icon: "🐊", color: "text-cyan-400", baseUrl: "", docsUrl: "https://docs.gitea.com/api" },
  bitbucket: { name: "Bitbucket", icon: "🔵", color: "text-blue-400", baseUrl: "https://api.bitbucket.org/2.0", docsUrl: "https://developer.atlassian.com/cloud/bitbucket/rest" },
  huggingface: { name: "Hugging Face Hub", icon: "🤗", color: "text-yellow-400", baseUrl: "https://huggingface.co/api", docsUrl: "https://huggingface.co/docs/hub/en/api" },
};

export interface GitRemoteRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
  platform: GitPlatformId;
  private: boolean;
  defaultBranch: string;
  language?: string;
  stars: number;
  forks: number;
  updatedAt: string;
  createdAt: string;
}

export interface GitBranch {
  name: string;
  commitSha: string;
  isDefault: boolean;
  protected: boolean;
}

export interface GitPullRequest {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  state: "open" | "closed" | "merged";
  author: string;
  createdAt: string;
  url: string;
}

export interface GitIssue {
  id: number;
  title: string;
  description: string;
  state: "open" | "closed";
  author: string;
  labels: string[];
  createdAt: string;
  url: string;
}

export interface GitRemoteAdapter {
  readonly platform: GitPlatformId;
  readonly name: string;

  // Auth
  isAuthenticated(): boolean;
  setToken(token: string): void;

  // Repositories
  listRepos(): Promise<GitRemoteRepo[]>;
  getRepo(owner: string, repo: string): Promise<GitRemoteRepo>;
  createRepo(name: string, opts?: { description?: string; private?: boolean }): Promise<GitRemoteRepo>;
  forkRepo(owner: string, repo: string): Promise<GitRemoteRepo>;

  // Branches
  listBranches(owner: string, repo: string): Promise<GitBranch[]>;
  createBranch(owner: string, repo: string, name: string, fromSha: string): Promise<void>;

  // Pull Requests
  listPullRequests(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitPullRequest[]>;
  createPullRequest(owner: string, repo: string, pr: { title: string; description: string; sourceBranch: string; targetBranch: string }): Promise<GitPullRequest>;
  mergePullRequest(owner: string, repo: string, prId: number): Promise<void>;

  // Issues
  listIssues(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitIssue[]>;
  createIssue(owner: string, repo: string, issue: { title: string; description: string; labels?: string[] }): Promise<GitIssue>;
}
