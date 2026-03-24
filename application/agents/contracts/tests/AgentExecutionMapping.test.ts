import { describe, expect, it } from "bun:test";
import {
  buildAgentExecutionUnitPayload,
  mapAgentExecutionToExecutionPlan,
} from "../AgentExecutionMapping";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "../../../../domain/agents/AgentExecutionSession";

describe("Agent execution backbone mapping", () => {
  it("maps ordered agent plan steps into the unified execution plan contract", () => {
    const session = createAgentExecutionSession({
      id: "agent-session-1",
      agentId: "agent-a",
      planId: "agent-plan:1",
      status: AgentExecutionSessionStatuses.running,
    });

    const executionPlan = mapAgentExecutionToExecutionPlan({
      session,
      steps: [
        { stepId: "step-1", toolId: "mcp:local:echo", objective: "Collect context" },
        { stepId: "step-2", toolId: "mcp:local:summarize", objective: "Summarize context", dependsOnStepIds: ["step-1"] },
      ],
    });

    expect(executionPlan.id).toBe("agent-plan:1");
    expect(executionPlan.units[1]?.dependsOn).toEqual(["step-1"]);
    expect(executionPlan.units[0]?.kind).toBe("agent-tool-step");
  });

  it("creates payloads that preserve agent/session/run correlation identifiers", () => {
    const session = createAgentExecutionSession({ id: "sess-2", agentId: "agent-b", planId: "agent-plan:2" });

    const payload = buildAgentExecutionUnitPayload({
      session,
      step: { stepId: "step-1", toolId: "mcp:local:echo", objective: "Ping" },
    });

    expect(payload.planId).toBe("agent-plan:2");
    expect(payload.agentId).toBe("agent-b");
    expect(payload.toolId).toBe("mcp:local:echo");
  });

  it("tracks execution session lifecycle with terminal timestamps", () => {
    const session = createAgentExecutionSession({ id: "sess-3", agentId: "agent-c" });
    const running = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.running });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendExecutionRunId: "run-1",
      appendDiagnosticAssetId: "asset:diag:1",
    });

    expect(completed.executionRunIds).toEqual(["run-1"]);
    expect(completed.diagnosticAssetIds).toEqual(["asset:diag:1"]);
    expect(completed.endTime).toBeDefined();
  });
});
