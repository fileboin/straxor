# Components, Pages, and Hooks

## Pages (13)

| Page | Route | Purpose |
|------|-------|---------|
| `Login.tsx` | `/login` | User login form |
| `Register.tsx` | `/register` | User registration form |
| `Onboarding.tsx` | `/onboarding` | First-time setup wizard |
| `Dashboard.tsx` | `/` | Project listing, create project |
| `Workspace.tsx` | `/project/:id` | Main workspace with all panels |
| `DeployManager.tsx` | `/project/:id/deploy` | Deployment management |
| `ImageStudio.tsx` | `/project/:id/image` | AI image generation studio |
| `ImageAgent.tsx` | `/project/:id/image-agent` | Image agent chat interface |
| `Knowledge.tsx` | `/project/:id/knowledge` | Knowledge base management |
| `Help.tsx` | `/help` | Help and documentation |
| `Marketplace.tsx` | `/marketplace`, `/marketplace/category/:category` | Plugin/package marketplace |
| `Connections.tsx` | `/connections` | Universal connections manager |
| `Admin.tsx` | `/admin` | Admin control center |

## Layout Components (4)

| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | App shell — wraps all routes with nav, sidebar, etc. |
| `StatusBar.tsx` | Bottom status indicator (connection, mode) |
| `TemplateSelector.tsx` | Project template picker |
| `BlueprintPreview.tsx` | Blueprint/project preview |

## Workspace Components (43)

### Core Workspace
| Component | Purpose |
|-----------|---------|
| `WorkspaceTopbar.tsx` | Top navigation bar with project info, action buttons |
| `BottomBar.tsx` | Bottom action bar |
| `ChatPanel.tsx` | AI chat interface (Ask panel) |
| `InputToolbar.tsx` | Chat input with mic, camera, file, image buttons |
| `ProviderModelDropdown.tsx` | AI provider + model selector |
| `PlanActToggle.tsx` | Plan/Act mode toggle |
| `SessionPicker.tsx` | Session selector |
| `RoleSelector.tsx` | Agent role selector |
| `SshInput.tsx` | SSH connection input |
| `ApiKeyInput.tsx` | API key input for providers |

### Development Tools
| Component | Purpose |
|-----------|---------|
| `CodeEditor.tsx` | CodeMirror-based editor with multi-language support |
| `FileExplorer.tsx` | File tree browser for VPS |
| `EditorContainer.tsx` | Editor + file explorer container |
| `SearchPanel.tsx` | File content/name search |
| `DiffReview.tsx` | Git diff visualization |
| `HistoryPanel.tsx` | Undo/redo history |
| `ConsolePanel.tsx` | Runtime console with SSE |
| `LogViewer.tsx` | System log viewer |
| `EnvEditor.tsx` | Environment variable editor |
| `CommandPalette.tsx` | Ctrl+K command palette |
| `ContextPanel.tsx` | Context assembly configuration |
| `PreviewPanel.tsx` | Dev preview server panel |
| `DatabasePanel.tsx` | Remote database browser |
| `RollbackPanel.tsx` | Snapshot/rollback management |

### AI & Agents
| Component | Purpose |
|-----------|---------|
| `AgentPanel` (in ChatPanel?) | Agent interaction panel |
| `PromptLibrary.tsx` | Saved prompt templates |
| `PermissionsPanel.tsx` | Agent permissions config |
| `GatewayPanel.tsx` | AI gateway configuration |
| `ProvidersPanel.tsx` | Direct provider connections |
| `MultiAgentPanel.tsx` | Multi-agent orchestration UI |
| `WebResearchPanel.tsx` | Web research interface |
| `DesignStudio.tsx` | AI design system |
| `DesignAssetsPanel.tsx` | Design asset library |

### Deploy & Infrastructure
| Component | Purpose |
|-----------|---------|
| `DeploymentPanel.tsx` | Deployment management |
| `InfrastructurePanel.tsx` | Infrastructure provisioning |
| `QuickStartPanel.tsx` | Quickstart scaffold |
| `RuntimeSelector.tsx` | Runtime adapter selector |

### Collaboration & Enterprise
| Component | Purpose |
|-----------|---------|
| `CollaboratorsPanel.tsx` | Project collaborators |
| `TeamPanel.tsx` | Team management |
| `OrganizationDashboard.tsx` | Org dashboard |
| `EnterpriseSecurity.tsx` | Enterprise security |
| `EnterpriseResilience.tsx` | Disaster recovery / offline |
| `GlobalScalePanel.tsx` | Scaling, load balancing, failover |
| `UsagePanel.tsx` | Usage/cost display |

### Marketplace & Community
| Component | Purpose |
|-----------|---------|
| `Marketplace.tsx` | Plugin/package marketplace |
| `PluginManager.tsx` | Plugin management |
| `McpMarketplace.tsx` | MCP server marketplace |
| `KanbanCommandCenter.tsx` | Kanban board + command center |

