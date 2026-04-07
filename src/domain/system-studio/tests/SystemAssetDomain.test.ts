import { describe, expect, it } from "bun:test";
import {
  aggregateSystemDependencies,
  assertBoundedSystemComposition,
  buildNestedSystemReferences,
  collectSystemDirectDependencies,
  createSystemAsset,
  createSystemAssetMetadata,
  createSystemStudioTaxonomy,
  SystemBindingEndpointScopes,
  SystemComponentKinds,
} from "../SystemAssetDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles } from "../../taxonomy/CompositionTaxonomy";

describe("SystemAssetDomain", () => {
  it("creates a system asset that composes atomic and composite children", () => {
    const system = createSystemAsset({
      assetId: "system:root",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          versionId: "asset:model:v1",
        },
        {
          componentKind: SystemComponentKinds.composite,
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
        },
      ],
      dependencies: [
        { assetId: "asset:model", versionId: "asset:model:v1" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v2" },
      ],
    });

    expect(system.taxonomy.structuralKind).toBe("system");
    expect(system.components.map((entry) => entry.componentKind)).toEqual(["atomic", "composite"]);
    expect(system.dependencies.length).toBe(2);
  });

  it("supports recursive system-of-systems references and nested-system projection", () => {
    const parent = createSystemAsset({
      assetId: "system:parent",
      components: [
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:child",
          versionId: "system:child:v1",
          alias: "child-system",
        },
      ],
    });

    const nested = buildNestedSystemReferences(parent);
    expect(nested).toEqual([
      {
        assetId: "system:child",
        versionId: "system:child:v1",
        alias: "child-system",
      },
    ]);
  });

  it("supports empty system shells with zero children", () => {
    const empty = createSystemAsset({ assetId: "system:empty" });
    expect(empty.components).toEqual([]);
    expect(empty.dependencies).toEqual([]);
    expect(empty.nestedSystems).toEqual([]);
    expect(empty.inputs).toEqual([]);
    expect(empty.outputs).toEqual([]);
    expect(empty.parameters).toEqual([]);
    expect(empty.bindings).toEqual([]);
  });

  it("supports explicit system binding model across system and component endpoints", () => {
    const system = createSystemAsset({
      assetId: "system:bindings",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          versionId: "asset:model:v1",
          alias: "model-a",
        },
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:child",
          versionId: "system:child:v1",
          alias: "child-system",
        },
      ],
      inputs: [
        { inputId: "userPrompt", valueType: "string", required: true },
      ],
      outputs: [
        { outputId: "finalAnswer", valueType: "string" },
      ],
      parameters: [
        { parameterId: "temperature", valueType: "number", defaultValue: 0.2 },
      ],
      bindings: [
        {
          bindingId: "bind-system-to-atomic",
          source: {
            scope: SystemBindingEndpointScopes.systemInput,
            endpointId: "userPrompt",
          },
          target: {
            scope: SystemBindingEndpointScopes.componentInput,
            componentAlias: "model-a",
            endpointId: "prompt",
          },
        },
        {
          bindingId: "bind-child-to-system",
          source: {
            scope: SystemBindingEndpointScopes.componentOutput,
            componentAlias: "child-system",
            endpointId: "answer",
          },
          target: {
            scope: SystemBindingEndpointScopes.systemOutput,
            endpointId: "finalAnswer",
          },
        },
        {
          bindingId: "bind-component-to-component",
          source: {
            scope: SystemBindingEndpointScopes.componentParameter,
            componentAlias: "child-system",
            endpointId: "temperature",
          },
          target: {
            scope: SystemBindingEndpointScopes.componentParameter,
            componentAlias: "model-a",
            endpointId: "temperature",
          },
        },
      ],
    });

    expect(system.inputs.map((entry) => entry.inputId)).toEqual(["userPrompt"]);
    expect(system.outputs.map((entry) => entry.outputId)).toEqual(["finalAnswer"]);
    expect(system.parameters.map((entry) => entry.parameterId)).toEqual(["temperature"]);
    expect(system.bindings).toHaveLength(3);
  });

  it("normalizes bounded execution metadata on system assets", () => {
    const system = createSystemAsset({
      assetId: "system:execution-metadata",
      executionMetadata: {
        runtime: { environment: "  python-3.11  ", requirements: ["numpy", "numpy", "  pandas  "] },
        orchestration: { mode: "queued", hints: ["retryable", "retryable"] },
        publish: { visibility: "team", exportTargets: ["registry", "registry"] },
        executionProfile: { profileId: "profile:latency", latencyTier: "low-latency" },
        operations: { ownerTeam: "runtime", supportContact: "ops@loom.local" },
        workflowContextMapping: {
          mappings: [
            {
              mappingId: "map.prompt",
              sourceRoot: "parameters",
              sourcePath: "prompt",
              targetKind: "workflow-input",
              targetPath: "prompt",
            },
          ],
        },
      },
    });

    expect(system.executionMetadata?.runtime?.environment).toBe("python-3.11");
    expect(system.executionMetadata?.runtime?.requirements).toEqual(["numpy", "pandas"]);
    expect(system.executionMetadata?.orchestration?.hints).toEqual(["retryable"]);
    expect(system.executionMetadata?.publish?.exportTargets).toEqual(["registry"]);
    expect(system.executionMetadata?.executionProfile?.latencyTier).toBe("low-latency");
    expect(system.executionMetadata?.workflowContextMapping?.mappings[0]?.mappingId).toBe("map.prompt");
  });

  it("rejects invalid workflow context mapping definitions in execution metadata", () => {
    expect(() => createSystemAsset({
      assetId: "system:execution-metadata-invalid",
      executionMetadata: {
        workflowContextMapping: {
          mappings: [
            { mappingId: "duplicate", sourceRoot: "parameters", targetKind: "workflow-input", targetPath: "a" },
            { mappingId: "duplicate", sourceRoot: "runtime", targetKind: "workflow-metadata", targetPath: "b" },
          ],
        },
      },
    })).toThrow("must be unique");
  });

  it("rejects invalid system binding shapes and unknown endpoint references", () => {
    expect(() => createSystemAsset({
      assetId: "system:binding-invalid",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          alias: "model-a",
        },
      ],
      bindings: [
        {
          bindingId: "missing-system-input",
          source: {
            scope: SystemBindingEndpointScopes.systemInput,
            endpointId: "missing-input",
          },
          target: {
            scope: SystemBindingEndpointScopes.componentInput,
            componentAlias: "model-a",
            endpointId: "prompt",
          },
        },
      ],
    })).toThrow("defined system input");

    expect(() => createSystemAsset({
      assetId: "system:binding-invalid-alias",
      bindings: [
        {
          bindingId: "missing-component-alias",
          source: {
            scope: SystemBindingEndpointScopes.componentOutput,
            endpointId: "response",
          },
          target: {
            scope: SystemBindingEndpointScopes.systemOutput,
            endpointId: "result",
          },
        },
      ],
      outputs: [{ outputId: "result" }],
    })).toThrow("require a component alias");
  });

  it("guards against direct self-reference and recursive cycles", () => {
    expect(() => createSystemAsset({
      assetId: "system:self",
      components: [
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:self",
        },
      ],
    })).toThrow("cannot directly reference themselves");

    expect(() => createSystemAsset({
      assetId: "system:dep-self",
      dependencies: [{ assetId: "system:dep-self" }],
    })).toThrow("cannot directly depend on themselves");

    const root = createSystemAsset({ assetId: "system:root" });
    const child = createSystemAsset({ assetId: "system:child" });

    expect(() => assertBoundedSystemComposition({
      maxDepth: 5,
      root: {
        system: root,
        children: [
          {
            system: child,
            children: [{ system: root }],
          },
        ],
      },
    })).toThrow("cycle detected");
  });

  it("aggregates direct and transitive dependencies across nested systems", async () => {
    const leaf = createSystemAsset({
      assetId: "system:leaf",
      versionId: "system:leaf:v1",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          alias: "dataset",
        },
      ],
      dependencies: [{ assetId: "asset:prompt", versionId: "asset:prompt:v1" }],
    });

    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:leaf",
          versionId: "system:leaf:v1",
          alias: "leaf",
        },
      ],
      dependencies: [{ assetId: "asset:tool", versionId: "asset:tool:v1" }],
    });

    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          versionId: "asset:model:v1",
          alias: "model",
        },
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:child",
          versionId: "system:child:v1",
          alias: "child",
        },
      ],
      dependencies: [{ assetId: "asset:config", versionId: "asset:config:v1" }],
    });

    const direct = collectSystemDirectDependencies(root);
    expect(direct.map((entry) => entry.assetId).sort()).toEqual(["asset:config", "asset:model", "system:child"]);

    const byId = new Map([
      ["system:child::system:child:v1", child],
      ["system:leaf::system:leaf:v1", leaf],
    ]);
    const summary = await aggregateSystemDependencies({
      root,
      resolveSystem: (reference) => byId.get(`${reference.assetId}::${reference.versionId ?? ""}`),
      maxDepth: 5,
    });

    expect(summary.directDependencies.map((entry) => entry.assetId).sort()).toEqual([
      "asset:config",
      "asset:model",
      "system:child",
    ]);
    expect(summary.transitiveDependencies.map((entry) => entry.assetId).sort()).toEqual([
      "asset:dataset",
      "asset:prompt",
      "asset:tool",
      "system:leaf",
    ]);
  });

  it("includes binding-implied component references in direct dependencies", () => {
    const system = createSystemAsset({
      assetId: "system:bindings-dependencies",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          versionId: "asset:model:v1",
          alias: "model-a",
        },
        {
          componentKind: SystemComponentKinds.composite,
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
          alias: "flow-a",
        },
      ],
      inputs: [{ inputId: "prompt", valueType: "string", required: true }],
      outputs: [{ outputId: "answer", valueType: "string" }],
      bindings: [
        {
          bindingId: "system-to-model",
          source: {
            scope: SystemBindingEndpointScopes.systemInput,
            endpointId: "prompt",
          },
          target: {
            scope: SystemBindingEndpointScopes.componentInput,
            componentAlias: "model-a",
            endpointId: "prompt",
          },
        },
        {
          bindingId: "flow-to-system",
          source: {
            scope: SystemBindingEndpointScopes.componentOutput,
            componentAlias: "flow-a",
            endpointId: "answer",
          },
          target: {
            scope: SystemBindingEndpointScopes.systemOutput,
            endpointId: "answer",
          },
        },
      ],
      dependencies: [],
    });

    const directDependencies = collectSystemDirectDependencies(system);
    expect(directDependencies.map((entry) => `${entry.assetId}::${entry.versionId ?? ""}`).sort()).toEqual([
      "asset:model::asset:model:v1",
      "asset:workflow::asset:workflow:v2",
    ]);
  });

  it("rejects indirect cycles in aggregated system dependency traversal", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [{
        componentKind: SystemComponentKinds.system,
        assetId: "system:child",
        versionId: "system:child:v1",
        alias: "child",
      }],
    });
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{
        componentKind: SystemComponentKinds.system,
        assetId: "system:root",
        versionId: "system:root:v1",
        alias: "root",
      }],
    });

    await expect(aggregateSystemDependencies({
      root,
      resolveSystem: (reference) => {
        if (reference.assetId === "system:child") {
          return child;
        }
        if (reference.assetId === "system:root") {
          return root;
        }
        return undefined;
      },
      maxDepth: 6,
    })).rejects.toThrow("cycle detected");
  });

  it("enforces bounded recursion depth for nested system composition graphs", () => {
    const level1 = createSystemAsset({ assetId: "system:l1" });
    const level2 = createSystemAsset({ assetId: "system:l2" });
    const level3 = createSystemAsset({ assetId: "system:l3" });

    expect(() => assertBoundedSystemComposition({
      maxDepth: 2,
      root: {
        system: level1,
        children: [
          {
            system: level2,
            children: [{ system: level3 }],
          },
        ],
      },
    })).toThrow("max depth");
  });

  it("enforces bounded recursion depth for dependency traversal", async () => {
    const level1 = createSystemAsset({
      assetId: "system:l1",
      versionId: "system:l1:v1",
      components: [{ componentKind: SystemComponentKinds.system, assetId: "system:l2", versionId: "system:l2:v1", alias: "l2" }],
    });
    const level2 = createSystemAsset({
      assetId: "system:l2",
      versionId: "system:l2:v1",
      components: [{ componentKind: SystemComponentKinds.system, assetId: "system:l3", versionId: "system:l3:v1", alias: "l3" }],
    });
    const level3 = createSystemAsset({
      assetId: "system:l3",
      versionId: "system:l3:v1",
    });

    await expect(aggregateSystemDependencies({
      root: level1,
      resolveSystem: (reference) => {
        if (reference.assetId === "system:l2") return level2;
        if (reference.assetId === "system:l3") return level3;
        return undefined;
      },
      maxDepth: 2,
    })).rejects.toThrow("max depth");
  });

  it("creates valid system and app-template taxonomy descriptors", () => {
    const fullSystem = createSystemStudioTaxonomy(TaxonomySemanticRoles.system, TaxonomyBehaviorKinds.iterative);
    const appTemplate = createSystemStudioTaxonomy(TaxonomySemanticRoles.appTemplate, TaxonomyBehaviorKinds.conditional);

    expect(fullSystem).toEqual({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "iterative",
    });
    expect(appTemplate).toEqual({
      structuralKind: "system",
      semanticRole: "app-template",
      behaviorKind: "conditional",
    });
  });

  it("builds default system metadata aligned with shared studio lifecycle defaults", () => {
    const metadata = createSystemAssetMetadata({
      title: "System Draft",
      tags: ["system-composition"],
      semanticRole: "app-template",
      behaviorKind: "conditional",
    });

    expect(metadata.tags).toEqual(["system", "system-composition"]);
    expect(metadata.taxonomy).toEqual({
      structuralKind: "system",
      semanticRole: "app-template",
      behaviorKind: "conditional",
    });
    expect(metadata.provenance?.sourceLabel).toBe("system-studio");
  });
});
