// ── Team fan-out roles (FAZA 7b/7c) ──
// Pure helpers for the /api/agent/team flow: which roles run by default, how
// an arbitrary role list is normalized, and the role-specific SYSTEM prompt
// injected into each fan-out turn (kept in the background, never in the
// visible chat message — same policy as the main Agent panel).

import {
  AGENT_ROLES,
  type AgentRole,
} from "../adapters/multi-agent/types.js";

export const DEFAULT_TEAM_ROLES: AgentRole[] = ["coding", "testing", "security"];

export const TEAM_ROLE_IDS: AgentRole[] = AGENT_ROLES.map((r) => r.id);

/** Validate + dedupe a requested role list; fall back to the default team. */
export function normalizeTeamRoles(roles?: string[]): AgentRole[] {
  if (!Array.isArray(roles) || roles.length === 0) return [...DEFAULT_TEAM_ROLES];
  const seen = new Set<AgentRole>();
  for (const raw of roles) {
    const id = String(raw).trim().toLowerCase() as AgentRole;
    if ((TEAM_ROLE_IDS as string[]).includes(id) && !seen.has(id)) seen.add(id);
  }
  return seen.size > 0 ? Array.from(seen) : [...DEFAULT_TEAM_ROLES];
}

export function roleLabel(role: string): string {
  return AGENT_ROLES.find((r) => r.id === role)?.name || role;
}

const ROLE_INSTRUCTIONS: Record<string, string> = {
  research:
    "Research and analyze the repository and the task. Produce findings, not code changes, unless the task explicitly requires edits.",
  coding:
    "Implement the requested code change in the shared repository. Keep changes minimal and focused, and run the relevant checks when possible.",
  testing:
    "Verify the change: run the project's tests/build, fix only defects the checks prove, and add tests where coverage is clearly missing.",
  security:
    "Audit the change for security issues (injection, secrets, auth, dependencies, unsafe shell). Fix real issues and preserve functionality.",
  documentation:
    "Update the project documentation to match the change (README, inline comments, changelog). Keep it accurate and concise.",
};

/** SYSTEM prompt for one fan-out role. Injected server-side, not into the chat. */
export function buildRoleSystem(role: AgentRole): string {
  const def = AGENT_ROLES.find((r) => r.id === role);
  const instruction = ROLE_INSTRUCTIONS[role] || "Complete the assigned task carefully.";
  return [
    "[STRAXOR TEAM ROLE]",
    `Role: ${def?.name || role}`,
    `Scope: ${instruction}`,
    "You are one member of a Straxor team working in the shared repository. Other roles may run before or after you; focus only on your role's scope.",
    "Work only in the current directory (the shared repository clone). Do not create another clone or use /tmp.",
    "Do not run git commit or git push — Straxor handles commits and pushes after each turn.",
    "When done, summarize what you changed and what you verified.",
    "[/STRAXOR TEAM ROLE]",
  ].join("\n");
}
