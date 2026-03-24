import { describe, expect, it } from "bun:test";
import { AssetId } from "../../../../domain/assets/AssetId";
import {
  buildAgentExecutionUnitPayload,
  mapAgentExecutionToBackbone,
  mapAgentExecutionToExecutionPlan,
  mapAgentPlanToBackbone,
} from "../AgentExecutionMapping";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "../../../../domain/agents/AgentExecutionSession";
import { createAgentPlan } from "../../../../domain/agents/AgentPlan";

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
        { stepId: "step-1", goalId: "goal-1", toolId: "mcp:local:echo", intent: { action: "Collect context", expectedOutputKey: "ctx" } },
        {
          stepId: "step-2",
          goalId: "goal-1",
          toolId: "mcp:local:summarize",
          intent: { action: "Summarize context", inputAssetIds: [new AssetId("asset:memory:ctx")], expectedOutputKey: "summary" },
          dependsOnStepIds: ["step-1"],
        },
      ],
    });

    expect(executionPlan.id).toBe("agent-plan:1");
    expect(executionPlan.units[1]?.dependsOn).toEqual(["step-1"]);
    expect(executionPlan.units[0]?.kind).toBe("agent-tool-step");
  });

  it("maps execution-oriented AgentPlan contracts into execution-native backbone structures", () => {
    const session = createAgentExecutionSession({ id: "sess-plan-map", agentId: "agent-z", planId: "agent-plan:z" });
    const plan = createAgentPlan({
      planId: "agent-plan:z",
      agentId: "agent-z",
      strategyId: "deterministic",
      steps: [
        {
          stepId: "s1",
          goalId: "g1",
          toolId: "mcp:local:echo",
          dependsOnStepIds: [],
          intent: {
            action: "Collect",
            expectedOutputKey: "collect.result",
            inputReferences: [{ kind: "asset", assetId: new AssetId("asset:memory:a") }],
          },
        },
      ],
    });

    const mapped = mapAgentPlanToBackbone({ session, plan });

    expect(mapped.plan.id).toBe("agent-plan:z");
    expect(mapped.plan.units[0]?.id).toBe("s1");
    expect(mapped.unitPayloadByUnitId.s1?.expectedOutputKey).toBe("collect.result");
    expect(mapped.unitPayloadByUnitId.s1?.inputAssetIds[0]?.toString()).toBe("asset:memory:a");
  });

  it("creates payloads that preserve agent/session correlation identifiers", () => {
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
    const ready = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.ready });
    const running = transitionAgentExecutionSession(ready, { status: AgentExecutionSessionStatuses.running });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendExecutionRun: { runId: "run-1", status: "running" },
      appendDiagnostic: { assetId: new AssetId("asset:diag:1") },
    });

    expect(completed.executionRuns.map((run) => run.runId)).toEqual(["run-1"]);
    expect(completed.diagnostics.map((entry) => entry.assetId.toString())).toEqual(["asset:diag:1"]);
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

    expect(() =>
      mapAgentExecutionToBackbone({
        session,
        steps: [{ stepId: "step-1", toolId: "mcp:local:echo", intent: { action: "one", inputAssetIds: [new AssetId("not-canonical")] } }],
      }),
    ).toThrow("canonical asset id format");

    expect(() =>
      mapAgentExecutionToBackbone({
        session,
        steps: [
          { stepId: "step-1", toolId: "mcp:local:echo", intent: { action: "one", expectedOutputKey: "result" } },
          { stepId: "step-2", toolId: "mcp:local:echo", intent: { action: "two", expectedOutputKey: "result" } },
        ],
      }),
    ).toThrow("must be unique across steps");

    const wrongAgentPlan = createAgentPlan({
      planId: "agent-plan:5",
      agentId: "agent-other",
      strategyId: "deterministic",
      steps: [{ stepId: "s1", toolId: "mcp:local:echo", dependsOnStepIds: [], intent: { action: "go", inputReferences: [] } }],
    });

    expect(() => mapAgentPlanToBackbone({ session, plan: wrongAgentPlan })).toThrow("must match session agentId");
  });
});
