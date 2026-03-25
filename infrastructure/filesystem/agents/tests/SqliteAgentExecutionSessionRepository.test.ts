import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "../../../../domain/agents/AgentExecutionSession";
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

    const listed = await repository.listByAgentId("agent-runtime");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe("agent-session:test:1");
    expect(listed[0]?.stepOutcomes).toEqual([]);

    const transitions = await repository.listTransitionHistory("agent-session:test:1");
    expect(transitions.map((entry) => entry.status)).toEqual(["pending", "ready", "running", "completed"]);

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

    repository.dispose();
  });
});
