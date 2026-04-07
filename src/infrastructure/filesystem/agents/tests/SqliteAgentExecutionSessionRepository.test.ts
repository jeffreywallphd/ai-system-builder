import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "@domain/agents/AgentExecutionSession";
import { SqliteAgentExecutionSessionRepository } from "../SqliteAgentExecutionSessionRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteAgentExecutionSessionRepository", () => {
  it("round-trips sessions and stores transition history", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-session-"));
    createdRoots.push(root);
    const repository = new SqliteAgentExecutionSessionRepository(path.join(root, "agent-sessions.sqlite"));

    let session = createAgentExecutionSession({
      id: "agent-session:test:1",
      agentId: "agent-runtime",
      planId: "agent-plan:1",
    });
    await repository.save(session);

    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.ready });
    await repository.save(session);
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.running });
    await repository.save(session);
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.completed });
    await repository.save(session);

    const loaded = await repository.getById("agent-session:test:1");
    expect(loaded?.status).toBe("completed");
    expect(loaded?.executionPlan?.planId).toBe("agent-plan:1");
    expect(loaded?.terminalState?.reason).toBe("completed");
    expect(loaded?.terminalState?.hadPartialProgress).toBe(false);

    const listed = await repository.listByAgentId("agent-runtime");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe("agent-session:test:1");
    expect(listed[0]?.stepOutcomes).toEqual([]);

    const transitions = await repository.listTransitionHistory("agent-session:test:1");
    expect(transitions.map((entry) => entry.status)).toEqual(["pending", "ready", "running", "completed"]);
    const db = new Database(path.join(root, "agent-sessions.sqlite"));
    const row = db
      .prepare(`
        SELECT terminal_reason, had_partial_progress, completed_step_count, attempted_step_count, step_outcome_count
        FROM agent_execution_sessions
        WHERE session_id = ?
      `)
      .get("agent-session:test:1") as {
        terminal_reason: string | null;
        had_partial_progress: number | null;
        completed_step_count: number | null;
        attempted_step_count: number | null;
        step_outcome_count: number;
      };
    expect(row.terminal_reason).toBe("completed");
    expect(row.had_partial_progress).toBe(0);
    expect(row.completed_step_count).toBe(0);
    expect(row.attempted_step_count).toBe(0);
    expect(row.step_outcome_count).toBe(0);
    db.close();

    repository.dispose();
  });

  it("persists session step outcomes across saves", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-agent-session-"));
    createdRoots.push(root);
    const repository = new SqliteAgentExecutionSessionRepository(path.join(root, "agent-sessions.sqlite"));

    let session = createAgentExecutionSession({
      id: "agent-session:test:2",
      agentId: "agent-runtime",
      planId: "agent-plan:2",
    });
    await repository.save(session);
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.running });
    await repository.save(session);
    session = transitionAgentExecutionSession(session, {
      status: AgentExecutionSessionStatuses.running,
      appendStepOutcome: {
        stepId: "s1",
        status: "completed",
        attempts: 1,
        toolId: "mcp:local:echo",
        output: "ok",
      },
    });
    await repository.save(session);
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.failed });
    await repository.save(session);

    const loaded = await repository.getById("agent-session:test:2");
    expect(loaded?.stepOutcomes).toHaveLength(1);
    expect(loaded?.stepOutcomes[0]?.stepId).toBe("s1");
    expect(loaded?.stepOutcomes[0]?.status).toBe("completed");
    expect(loaded?.terminalState?.reason).toBe("failed");
    expect(loaded?.terminalState?.hadPartialProgress).toBe(true);
    const db = new Database(path.join(root, "agent-sessions.sqlite"));
    const row = db
      .prepare(`
        SELECT terminal_reason, had_partial_progress, completed_step_count, attempted_step_count, step_outcome_count
        FROM agent_execution_sessions
        WHERE session_id = ?
      `)
      .get("agent-session:test:2") as {
        terminal_reason: string | null;
        had_partial_progress: number | null;
        completed_step_count: number | null;
        attempted_step_count: number | null;
        step_outcome_count: number;
      };
    expect(row.terminal_reason).toBe("failed");
    expect(row.had_partial_progress).toBe(1);
    expect(row.completed_step_count).toBe(1);
    expect(row.attempted_step_count).toBe(1);
    expect(row.step_outcome_count).toBe(1);
    db.close();

    repository.dispose();
  });
});

