import { describe, expect, it } from "bun:test";
import { createSystemStudioTaxonomy } from "../../../domain/system-studio/SystemAssetDomain";
import type { RuntimeEnvironment } from "../../../domain/system-runtime/RuntimeEnvironmentDomain";
import { RuntimeEnvironmentKinds } from "../../../domain/system-runtime/RuntimeEnvironmentDomain";
import { createSystemExecution } from "../../../domain/system-runtime/SystemRuntimeDomain";
import type { ExecutionPlan } from "../ExecutionPlanBuilder";
import { StepExecutionEngine } from "../StepExecutionEngine";

const rootTaxonomy = createSystemStudioTaxonomy("system", "deterministic");

function createExecutionPlan(environment: RuntimeEnvironment): ExecutionPlan {
  return Object.freeze({
    planId: "plan:1",
    rootSystemAssetId: "system:root",
    rootSystemVersionId: "system:root:v1",
    environment,
    nodes: Object.freeze([
      {
        nodeId: "system:system:root:system:root:v1",
        nodeType: "system-root",
        assetId: "system:root",
        versionId: "system:root:v1",
        taxonomy: rootTaxonomy,
        behavior: {
          behaviorKind: "deterministic",
          executionPattern: "fixed",
          supportsBranching: false,
          supportsIteration: false,
          supportsPlanning: false,
        },
        dependsOnNodeIds: Object.freeze([]),
        environmentId: environment.environmentId,
      },
      {
        nodeId: "component:system:root:model:asset:model:v1",
        parentNodeId: "system:system:root:system:root:v1",
        nodeType: "component",
        componentKind: "atomic",
        alias: "model",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        behavior: {
          behaviorKind: "deterministic",
          executionPattern: "fixed",
          supportsBranching: false,
          supportsIteration: false,
          supportsPlanning: false,
        },
        dependsOnNodeIds: Object.freeze(["system:system:root:system:root:v1"]),
        environmentId: environment.environmentId,
      },
      {
        nodeId: "component:system:root:flow:asset:wf:v1",
        parentNodeId: "system:system:root:system:root:v1",
        nodeType: "component",
        componentKind: "composite",
        alias: "flow",
        assetId: "asset:wf",
        versionId: "asset:wf:v1",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
        behavior: {
          behaviorKind: "conditional",
          executionPattern: "branch-capable",
          supportsBranching: true,
          supportsIteration: false,
          supportsPlanning: false,
        },
        dependsOnNodeIds: Object.freeze(["system:system:root:system:root:v1"]),
        environmentId: environment.environmentId,
      },
      {
        nodeId: "component:system:root:child:system:child:v1",
        parentNodeId: "system:system:root:system:root:v1",
        nodeType: "component",
        componentKind: "system",
        alias: "child",
        assetId: "system:child",
        versionId: "system:child:v1",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" },
        behavior: {
          behaviorKind: "iterative",
          executionPattern: "loop-capable",
          supportsBranching: true,
          supportsIteration: true,
          supportsPlanning: false,
        },
        dependsOnNodeIds: Object.freeze(["system:system:root:system:root:v1"]),
        environmentId: environment.environmentId,
      },
    ]),
    edges: Object.freeze([]),
    orderedNodeIds: Object.freeze([
      "system:system:root:system:root:v1",
      "component:system:root:model:asset:model:v1",
      "component:system:root:flow:asset:wf:v1",
      "component:system:root:child:system:child:v1",
    ]),
    interfaces: {
      systemAssetId: "system:root",
      taxonomy: rootTaxonomy,
      sourceContractVersion: "1.0.0",
      systemVersionId: "system:root:v1",
      inputs: Object.freeze([]),
      outputs: Object.freeze([]),
      parameters: Object.freeze([]),
      childInterfaces: Object.freeze([]),
      recursion: Object.freeze({ maxDepth: 4, status: "complete", nestedSystemCount: 1, unresolvedNestedSystemCount: 0 }),
    },
    dependencyResolution: {
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v1",
      resolvedComponents: Object.freeze([]),
      directDependencies: Object.freeze([]),
      transitiveDependencies: Object.freeze([]),
      allDependencies: Object.freeze([]),
      dependencyOrderingHints: Object.freeze([]),
      traversedSystemAssetIds: Object.freeze(["system:root"]),
      recursion: Object.freeze({ maxDepth: 4, status: "complete", unresolvedNestedSystemCount: 0 }),
    },
    bindings: Object.freeze([]),
    recursion: Object.freeze({ maxDepth: 4, status: "complete", unresolvedNestedSystemCount: 0 }),
  });
}

function createEnvironment(input?: Partial<RuntimeEnvironment>): RuntimeEnvironment {
  return Object.freeze({
    environmentId: input?.environmentId ?? "runtime:local",
    kind: input?.kind ?? RuntimeEnvironmentKinds.local,
    displayName: input?.displayName ?? "Local",
    isDefault: input?.isDefault ?? true,
    capabilities: {
      supportsStructuralKinds: input?.capabilities?.supportsStructuralKinds ?? ["atomic", "composite", "system"],
      supportsNestedSystems: input?.capabilities?.supportsNestedSystems ?? true,
      supportsMcpMediatedExecution: input?.capabilities?.supportsMcpMediatedExecution ?? true,
    },
  });
}

function createExecution() {
  return createSystemExecution({
    executionId: "exec-1",
    root: { assetId: "system:root", versionId: "system:root:v1", taxonomy: rootTaxonomy },
    input: { payload: { prompt: "hello" }, capturedAt: "2026-03-28T00:00:00.000Z" },
    startedAt: "2026-03-28T00:00:00.000Z",
  });
}

describe("StepExecutionEngine", () => {
  it("executes atomic, composite, and bounded system steps", async () => {
    const environment = createEnvironment();
    const plan = createExecutionPlan(environment);
    const engine = new StepExecutionEngine();
    const execution = createExecution();

    const atomic = await engine.executeStep({ plan, node: plan.nodes[1]!, environment, execution });
    const composite = await engine.executeStep({ plan, node: plan.nodes[2]!, environment, execution });
    const system = await engine.executeStep({ plan, node: plan.nodes[3]!, environment, execution });

    expect(atomic.status).toBe("succeeded");
    expect(composite.status).toBe("succeeded");
    expect(system.status).toBe("succeeded");
    expect(composite.diagnostics?.[0]).toContain("branch-capable");
    expect(system.diagnostics?.some((entry) => entry.includes("single bounded pass"))).toBe(true);
  });

  it("respects runtime environment capabilities for nested systems", async () => {
    const environment = createEnvironment({
      capabilities: {
        supportsStructuralKinds: ["atomic", "composite", "system"],
        supportsNestedSystems: false,
        supportsMcpMediatedExecution: false,
      },
    });
    const plan = createExecutionPlan(environment);
    const engine = new StepExecutionEngine();

    const result = await engine.executeStep({
      plan,
      node: plan.nodes[3]!,
      environment,
      execution: createExecution(),
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("nested-systems-unsupported");
  });

  it("surfaces invalid or unsupported step shapes truthfully", async () => {
    const environment = createEnvironment();
    const plan = createExecutionPlan(environment);
    const engine = new StepExecutionEngine();

    const invalidNode = {
      ...plan.nodes[1]!,
      nodeId: "component:invalid",
      componentKind: undefined,
      nodeType: "component" as const,
    };

    const result = await engine.executeStep({
      plan,
      node: invalidNode,
      environment,
      execution: createExecution(),
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("unsupported-step-type");
  });
});
