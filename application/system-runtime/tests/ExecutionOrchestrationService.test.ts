import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemCompositionReference,
} from "../../../domain/system-studio/SystemAssetDomain";
import { RuntimeBehaviorAlignmentService } from "../RuntimeBehaviorAlignment";
import { resolveSystemRuntimeDependencies } from "../RuntimeDependencyResolution";
import { mapSystemContractToRuntimeExecutionContract } from "../RuntimeExecutionContractMapping";
import { ExecutionPlanBuilder } from "../ExecutionPlanBuilder";
import { ExecutionOrchestrationService } from "../ExecutionOrchestrationService";
import { StepExecutionEngine, type IStepExecutionEngine, type StepExecutionRequest, type StepExecutionResult } from "../StepExecutionEngine";

const resolver = new CompositionAssetContractResolver();
const behaviorAlignment = new RuntimeBehaviorAlignmentService(new CompositionTaxonomyClassifier());

function createSystem(input: {
  readonly assetId: string;
  readonly versionId: string;
  readonly behaviorKind?: "deterministic" | "conditional" | "iterative" | "autonomous";
  readonly components?: SystemAsset["components"];
  readonly nestedSystems?: SystemAsset["nestedSystems"];
  readonly bindings?: SystemAsset["bindings"];
}): SystemAsset {
  return createSystemAsset({
    assetId: input.assetId,
    versionId: input.versionId,
    taxonomy: createSystemStudioTaxonomy("system", input.behaviorKind ?? "deterministic"),
    components: input.components,
    nestedSystems: input.nestedSystems,
    bindings: input.bindings,
    inputs: [{ inputId: "request", required: true, valueType: "object" }],
    outputs: [{ outputId: "result", valueType: "object" }],
    parameters: [{ parameterId: "temperature", valueType: "number" }],
  });
}

async function createRuntimeBundle(root: SystemAsset, resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined>) {
  const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
    root,
    contract: await resolver.resolveSystemContract({
      root,
      resolveSystem,
      resolveChildContract: async (component) => component.taxonomy ? resolver.resolveContractForTaxonomy(component.taxonomy) : undefined,
    }),
    resolveSystem,
    resolveChildContract: async (component) => component.taxonomy ? resolver.resolveContractForTaxonomy(component.taxonomy) : undefined,
  });

  const dependencyResolution = await resolveSystemRuntimeDependencies({ root, resolveSystem });
  const behavior = behaviorAlignment.resolveSystemRuntimeBehavior("system", root.taxonomy.behaviorKind);

  return Object.freeze({ runtimeContract, dependencyResolution, behavior });
}

class RecordingStepEngine implements IStepExecutionEngine {
  public readonly calls: StepExecutionRequest[] = [];

  public async executeStep(request: StepExecutionRequest): Promise<StepExecutionResult> {
    this.calls.push(request);
    return Object.freeze({
      nodeId: request.node.nodeId,
      status: "succeeded",
      startedAt: "2026-03-28T00:00:00.000Z",
      completedAt: "2026-03-28T00:00:01.000Z",
      output: Object.freeze({ ok: true, nodeId: request.node.nodeId }),
    });
  }
}

class FailingStepEngine implements IStepExecutionEngine {
  public async executeStep(request: StepExecutionRequest): Promise<StepExecutionResult> {
    return Object.freeze({
      nodeId: request.node.nodeId,
      status: "failed",
      startedAt: "2026-03-28T00:00:00.000Z",
      completedAt: "2026-03-28T00:00:01.000Z",
      error: {
        code: "nested-systems-unsupported",
        message: "Nested systems are unavailable in the selected runtime.",
      },
    });
  }
}

