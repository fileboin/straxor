import { describe, it, expect } from "vitest";
import {
  signWebhookPayload,
  webhookMatchesEvent,
  normalizeWebhookUrl,
} from "./webhooks.js";

describe("signWebhookPayload", () => {
  it("produces a deterministic HMAC-SHA256 hex signature", () => {
    const a = signWebhookPayload("secret", { event: "agent.run.completed" });
    const b = signWebhookPayload("secret", { event: "agent.run.completed" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the secret changes", () => {
    const a = signWebhookPayload("secret-a", { x: 1 });
    const b = signWebhookPayload("secret-b", { x: 1 });
    expect(a).not.toBe(b);
  });

  it("changes when the payload changes", () => {
    const a = signWebhookPayload("secret", { x: 1 });
    const b = signWebhookPayload("secret", { x: 2 });
    expect(a).not.toBe(b);
  });
});

describe("webhookMatchesEvent", () => {
  it("matches a wildcard subscription", () => {
    expect(webhookMatchesEvent(["*"], "agent.run.completed")).toBe(true);
  });

  it("matches an exact event name", () => {
    expect(webhookMatchesEvent(["team.task.approved"], "team.task.approved")).toBe(true);
  });

  it("does not match an unsubscribed event", () => {
    expect(webhookMatchesEvent(["preview.started"], "agent.run.completed")).toBe(false);
  });
});

describe("normalizeWebhookUrl", () => {
  it("trims whitespace", () => {
    expect(normalizeWebhookUrl("  https://example.com/hook  ")).toBe("https://example.com/hook");
  });

  it("accepts http and https", () => {
    expect(normalizeWebhookUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeWebhookUrl("https://example.com")).toBe("https://example.com");
  });

  it("rejects non-http URLs", () => {
    expect(() => normalizeWebhookUrl("ftp://example.com")).toThrow(/https?/);
    expect(() => normalizeWebhookUrl("example.com")).toThrow(/https?/);
  });
});
