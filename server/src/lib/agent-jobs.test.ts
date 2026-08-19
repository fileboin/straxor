import { describe, it, expect } from "vitest";
import {
  finalStatusForTimeline,
  isStaleAgentJob,
  type AgentJobTimelineEntry,
} from "./agent-jobs";

describe("agent-jobs — finalStatusForTimeline", () => {
  it("reports done for a timeline with no error entry", () => {
    const timeline: AgentJobTimelineEntry[] = [
      { t: "text", content: "hello" },
      { t: "tool_call", toolId: "c1", toolName: "bash" },
      { t: "tool_result", toolId: "c1", content: "ok" },
    ];
    expect(finalStatusForTimeline(timeline)).toBe("done");
  });

  it("reports done for an empty timeline", () => {
    expect(finalStatusForTimeline([])).toBe("done");
  });

  it("reports error when any error entry was captured", () => {
    const timeline: AgentJobTimelineEntry[] = [
      { t: "text", content: "working" },
      { t: "error", content: "boom" },
    ];
    expect(finalStatusForTimeline(timeline)).toBe("error");
  });
});

describe("agent-jobs — isStaleAgentJob", () => {
  const now = 1_000_000;

  it("ignores terminal jobs", () => {
    expect(isStaleAgentJob(new Date(0), now, "done")).toBe(false);
    expect(isStaleAgentJob(new Date(0), now, "error")).toBe(false);
  });

  it("flags an untouched queued job (dropped in-memory queue on restart)", () => {
    expect(isStaleAgentJob(new Date(now - 10_000), now, "queued")).toBe(true);
    expect(isStaleAgentJob(new Date(now + 5_000), now, "queued")).toBe(false);
  });

  it("flags a running job not touched since the cutoff", () => {
    expect(isStaleAgentJob(new Date(now - 10_000), now, "running")).toBe(true);
  });

  it("keeps a running job touched after the cutoff", () => {
    expect(isStaleAgentJob(new Date(now + 5_000), now, "running")).toBe(false);
  });

  it("treats a missing updatedAt as stale", () => {
    expect(isStaleAgentJob(null, now, "running")).toBe(true);
    expect(isStaleAgentJob(undefined, now, "running")).toBe(true);
  });

  it("accepts string and numeric timestamps", () => {
    expect(isStaleAgentJob(new Date(now - 1).toISOString(), now, "running")).toBe(true);
    expect(isStaleAgentJob(now + 1, now, "running")).toBe(false);
  });
});