describe("ExecutionOrchestrationService", () => {
  it("initializes runtime execution and deterministically sequences plan nodes", async () => {
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v1",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
      ],
    });

    const runtime = await createRuntimeBundle(root, async () => undefined);
    const stepEngine = new RecordingStepEngine();
    const service = new ExecutionOrchestrationService(stepEngine, new ExecutionPlanBuilder());

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { prompt: "hello" },
      startedAt: "2026-03-28T10:00:00.000Z",
    });

    expect(result.status).toBe("completed");
    expect(result.execution?.status).toBe("succeeded");
    expect(result.execution?.nodes.map((entry) => entry.executionNodeId)).toEqual(result.plan?.orderedNodeIds);
    expect(result.progression.filter((entry) => entry.passIndex === 0).map((entry) => entry.nodeId)).toEqual(result.plan?.orderedNodeIds);
    expect(result.execution?.runtimeState.snapshot.totalNodeCount).toBe(result.plan?.orderedNodeIds.length);
  });

  it("delegates step execution to the step engine seam", async () => {
    const root = createSystem({ assetId: "system:root", versionId: "system:root:v2" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const stepEngine = new RecordingStepEngine();
    const service = new ExecutionOrchestrationService(stepEngine);

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { run: true },
    });

    expect(result.status).toBe("completed");
    expect(stepEngine.calls.length).toBe(result.plan?.orderedNodeIds.length ?? 0);
  });

  it("handles nested systems with bounded recursion-safe plan semantics", async () => {
    const child = createSystem({ assetId: "system:child", versionId: "system:child:v1" });
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v3",
      components: [
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v1",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });

    const systems = new Map<string, SystemAsset>([["system:child::system:child:v1", child]]);
    const runtime = await createRuntimeBundle(root, async (reference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`));
    const service = new ExecutionOrchestrationService(new StepExecutionEngine());

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { request: "nested" },
    });

    expect(result.status).toBe("completed");
    expect(result.plan?.recursion.status).toBe("complete");
    expect(result.progression.some((entry) => entry.nodeId.includes("child"))).toBe(true);
    expect(result.execution?.runtimeState.nodeStates.some((entry) => entry.executionNodeId.includes("child"))).toBe(true);
  });

  it("surfaces invalid plan/environment mismatches truthfully", async () => {
    const root = createSystem({ assetId: "system:root", versionId: "system:root:v4" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const planBuild = new ExecutionPlanBuilder().build({ root, ...runtime });
    expect(planBuild.status).toBe("built");

    const mismatchedEnvironmentPlan = {
      ...planBuild.plan!,
      environment: {
        ...planBuild.plan!.environment,
        environmentId: "runtime:other",
      },
    };

    const result = await new ExecutionOrchestrationService(new StepExecutionEngine()).orchestrate({
      root,
      ...runtime,
      executionPlan: mismatchedEnvironmentPlan,
      environment: planBuild.plan!.environment,
      inputPayload: {},
    });

    expect(result.status).toBe("invalid");
    expect(result.errors[0]).toContain("does not match requested environment");
  });

  it("runs bounded iterative progression only for iterative-capable behavior", async () => {
    const root = createSystem({ assetId: "system:iter", versionId: "system:iter:v1", behaviorKind: "iterative" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const service = new ExecutionOrchestrationService(new StepExecutionEngine());

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { loop: true },
      maxIterationsPerNode: 2,
    });

    expect(result.status).toBe("completed");
    const rootProgression = result.progression.filter((entry) => entry.nodeId.startsWith("system:"));
    expect(rootProgression.length).toBe(2);
    expect(rootProgression[0]?.decision).toBe("iterate");
    expect(rootProgression[1]?.decision).toBe("complete");
  });

  it("runs bounded autonomous planning progression", async () => {
    const root = createSystem({ assetId: "system:auto", versionId: "system:auto:v1", behaviorKind: "autonomous" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const service = new ExecutionOrchestrationService(new StepExecutionEngine());

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { plan: true },
      maxPlanningCyclesPerNode: 2,
    });

    expect(result.status).toBe("completed");
    const rootProgression = result.progression.filter((entry) => entry.nodeId.startsWith("system:"));
    expect(rootProgression.length).toBe(2);
    expect(rootProgression[0]?.decision).toBe("replan");
    expect(rootProgression[1]?.decision).toBe("complete");
  });

  it("keeps deterministic profiles on single-pass progression", async () => {
    const root = createSystem({ assetId: "system:det", versionId: "system:det:v1", behaviorKind: "deterministic" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const service = new ExecutionOrchestrationService(new StepExecutionEngine());

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { run: true },
      maxIterationsPerNode: 4,
      maxPlanningCyclesPerNode: 4,
    });

    expect(result.status).toBe("completed");
    expect(result.progression.filter((entry) => entry.nodeId.startsWith("system:")).length).toBe(1);
  });

  it("records execution and node trace events for orchestration progress", async () => {
    const root = createSystem({
      assetId: "system:trace",
      versionId: "system:trace:v1",
      components: [
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v1",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    const child = createSystem({ assetId: "system:child", versionId: "system:child:v1" });
    const systems = new Map<string, SystemAsset>([["system:child::system:child:v1", child]]);
    const runtime = await createRuntimeBundle(root, async (reference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`));

    const result = await new ExecutionOrchestrationService(new StepExecutionEngine()).orchestrate({
      root,
      ...runtime,
      inputPayload: { run: "trace" },
    });

    expect(result.status).toBe("completed");
    const traceEvents = result.execution?.runtimeState.trace.events ?? [];
    expect(traceEvents.some((entry) => entry.kind === "execution-status-changed" && entry.status === "running")).toBe(true);
    expect(traceEvents.some((entry) => entry.kind === "nested-system-entered")).toBe(true);
    expect(traceEvents.some((entry) => entry.kind === "nested-system-completed")).toBe(true);
  });

  it("enforces bounded trace/runtime-state growth under iterative progression", async () => {
    const root = createSystem({ assetId: "system:bounded", versionId: "system:bounded:v1", behaviorKind: "iterative" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const result = await new ExecutionOrchestrationService(new StepExecutionEngine()).orchestrate({
      root,
      ...runtime,
      inputPayload: { bounded: true },
      maxIterationsPerNode: 8,
      maxTraceEvents: 6,
      maxTraceLogs: 2,
      maxRuntimeErrors: 2,
      maxProgressionEntries: 5,
    });

    expect(result.status).toBe("completed");
    expect((result.execution?.runtimeState.trace.events.length ?? 0) <= 6).toBe(true);
    expect((result.execution?.runtimeState.trace.logs.length ?? 0) <= 2).toBe(true);
    expect(result.progression.length <= 5).toBe(true);
  });

  it("applies bounded retry for transient step failures and records recovery traces", async () => {
    const root = createSystem({ assetId: "system:retry", versionId: "system:retry:v1" });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const attemptsByNode = new Map<string, number>();
    const stepEngine = new StepExecutionEngine([{
      adapterId: "flaky-adapter",
      canExecute: () => true,
      execute: (request) => {
        const attempts = attemptsByNode.get(request.node.nodeId) ?? 0;
        attemptsByNode.set(request.node.nodeId, attempts + 1);
        if (attempts === 0) {
          throw new Error("temporary failure");
        }
        return Object.freeze({
          nodeId: request.node.nodeId,
          status: "succeeded",
          startedAt: "2026-03-28T00:00:00.000Z",
          completedAt: "2026-03-28T00:00:01.000Z",
          output: Object.freeze({ recovered: true }),
        });
      },
    }]);
    const service = new ExecutionOrchestrationService(stepEngine);

    const result = await service.orchestrate({
      root,
      ...runtime,
      inputPayload: { retry: true },
    });

    expect(result.status).toBe("completed");
    expect(result.execution?.runtimeState.trace.events.some((event) =>
      event.kind === "recovery-decided" && event.summary?.includes("Retrying")
    )).toBe(true);
  });

  it("propagates unrecoverable failures into runtime errors and terminal execution status", async () => {
    const root = createSystem({
      assetId: "system:fail",
      versionId: "system:fail:v1",
      components: [
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v1",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    const runtime = await createRuntimeBundle(root, async () => undefined);
    const result = await new ExecutionOrchestrationService(new FailingStepEngine()).orchestrate({
      root,
      ...runtime,
      inputPayload: { fail: true },
    });

    expect(result.status).toBe("failed");
    expect(result.execution?.status).toBe("failed");
    expect(result.execution?.runtimeState.errors.length).toBeGreaterThan(0);
    expect(result.execution?.runtimeState.errors[0]?.kind).toBe("environment-mismatch");
  });
});
