import { describe, expect, it } from "bun:test";
import { UxRunActionKinds, UxRuntimeService } from "../UxRuntimeService";

describe("UxRuntimeService", () => {
  it("maps UX run requests into run launch paths", () => {
    const service = new UxRuntimeService();
    const launchPath = service.resolveRunSurfacePath({
      action: UxRunActionKinds.run,
      target: { kind: "asset", assetId: "asset:workflow:1", versionId: "asset:workflow:1:v1" },
      context: { source: "detail", buildFlowSessionId: "build-flow-1", originPath: "/registry/asset%3Aworkflow%3A1" },
    });

    expect(launchPath).toContain("/run?");
    expect(launchPath).toContain("context=asset");
    expect(launchPath).toContain("assetId=asset%3Aworkflow%3A1");
    expect(launchPath).toContain("buildFlowSessionId=build-flow-1");
  });

  it("maps workflow-target runs into workflow run context paths", () => {
    const service = new UxRuntimeService();
    const launchPath = service.resolveRunSurfacePath({
      action: UxRunActionKinds.run,
      target: { kind: "workflow", assetId: "workflow:persisted:2", versionId: "v2" },
      context: { source: "explore", originPath: "/explore", originLabel: "Explore" },
    });

    expect(launchPath).toContain("context=workflow");
    expect(launchPath).toContain("workflowId=workflow%3Apersisted%3A2");
  });

  it("adapts runtime status/result into UX-facing snapshot models", async () => {
    const service = new UxRuntimeService();
    const snapshot = await service.readSystemRunSnapshot("exec-1", {
      getSystemExecutionStatus: async () => ({
        ok: true,
        data: {
          executionId: "exec-1",
          status: "running",
          progress: { totalNodeCount: 3, completedNodeCount: 1, runningNodeCount: 1, failedNodeCount: 0 },
          recovery: { decisionCount: 1, retryDecisionCount: 1 },
          errorCount: 0,
          nodeStatuses: [],
          nestedSystems: [],
          traceReferenceCount: 0,
          startedAt: "2026-03-28T00:00:00.000Z",
          lastUpdatedAt: "2026-03-28T00:01:00.000Z",
        },
      }),
      getSystemExecutionTrace: async () => ({ ok: true, data: { executionId: "exec-1", trace: { events: [], logs: [], lastEventAt: undefined } } }),
      getSystemExecutionResult: async () => ({
        ok: true,
        data: {
          executionId: "exec-1",
          status: "running",
          output: {},
          outputSummary: { hasOutput: false, outputFieldCount: 0, contractOutputIds: [] },
          diagnostics: [],
          nodeResults: [],
          nestedSystemResults: [],
          completedAt: undefined,
        },
      }),
    });

    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.status.state).toBe("running");
    expect(snapshot.data?.status.progressLabel).toContain("1/3 nodes");
    expect(snapshot.data?.result?.runId).toBe("exec-1");
  });
});
