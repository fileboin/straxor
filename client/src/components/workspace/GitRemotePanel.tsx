import { useState, useEffect } from "react";
import {
  GIT_PLATFORMS,
  getGitConfig,
  setGitConfig,
  listRepos,
  createRepo,
  forkRepo,
  listPullRequests,
  createPullRequest,
  mergePullRequest,
  listIssues,
  createIssue,
} from "../../lib/git-remote";
import type { GitPlatformId } from "../../lib/git-remote";

interface Props {
  onClose: () => void;
}

type Tab = "repos" | "prs" | "issues";

export default function GitRemotePanel({ onClose }: Props) {
  const [platform, setPlatform] = useState<GitPlatformId>("github");
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [tab, setTab] = useState<Tab>("repos");
  const [repos, setRepos] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");

  const meta = GIT_PLATFORMS.find((p) => p.id === platform)!;

  useEffect(() => {
    getGitConfig(platform).then((c) => {
      setConfigured(c.configured);
    });
  }, [platform]);

  async function handleSaveConfig() {
    await setGitConfig(platform, token, baseUrl || undefined);
    setConfigured(true);
    setActionMsg("Token sačuvan");
    setTimeout(() => setActionMsg(""), 2000);
  }

  async function loadRepos() {
    setLoading(true);
    try {
      const r = await listRepos(platform);
      setRepos(r);
    } catch (e: any) {
      setActionMsg(e.message);
    }
    setLoading(false);
  }

  async function handleCreateRepo() {
    const name = prompt("Ime repozitorijuma:");
    if (!name) return;
    try {
      await createRepo(platform, name);
      setActionMsg('Repo "' + name + '" kreiran');
      loadRepos();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  }

  async function handleFork(fullName: string) {
    const [o, r] = fullName.split("/");
    try {
      await forkRepo(platform, o, r);
      setActionMsg("Forkano: " + fullName);
      loadRepos();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  }

  async function loadPRs() {
    if (!selectedOwner || !selectedRepo) return;
    setLoading(true);
    try {
      const p = await listPullRequests(platform, selectedOwner, selectedRepo);
      setPrs(p);
    } catch (e: any) {
      setActionMsg(e.message);
    }
    setLoading(false);
  }

  async function handleCreatePR() {
    if (!selectedOwner || !selectedRepo) return;
    const title = prompt("Naslov PR:");
    if (!title) return;
    const source = prompt("Source branch:");
    if (!source) return;
    const target = prompt("Target branch (main):") || "main";
    try {
      await createPullRequest(platform, selectedOwner, selectedRepo, {
        title,
        description: "",
        sourceBranch: source,
        targetBranch: target,
      });
      setActionMsg("PR kreiran");
      loadPRs();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  }

  async function handleMergePR(prId: number) {
    try {
      await mergePullRequest(platform, selectedOwner, selectedRepo, prId);
      setActionMsg("PR #" + prId + " merge-an");
      loadPRs();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  }

  async function loadIssues() {
    if (!selectedOwner || !selectedRepo) return;
    setLoading(true);
    try {
      const is = await listIssues(platform, selectedOwner, selectedRepo);
      setIssues(is);
    } catch (e: any) {
      setActionMsg(e.message);
    }
    setLoading(false);
  }

  async function handleCreateIssue() {
    if (!selectedOwner || !selectedRepo) return;
    const title = prompt("Naslov issue:");
    if (!title) return;
    try {
      await createIssue(platform, selectedOwner, selectedRepo, { title, description: "" });
      setActionMsg("Issue kreiran");
      loadIssues();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  }

  function selectRepo(fullName: string) {
    const [o, r] = fullName.split("/");
    setSelectedOwner(o);
    setSelectedRepo(r);
    setTab("prs");
    setTimeout(() => { loadPRs(); loadIssues(); }, 100);
  }

  function renderConfig() {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className={meta.color}>{meta.icon}</span> {meta.name}
        </h2>
        <select
          className="input w-full"
          value={platform}
          onChange={(e: any) => setPlatform(e.target.value)}
        >
          {GIT_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
          ))}
        </select>
        <input
          className="input w-full"
          type="password"
          placeholder="API Token / Personal Access Token"
          value={token}
          onChange={(e: any) => setToken(e.target.value)}
        />
        {meta.selfHosted && (
          <input
            className="input w-full"
            placeholder="Self-hosted URL (npr. https://git.example.com)"
            value={baseUrl}
            onChange={(e: any) => setBaseUrl(e.target.value)}
          />
        )}
        <button className="btn btn-primary w-full" onClick={handleSaveConfig}>
          Sačuvaj i poveži
        </button>
      </div>
    );
  }

  function renderPanel() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className={meta.color}>{meta.icon}</span> {meta.name}
          </h2>
          <select
            className="input text-sm w-40"
            value={platform}
            onChange={(e: any) => { setPlatform(e.target.value); setConfigured(false); }}
          >
            {GIT_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>
        </div>

        {actionMsg && (
          <div className="text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded">{actionMsg}</div>
        )}

        <div className="flex gap-2 border-b border-gray-700 pb-2">
          {(["repos", "prs", "issues"] as Tab[]).map((t) => (
            <button
              key={t}
              className={'tab ' + (tab === t ? 'tab-active' : '')}
              onClick={() => setTab(t)}
            >
              {t === "repos" ? "\u{1F4E6} Repos" : t === "prs" ? "\u{1F500} PRs" : "\u{1F41B} Issues"}
            </button>
          ))}
        </div>

        {tab === "repos" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={loadRepos}>
                {loading ? "..." : "Osve\u017Ei"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCreateRepo}>
                + Novi repo
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {repos.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 bg-gray-800/50 rounded hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => selectRepo(r.fullName)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.fullName}</div>
                    <div className="text-xs text-gray-400 truncate">{r.description}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 ml-2">
                    <span>{'\u2B50'} {r.stars}</span>
                    <span>{'\u2442'} {r.forks}</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={(e) => { e.stopPropagation(); handleFork(r.fullName); }}
                      title="Fork"
                    >
                      {'\u2386'}
                    </button>
                  </div>
                </div>
              ))}
              {!loading && repos.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-4">
                  Nema repozitorijuma. Klikni "Osve\u017Ei" ili dodaj token.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "prs" && (
          <div className="space-y-2">
            {selectedOwner && selectedRepo && (
              <div className="text-sm text-gray-400">
                {selectedOwner}/{selectedRepo}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={loadPRs}>Osve\u017Ei</button>
              <button className="btn btn-secondary btn-sm" onClick={handleCreatePR}>+ Nov PR</button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {prs.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pr.title}</div>
                    <div className="text-xs text-gray-400">
                      {pr.sourceBranch} {'\u2192'} {pr.targetBranch}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={
                      'text-xs px-1.5 py-0.5 rounded ' + (
                        pr.state === "open" ? "bg-green-600/30 text-green-400" :
                        pr.state === "merged" ? "bg-purple-600/30 text-purple-400" :
                        "bg-red-600/30 text-red-400"
                      )
                    }>
                      {pr.state}
                    </span>
                    {pr.state === "open" && (
                      <button className="btn btn-ghost btn-xs" onClick={() => handleMergePR(pr.id)}>
                        Merge
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!loading && prs.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-4">Nema PR-ova.</div>
              )}
            </div>
          </div>
        )}

        {tab === "issues" && (
          <div className="space-y-2">
            {selectedOwner && selectedRepo && (
              <div className="text-sm text-gray-400">
                {selectedOwner}/{selectedRepo}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={loadIssues}>Osve\u017Ei</button>
              <button className="btn btn-secondary btn-sm" onClick={handleCreateIssue}>+ Nov issue</button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {issues.map((issue) => (
                <div key={issue.id} className="p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{issue.title}</div>
                    <span className={
                      'text-xs px-1.5 py-0.5 rounded ' + (
                        issue.state === "open" ? "bg-green-600/30 text-green-400" : "bg-red-600/30 text-red-400"
                      )
                    }>
                      {issue.state}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    #{issue.id} od {issue.author}
                    {issue.labels?.length > 0 && ' \u00B7 ' + issue.labels.join(", ")}
                  </div>
                </div>
              ))}
              {!loading && issues.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-4">Nema issue-a.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-[15px] font-bold text-text">
            {'\uD83D\uDD17'} Git Platforme
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-sm">
            {'\u2715'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {configured ? renderPanel() : renderConfig()}
        </div>
      </div>
    </div>
  );
}
