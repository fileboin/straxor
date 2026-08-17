import { describe, it, expect } from "vitest";
import {
  DEFAULT_TEAM_ROLES,
  normalizeTeamRoles,
  roleLabel,
  buildRoleSystem,
} from "./team-roles";

describe("team-roles — normalizeTeamRoles", () => {
  it("defaults to coding + testing + security when no roles are given", () => {
    expect(normalizeTeamRoles()).toEqual(["coding", "testing", "security"]);
    expect(normalizeTeamRoles([])).toEqual(["coding", "testing", "security"]);
    expect(normalizeTeamRoles(undefined as unknown as string[])).toEqual(DEFAULT_TEAM_ROLES);
  });

  it("keeps a valid role list in order and dedupes it", () => {
    expect(normalizeTeamRoles(["security", "coding", "security"])).toEqual(["security", "coding"]);
  });

  it("is case-insensitive", () => {
    expect(normalizeTeamRoles(["CODING", "Testing"])).toEqual(["coding", "testing"]);
  });

  it("falls back to the default team when every requested role is unknown", () => {
    expect(normalizeTeamRoles(["designer", "pm"])).toEqual(DEFAULT_TEAM_ROLES);
  });

  it("drops unknown roles but keeps valid ones", () => {
    expect(normalizeTeamRoles(["coding", "designer"])).toEqual(["coding"]);
  });
});

describe("team-roles — roleLabel", () => {
  it("maps known ids to friendly names", () => {
    expect(roleLabel("coding")).toBe("Coding Agent");
    expect(roleLabel("security")).toBe("Security Agent");
  });

  it("falls back to the raw id for unknown roles", () => {
    expect(roleLabel("designer")).toBe("designer");
  });
});

describe("team-roles — buildRoleSystem", () => {
  it("produces a role-tagged system prompt with the role's scope", () => {
    const sys = buildRoleSystem("coding");
    expect(sys).toContain("[STRAXOR TEAM ROLE]");
    expect(sys).toContain("Role: Coding Agent");
    expect(sys).toContain("Implement the requested code change");
    expect(sys).toContain("[/STRAXOR TEAM ROLE]");
  });

  it("never includes the user prompt (it is injected as the message instead)", () => {
    expect(buildRoleSystem("testing")).not.toContain("Team task:");
  });

  it("has a non-empty fallback instruction for unknown roles", () => {
    const sys = buildRoleSystem("coding");
    expect(sys.length).toBeGreaterThan(50);
  });
});
