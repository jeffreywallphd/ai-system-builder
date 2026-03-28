import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemCompositionReference,
} from "../../../domain/system-studio/SystemAssetDomain";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";
import { RuntimeBehaviorAlignmentService } from "../RuntimeBehaviorAlignment";
import { resolveSystemRuntimeDependencies } from "../RuntimeDependencyResolution";
import { mapSystemContractToRuntimeExecutionContract } from "../RuntimeExecutionContractMapping";
import { ExecutionPlanBuilder } from "../ExecutionPlanBuilder";
import { RuntimeEnvironmentSelector } from "../RuntimeEnvironmentSelector";
import { RuntimeEnvironmentKinds } from "../../../domain/system-runtime/RuntimeEnvironmentDomain";

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

describe("ExecutionPlanBuilder", () => {
  it("builds deterministic plans for mixed atomic/composite/system children with bindings and environment assignment", async () => {
    const childSystem = createSystem({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "childModel",
          assetId: "asset:model-child",
          versionId: "asset:model-child:v1",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
      ],
    });

    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v1",
      behaviorKind: "iterative",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v1",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        {
          componentKind: "composite",
          alias: "workflow",
          assetId: "asset:wf",
          versionId: "asset:wf:v1",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
        },
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v1",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
      bindings: [
        {
          bindingId: "bind:model-to-workflow",
          source: { scope: "component-output", componentAlias: "model", endpointId: "prediction" },
          target: { scope: "component-input", componentAlias: "workflow", endpointId: "modelOutput" },
        },
      ],
    });

    const systems = new Map<string, SystemAsset>([["system:child::system:child:v1", childSystem]]);
    const resolveSystem = async (reference: SystemCompositionReference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`);

    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: await resolver.resolveSystemContract({ root, resolveSystem, resolveChildContract: async (component) => component.taxonomy ? resolver.resolveContractForTaxonomy(component.taxonomy) : undefined }),
      resolveSystem,
      resolveChildContract: async (component) => component.taxonomy ? resolver.resolveContractForTaxonomy(component.taxonomy) : undefined,
    });

    const deps = await resolveSystemRuntimeDependencies({ root, resolveSystem });
    const planBuilder = new ExecutionPlanBuilder();
    const behavior = behaviorAlignment.resolveSystemRuntimeBehavior("system", "iterative");

    const result = planBuilder.build({
      root,
      runtimeContract,
      dependencyResolution: deps,
      behavior,
    });

    expect(result.status).toBe("built");
    expect(result.plan?.environment.kind).toBe("local");
    expect(result.plan?.nodes.map((node) => node.nodeType)).toContain("component");
    expect(result.plan?.edges.some((edge) => edge.reason === "binding" && edge.bindingId === "bind:model-to-workflow")).toBe(true);
    expect(result.plan?.interfaces.inputs.map((entry) => entry.id)).toContain("request");
  });

  it("builds deterministic nested system-of-systems plans with stable ordering", async () => {
    const grandchild = createSystem({ assetId: "system:grandchild", versionId: "system:grandchild:v1" });
    const child = createSystem({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{ componentKind: "system", alias: "grand", assetId: "system:grandchild", versionId: "system:grandchild:v1", taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } }],
      nestedSystems: [{ assetId: "system:grandchild", versionId: "system:grandchild:v1", alias: "grand" }],
    });
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v2",
      components: [{ componentKind: "system", alias: "child", assetId: "system:child", versionId: "system:child:v1", taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" } }],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });

    const systems = new Map<string, SystemAsset>([
      ["system:child::system:child:v1", child],
      ["system:grandchild::system:grandchild:v1", grandchild],
    ]);
    const resolveSystem = async (reference: SystemCompositionReference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`);

    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: await resolver.resolveSystemContract({ root, resolveSystem, resolveChildContract: async () => undefined }),
      resolveSystem,
    });
    const deps = await resolveSystemRuntimeDependencies({ root, resolveSystem });
    const behavior = behaviorAlignment.resolveSystemRuntimeBehavior("system", "deterministic");

    const builder = new ExecutionPlanBuilder();
    const first = builder.build({ root, runtimeContract, dependencyResolution: deps, behavior });
    const second = builder.build({ root, runtimeContract, dependencyResolution: deps, behavior });

    expect(first.status).toBe("built");
    expect(second.status).toBe("built");
    expect(first.plan?.orderedNodeIds).toEqual(second.plan?.orderedNodeIds);
  });

  it("reflects explicit environment selection and reports invalid cycle-safe scenarios truthfully", async () => {
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v3",
      components: [
        { componentKind: "atomic", alias: "a", assetId: "asset:a", versionId: "asset:a:v1", taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
        { componentKind: "atomic", alias: "b", assetId: "asset:b", versionId: "asset:b:v1", taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
      ],
      bindings: [
        { bindingId: "a-to-b", source: { scope: "component-output", componentAlias: "a", endpointId: "out" }, target: { scope: "component-input", componentAlias: "b", endpointId: "in" } },
        { bindingId: "b-to-a", source: { scope: "component-output", componentAlias: "b", endpointId: "out" }, target: { scope: "component-input", componentAlias: "a", endpointId: "in" } },
      ],
    });

    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: await resolver.resolveSystemContract({ root, resolveSystem: async () => undefined, resolveChildContract: async () => undefined }),
    });
    const deps = await resolveSystemRuntimeDependencies({ root, resolveSystem: async () => undefined });
    const behavior = behaviorAlignment.resolveSystemRuntimeBehavior("system", "deterministic");

    const envSelector = new RuntimeEnvironmentSelector([
      {
        environmentId: "runtime:mcp",
        kind: RuntimeEnvironmentKinds.mcp,
        displayName: "MCP",
        isDefault: true,
        capabilities: {
          supportsStructuralKinds: ["atomic", "composite", "system"],
          supportsNestedSystems: true,
          supportsMcpMediatedExecution: true,
        },
      },
    ]);

    const builder = new ExecutionPlanBuilder(envSelector);
    const cycleResult = builder.build({
      root,
      runtimeContract,
      dependencyResolution: deps,
      behavior,
      requestedEnvironmentKind: RuntimeEnvironmentKinds.mcp,
    });

    expect(cycleResult.status).toBe("invalid");
    expect(cycleResult.errors[0]).toContain("cycle");

    const unsupportedEnvironment = builder.build({
      root: createSystem({ assetId: "system:root2", versionId: "system:root2:v1" }),
      runtimeContract: await mapSystemContractToRuntimeExecutionContract({
        root: createSystem({ assetId: "system:root2", versionId: "system:root2:v1" }),
        contract: await resolver.resolveSystemContract({ root: createSystem({ assetId: "system:root2", versionId: "system:root2:v1" }), resolveSystem: async () => undefined, resolveChildContract: async () => undefined }),
      }),
      dependencyResolution: await resolveSystemRuntimeDependencies({ root: createSystem({ assetId: "system:root2", versionId: "system:root2:v1" }), resolveSystem: async () => undefined }),
      behavior,
      requestedEnvironmentKind: RuntimeEnvironmentKinds.remote,
    });

    expect(unsupportedEnvironment.status).toBe("invalid");
    expect(unsupportedEnvironment.errors[0]).toContain("No runtime environment");
  });

  it("rejects plans that include unpinned component versions", async () => {
    const root = createSystem({
      assetId: "system:unpinned",
      versionId: "system:unpinned:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
      ],
    });
    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: await resolver.resolveSystemContract({ root, resolveSystem: async () => undefined, resolveChildContract: async () => undefined }),
    });
    const deps = await resolveSystemRuntimeDependencies({ root, resolveSystem: async () => undefined });
    const behavior = behaviorAlignment.resolveSystemRuntimeBehavior("system", "deterministic");

    const result = new ExecutionPlanBuilder().build({ root, runtimeContract, dependencyResolution: deps, behavior });
    expect(result.status).toBe("invalid");
    expect(result.errors[0]).toContain("version-pinned components");
  });
});
