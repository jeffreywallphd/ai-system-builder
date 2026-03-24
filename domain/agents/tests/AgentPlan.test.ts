import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import { createAgentPlan, normalizeAgentPlan } from "../AgentPlan";

describe("AgentPlan", () => {
  it("builds dependency-aware execution-oriented plans", () => {
    const plan = createAgentPlan({
      planId: "agent-plan:1",
      agentId: "agent-1",
      strategyId: "deterministic",
      steps: [
        {
          stepId: "s1",
          toolId: "mcp:local:fetch",
          dependsOnStepIds: [],
          goalId: "g1",
          intent: {
            action: "Fetch data",
            expectedOutputKey: "raw",
            inputReferences: [{ kind: "asset", assetId: new AssetId("asset:memory:seed") }],
          },
        },
        {
          stepId: "s2",
          toolId: "mcp:local:summarize",
          goalId: "g1",
          dependsOnStepIds: ["s1"],
          intent: {
            action: "Summarize",
            expectedOutputKey: "summary",
            inputReferences: [{ kind: "step-output", stepId: "s1", outputKey: "raw" }],
          },
        },
      ],
    });

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1]?.dependsOnStepIds).toEqual(["s1"]);
  });

  it("rejects invalid references, cycles, and malformed output keys", () => {
    expect(() => normalizeAgentPlan({
      planId: "p",
      agentId: "a",
      strategyId: "s",
      createdAt: new Date().toISOString(),
      steps: [{
        stepId: "s1",
        toolId: "mcp:local:echo",
        dependsOnStepIds: [],
        intent: {
          action: "bad",
          expectedOutputKey: "not valid",
          inputReferences: [],
        },
      }],
    })).toThrow("malformed");

    expect(() => normalizeAgentPlan({
      planId: "p",
      agentId: "a",
      strategyId: "s",
      createdAt: new Date().toISOString(),
      steps: [{
        stepId: "s1",
        toolId: "mcp:local:echo",
        dependsOnStepIds: [],
        intent: {
          action: "bad",
          inputReferences: [{ kind: "step-output", stepId: "missing", outputKey: "out" }],
        },
      }],
    })).toThrow("unknown step output");

    expect(() => normalizeAgentPlan({
      planId: "p",
      agentId: "a",
      strategyId: "s",
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: "s1",
          toolId: "mcp:local:echo",
          dependsOnStepIds: ["s2"],
          intent: { action: "one", inputReferences: [] },
        },
        {
          stepId: "s2",
          toolId: "mcp:local:echo",
          dependsOnStepIds: ["s1"],
          intent: { action: "two", inputReferences: [] },
        },
      ],
    })).toThrow("dependency cycle");


    expect(() => normalizeAgentPlan({
      planId: "p",
      agentId: "a",
      strategyId: "s",
      createdAt: new Date().toISOString(),
      steps: [
        {
          stepId: "s1",
          toolId: "mcp:local:echo",
          dependsOnStepIds: [],
          intent: {
            action: "collect",
            expectedOutputKey: "collect.result",
            inputReferences: [],
          },
        },
        {
          stepId: "s2",
          toolId: "mcp:local:echo",
          dependsOnStepIds: ["s1"],
          intent: {
            action: "use",
            inputReferences: [{ kind: "step-output", stepId: "s1", outputKey: "different.result" }],
          },
        },
      ],
    })).toThrow("declares expectedOutputKey");
  });
});