### Other
| Component | Purpose |
|-----------|---------|
| `AdminCenter.tsx` | Admin control panel |
| `NotificationSettings.tsx` | Notification channel config |
| `ExportPanel.tsx` | Project export |
| `WorktreeManager.tsx` | Git worktree management |
| `VerificationPanel.tsx` | Proof loop verification (Block 73) |
| `BrowserVerifier.tsx` | Browser verification |
| `SecurityScanResult.tsx` | Security scan results |
| `PlanPreview.tsx` | Plan & cost preview |
| `HomeMenu.tsx` | Home quick navigation |
| `HomeCenter.tsx` | Home center dashboard |
| `TodoList.tsx` | Todo list |
| `ToolConfirmDialog.tsx` | Tool confirmation dialog |
| `VerificationBadge.tsx` | Verification status badge |

## Client Library Modules (50+)

| Module | Exported Functions | Purpose |
|--------|-------------------|---------|
| `api.ts` | `api<T>()` | Generic fetch wrapper |
| `auth.tsx` | AuthProvider, useAuth, isAdmin | Auth context + hooks |
| `theme.tsx` | ThemeProvider, useTheme | Theme context |
| `admin.ts` | Admin API calls | Admin panel |
| `agent.ts` | Agent API calls | Agent interaction |
| `browser-verify.ts` | Browser verification API | Playwright verification |
| `chat.ts` | Chat API calls | AI chat |
| `commands.ts` | Command definitions | Command palette |
| `connections.ts` | Connections API | Universal connections |
| `console.ts` | Console API calls | Runtime console |
| `context.ts` | Context API calls | Context assembly |
| `database.ts` | Database API calls | Remote DB |
| `deployments.ts` | Deployments API calls | Deploy management |
| `design.ts` | Design API calls | AI design |
| `design-assets.ts` | Design assets API | Asset library |
| `enterprise.ts` | Enterprise API calls | Enterprise features |
| `envs.ts` | Environment API calls | Env editor |
| `export.ts` | Export API calls | Project export |
| `files.ts` | File API calls | File explorer |
| `gateway.ts` | Gateway API calls | AI gateway |
| `git-remote.ts` | Git remote API | Remote git providers |
| `history.ts` | History API calls | Undo/redo |
| `home-center.ts` | Home center API | Dashboard stats |
| `image.ts` | Image API calls | Image core |
| `image-agent.ts` | Image agent API | Image agent |
| `infrastructure.ts` | Infrastructure API | Infrastructure |
| `kanban.ts` | Kanban API | Command center |
| `knowledge.ts` | Knowledge API | Knowledge system |
| `logs.ts` | Log API calls | Log viewer |
| `marketplace.ts` | Marketplace API | Old marketplace |
| `marketplace-core.ts` | Marketplace core API | Block 70 marketplace |
| `mcp-marketplace.ts` | MCP marketplace API | MCP servers |
| `models.ts` | Model definitions | AI model registry |
| `multi-agent.ts` | Multi-agent API | Multi-agent system |
| `notifications.ts` | Notification API | Notification config |
| `onboarding.ts` | Onboarding helpers | Onboarding state |
| `organization.ts` | Organization API | Org management |
| `permissions.ts` | Permission API | Permissions |
| `plan-preview.ts` | Plan preview API | Cost estimation |
| `plugins.ts` | Plugin API | Plugin management |
| `preview.ts` | Preview API | Dev preview |
| `projects.ts` | Project API | Project CRUD |
| `providers.ts` | Provider API | Provider connections |
| `publish.ts` | Publish API | Publish links |
| `quickstart.ts` | Quickstart API | Project scaffolding |
| `resilience.ts` | Resilience API | DR/offline |
| `roles.ts` | Role API | Agent roles |
| `rollback.ts` | Rollback API | Snapshots |
| `runtime-manager.ts` | Runtime API | Runtime management |
| `scale.ts` | Scale API | Scaling |
| `search.ts` | Search API | File search |
| `security.ts` | Security API | Security scanning |
| `sessions.ts` | Session API | Session management |
| `support.ts` | Support API | Support tickets |
| `teams.ts` | Team API | Team management |
| `usage.ts` | Usage API | Usage tracking |
| `verification.ts` | Verification API | Proof loop verification |
| `verify.ts` | Verify API | Verification checks |
| `web-research.ts` | Web research API | Web search |
| `worktrees.ts` | Worktree API | Git worktrees |

## Client SDK
- `sdk/index.ts` — Re-exports all lib modules as a single import

## Custom Hooks (from context)
- `useAuth()` — Auth state (user, loading, login, logout, register)
- `useTheme()` — Theme state (theme, accent, setTheme, setAccent)
