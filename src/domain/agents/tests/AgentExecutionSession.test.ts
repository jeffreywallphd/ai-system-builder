import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "../AgentExecutionSession";

describe("AgentExecutionSession", () => {
  it("supports valid transitions and terminal timing coherence", () => {
    const created = createAgentExecutionSession({
      id: "sess-1",
      agentId: "agent-1",
      planId: "agent-plan:1",
      startTime: new Date("2026-03-24T10:00:00.000Z"),
    });

    const running = transitionAgentExecutionSession(
      transitionAgentExecutionSession(created, { status: AgentExecutionSessionStatuses.ready }),
      { status: AgentExecutionSessionStatuses.running, appendExecutionRun: { runId: "run-1", status: "running" } },
    );

    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendDiagnostic: { assetId: new AssetId("asset:diag:1"), assetVersionId: "v1" },
      endedAt: new Date("2026-03-24T10:00:10.000Z"),
    });

    expect(completed.endTime).toBe("2026-03-24T10:00:10.000Z");
    expect(completed.executionRuns[0]?.planId).toBe("agent-plan:1");
    expect(completed.terminalState).toEqual({
      reason: "completed",
      hadPartialProgress: false,
      completedStepCount: 0,
      attemptedStepCount: 0,
    });
  });

  it("rejects invalid transitions and run-plan mismatch", () => {
    const created = createAgentExecutionSession({ id: "sess-2", agentId: "agent-2", planId: "agent-plan:2" });

    expect(() => transitionAgentExecutionSession(created, { status: AgentExecutionSessionStatuses.completed })).toThrow("Invalid agent execution session transition");

    expect(() => transitionAgentExecutionSession(created, {
      status: AgentExecutionSessionStatuses.ready,
      appendExecutionRun: { runId: "run-x", planId: "agent-plan:other", status: "running" },
    })).toThrow("must match session planId");
  });

  it("enforces canonical diagnostic and persistence-oriented invariants", () => {
    const created = createAgentExecutionSession({ id: "sess-3", agentId: "agent-3" });

    expect(() => transitionAgentExecutionSession(created, {
      status: AgentExecutionSessionStatuses.ready,
      appendDiagnostic: { assetId: new AssetId("bad-id") },
    })).toThrow("canonical asset id format");

    const terminal = transitionAgentExecutionSession(
      transitionAgentExecutionSession(
        transitionAgentExecutionSession(created, { status: AgentExecutionSessionStatuses.ready }),
        { status: AgentExecutionSessionStatuses.running },
      ),
      { status: AgentExecutionSessionStatuses.failed },
    );

    expect(() => transitionAgentExecutionSession(terminal, { status: AgentExecutionSessionStatuses.running })).toThrow("Invalid agent execution session transition");
  });

  it("supports blocked terminal reason on failed sessions", () => {
    const created = createAgentExecutionSession({ id: "sess-5", agentId: "agent-5" });
    const running = transitionAgentExecutionSession(
      transitionAgentExecutionSession(created, { status: AgentExecutionSessionStatuses.ready }),
      {
        status: AgentExecutionSessionStatuses.running,
        appendStepOutcome: {
          stepId: "step-1",
          status: "completed",
          attempts: 1,
          toolId: "mcp:local:echo",
          output: "ok",
        },
      },
    );

    const blocked = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.failed,
      terminalState: {
        reason: "blocked",
        hadPartialProgress: true,
        completedStepCount: 1,
        attemptedStepCount: 1,
      },
    });

    expect(blocked.terminalState?.reason).toBe("blocked");
    expect(blocked.terminalState?.hadPartialProgress).toBe(true);
    expect(blocked.terminalState?.completedStepCount).toBe(1);
    expect(blocked.terminalState?.attemptedStepCount).toBe(1);
  });

  it("rejects terminal end time earlier than start", () => {
    const created = createAgentExecutionSession({
      id: "sess-4",
      agentId: "agent-4",
      startTime: new Date("2026-03-24T10:00:00.000Z"),
    });

    const running = transitionAgentExecutionSession(
      transitionAgentExecutionSession(created, { status: AgentExecutionSessionStatuses.ready }),
      { status: AgentExecutionSessionStatuses.running },
    );

    expect(() => transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      endedAt: new Date("2026-03-24T09:59:59.000Z"),
    })).toThrow("cannot be earlier than startTime");
  });
});
