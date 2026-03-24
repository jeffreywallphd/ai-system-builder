import { describe, expect, it } from "bun:test";
import {
  buildAgentExecutionUnitPayload,
  mapAgentExecutionToBackbone,
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
        { stepId: "step-1", goalId: "goal-1", toolId: "mcp:local:echo", intent: { action: "Collect context" } },
        {
          stepId: "step-2",
          goalId: "goal-1",
          toolId: "mcp:local:summarize",
          intent: { action: "Summarize context", inputAssetIds: ["asset:memory:ctx"], expectedOutputKey: "summary" },
          dependsOnStepIds: ["step-1"],
        },
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
      step: { stepId: "step-1", goalId: "goal-2", toolId: "mcp:local:echo", intent: { action: "Ping" } },
    });

    expect(payload.planId).toBe("agent-plan:2");
    expect(payload.agentId).toBe("agent-b");
    expect(payload.toolId).toBe("mcp:local:echo");
    expect(payload.goalId).toBe("goal-2");
  });

  it("exposes an explicit mapping seam with payloads keyed by execution unit id", () => {
    const session = createAgentExecutionSession({ id: "sess-3", agentId: "agent-c" });

    const mapped = mapAgentExecutionToBackbone({
      session,
      steps: [{ stepId: "step-1", toolId: "mcp:local:echo", intent: { action: "Ping", expectedOutputKey: "pong" } }],
    });

    expect(mapped.plan.id).toBe("agent-plan:sess-3");
    expect(Object.keys(mapped.unitPayloadByUnitId)).toEqual(["step-1"]);
    expect(mapped.unitPayloadByUnitId["step-1"]?.planId).toBe("agent-plan:sess-3");
    expect(mapped.unitPayloadByUnitId["step-1"]?.expectedOutputKey).toBe("pong");
  });

  it("tracks execution session lifecycle with terminal timestamps", () => {
    const session = createAgentExecutionSession({ id: "sess-4", agentId: "agent-d" });
    const planning = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.planning });
    const running = transitionAgentExecutionSession(planning, { status: AgentExecutionSessionStatuses.running });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendExecutionRunId: "run-1",
      appendDiagnosticAssetId: "asset:diag:1",
    });

    expect(completed.executionRunIds).toEqual(["run-1"]);
    expect(completed.diagnosticAssetIds).toEqual(["asset:diag:1"]);
    expect(completed.endTime).toBeDefined();
  });

  it("rejects malformed mapping inputs and incompatible assumptions", () => {
    const session = createAgentExecutionSession({ id: "sess-5", agentId: "agent-e" });

    expect(() => mapAgentExecutionToBackbone({ session, steps: [] })).toThrow("requires at least one step");

    expect(() =>
      mapAgentExecutionToBackbone({
        session,
        steps: [{ stepId: "step-1", toolId: "", intent: { action: "Ping" } }],
      }),
    ).toThrow("toolId is required");

    expect(() =>
      mapAgentExecutionToBackbone({
        session,
        steps: [
          { stepId: "step-1", toolId: "mcp:echo", intent: { action: "one" }, dependsOnStepIds: ["step-2"] },
          { stepId: "step-1", toolId: "mcp:echo", intent: { action: "two" } },
        ],
      }),
    ).toThrow("unique step ids");
  });
});
