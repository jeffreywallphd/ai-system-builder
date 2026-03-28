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
    expect(result.progression.map((entry) => entry.nodeId)).toEqual(result.plan?.orderedNodeIds);
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
});
