import { getAdapters } from "../registry.js";
import { commitWorkspace, pushWorkspace } from "../../runtime/local/workspace.js";
import { withSharedWorkspace } from "../../runtime/local/shared-workspace.js";
import {
  appendTaskLog,
  completeTask,
  getTask,
  setTaskExecution,
  updateTaskStatus,
} from "./orchestrator.js";

const ENGINE_ID = "local:opencode";
const TURN_TIMEOUT_MS = 30 * 60 * 1000;

function roleInstruction(role: string): string {
  return {
    research: "Analyse the repository and report findings. Do not modify files unless the task explicitly requires it.",
    coding: "Implement the requested code change carefully and run relevant tests.",
    testing: "Run and, when needed, improve relevant tests. Fix only defects proven by the tests.",
    security: "Review and remediate security issues. Preserve functionality and run focused verification.",
    documentation: "Update accurate project documentation for the requested change.",
  }[role] || "Complete the assigned task carefully.";
}

function waitForTurn(stream: NodeJS.ReadableStream, sessionId: string, taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { (stream as any).destroy?.(); } catch {}
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new Error("OpenCode turn timed out after 30 minutes")), TURN_TIMEOUT_MS);
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.properties?.sessionID && event.properties.sessionID !== sessionId) continue;
          const type = event.type || event.properties?.type;
          if (type === "message.part.updated" && event.properties?.part?.type === "tool") {
            const part = event.properties.part;
            const status = part.state?.status;
            if (status === "pending" || status === "running") appendTaskLog(taskId, `OpenCode tool ${part.tool}: ${status}`);
            if (status === "completed") appendTaskLog(taskId, `OpenCode tool ${part.tool}: completed`);
            if (status === "error") appendTaskLog(taskId, `OpenCode tool ${part.tool}: failed`);
          }
          if (type === "session.error") finish(new Error("OpenCode reported a session error"));
          if (type === "session.idle") finish();
        } catch { /* ignore malformed SSE record */ }
      }
    });
    stream.on("error", (err) => finish(err));
    stream.on("close", () => { if (!done) finish(new Error("OpenCode event stream closed early")); });
  });
}

export async function executeTaskWithOpenCode(userId: string, taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (task.status === "running") throw new Error("Task is already running");
  if (task.dependencies.some((id) => getTask(id)?.status !== "completed")) {
    throw new Error("Task dependencies are not complete");
  }

  updateTaskStatus(taskId, "running");
  appendTaskLog(taskId, "Queued for the shared GitHub workspace");

  try {
    await withSharedWorkspace(userId, async (workspace) => {
      appendTaskLog(taskId, `Workspace ready: ${workspace.repo} @ ${workspace.branch}`);
      const runtime = getAdapters().runtime(userId);
      const session = await runtime.createSession(ENGINE_ID, `${task.role}: ${task.title}`);
      setTaskExecution(taskId, session.id);
      appendTaskLog(taskId, `Sent task to OpenCode session ${session.id}`);

      // Open the event stream before the prompt so no tool activity is lost.
      const stream = await runtime.openEventStream(ENGINE_ID);
      const prompt = [
        `You are the Straxor ${task.role} agent.`,
        roleInstruction(task.role),
        `Work only in the current directory, which is the shared repository ${workspace.repo} on branch ${workspace.branch}.`,
        "Do not use /tmp or create an alternative clone. Do not run git commit or git push; Straxor will commit and push only after this turn completes successfully.",
        "When done, summarize files changed and tests run.",
        `Task: ${task.title}`,
        task.description,
        task.input,
      ].filter(Boolean).join("\n\n");
      await runtime.sendMessage(ENGINE_ID, session.id, prompt, "async");
      await waitForTurn(stream, session.id, taskId);
      appendTaskLog(taskId, "OpenCode turn completed; preparing Straxor commit");

      if (workspace.readOnly) {
        appendTaskLog(taskId, "Read-only repository: commit and push skipped");
        completeTask(taskId, "OpenCode completed the task in a read-only workspace.");
        return;
      }
      const commit = await commitWorkspace(userId, workspace.repo.split("/")[0], workspace.repo.split("/")[1], `agent(${task.role}): ${task.title}`.slice(0, 240), workspace.branch);
      if (!commit.committed) {
        appendTaskLog(taskId, "No file changes to commit");
        completeTask(taskId, "OpenCode completed the task; no repository changes were produced.");
        return;
      }
      appendTaskLog(taskId, `Committed ${commit.hash} as Straxor Agent`);
      const pushOutput = await pushWorkspace(userId, workspace.repo.split("/")[0], workspace.repo.split("/")[1], workspace.branch);
      appendTaskLog(taskId, `Pushed ${commit.hash} to GitHub: ${pushOutput || "ok"}`);
      setTaskExecution(taskId, session.id, commit.hash);
      completeTask(taskId, `OpenCode completed the task and pushed commit ${commit.hash}.`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    appendTaskLog(taskId, `Failed: ${message}`);
    updateTaskStatus(taskId, "failed", undefined, message);
  }
}
