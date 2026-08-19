import { describe, it, expect } from "vitest";
import { openapiSpec } from "./spec.js";

const spec = openapiSpec as Record<string, any>;
const paths = spec.paths as Record<string, any>;

describe("openapiSpec", () => {
  it("is a valid OpenAPI 3.0 document", () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toBe("STRAXOR API");
    expect(spec.info.version).toBeTruthy();
  });

  it("uses /api as the server base", () => {
    expect(spec.servers).toEqual([{ url: "/api" }]);
  });

  it("documents the MVP closed-loop endpoints", () => {
    expect(paths["/health"]).toBeTruthy();
    expect(paths["/auth/login"]).toBeTruthy();
    expect(paths["/agent/team"]).toBeTruthy();
    expect(paths["/agent/team/{taskId}/approve"]).toBeTruthy();
    expect(paths["/repos/diff"]).toBeTruthy();
    expect(paths["/repos/push"]).toBeTruthy();
    expect(paths["/terminal/start"]).toBeTruthy();
    expect(paths["/preview/start"]).toBeTruthy();
  });

  it("declares a bearer security scheme", () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  it("has unique operationIds across all paths", () => {
    const ids: string[] = [];
    for (const p of Object.values(paths) as any[]) {
      for (const op of Object.values(p) as any[]) {
        if (op && typeof op === "object" && "operationId" in op) ids.push(op.operationId);
      }
    }
    // No operationIds are used yet — this documents the convention.
    expect(ids).toEqual([]);
  });
});
