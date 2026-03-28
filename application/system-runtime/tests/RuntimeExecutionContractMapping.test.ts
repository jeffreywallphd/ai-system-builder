import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemCompositionReference,
} from "../../../domain/system-studio/SystemAssetDomain";
import { mapSystemContractToRuntimeExecutionContract } from "../RuntimeExecutionContractMapping";

const contractResolver = new CompositionAssetContractResolver();

function createSeedSystem(input: {
  readonly assetId: string;
  readonly versionId: string;
  readonly components?: SystemAsset["components"];
  readonly nestedSystems?: SystemAsset["nestedSystems"];
  readonly bindings?: SystemAsset["bindings"];
}): SystemAsset {
  return createSystemAsset({
    assetId: input.assetId,
    versionId: input.versionId,
    taxonomy: createSystemStudioTaxonomy("system", "iterative"),
    components: input.components,
    nestedSystems: input.nestedSystems,
    bindings: input.bindings,
    inputs: [{ inputId: "request", required: true, valueType: "object", description: "Root request" }],
    outputs: [{ outputId: "result", valueType: "object", description: "Root result" }],
    parameters: [{ parameterId: "temperature", required: false, valueType: "number", defaultValue: 0.2 }],
  });
}

describe("RuntimeExecutionContractMapping", () => {
  it("maps system contract truth into runtime execution inputs/outputs/parameters", async () => {
    const root = createSeedSystem({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "modelA",
          assetId: "asset:model",
          versionId: "asset:model:v1",
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: "model",
            behaviorKind: "none",
          },
        },
      ],
    });

    const contract = await contractResolver.resolveSystemContract({
      root,
      resolveSystem: async () => undefined,
      resolveChildContract: async (component) => component.taxonomy ? contractResolver.resolveContractForTaxonomy(component.taxonomy) : undefined,
    });

    const mapped = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract,
      resolveChildContract: async (component) => component.taxonomy ? contractResolver.resolveContractForTaxonomy(component.taxonomy) : undefined,
    });

    expect(mapped.inputs).toEqual([
      {
        id: "request",
        required: true,
        valueType: "object",
        description: "Root request",
        source: "system-input",
      },
    ]);
    expect(mapped.outputs[0]?.id).toBe("result");
    expect(mapped.parameters.some((entry) => entry.id === "temperature" && entry.source === "system-parameter")).toBe(true);
    expect(mapped.parameters.some((entry) => entry.id === "systemMode" && entry.source === "contract-parameter")).toBe(true);
    expect(mapped.childInterfaces[0]?.contractVersion).toBe("1.0.0");
  });

  it("is recursive-ready for nested systems with bounded deterministic traversal", async () => {
    const child = createSeedSystem({
      assetId: "system:child",
      versionId: "system:child:v1",
    });
    const root = createSeedSystem({
      assetId: "system:root",
      versionId: "system:root:v2",
      components: [{ componentKind: "system", alias: "child", assetId: "system:child", versionId: "system:child:v1" }],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });

    const systems = new Map<string, SystemAsset>([["system:child::system:child:v1", child]]);
    const resolveSystem = async (reference: SystemCompositionReference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`);

    const contract = await contractResolver.resolveSystemContract({
      root,
      resolveSystem,
      resolveChildContract: async () => undefined,
      maxDepth: 3,
    });

    const mapped = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract,
      resolveSystem,
      maxDepth: 3,
    });

    expect(mapped.recursion.status).toBe("complete");
    expect(mapped.recursion.nestedSystemCount).toBe(1);
    expect(mapped.recursion.unresolvedNestedSystemCount).toBe(0);
  });

  it("surfaces unsupported runtime mapping combinations truthfully", async () => {
    const invalid = {
      assetId: "asset:not-system",
      taxonomy: {
        structuralKind: "composite",
        semanticRole: "workflow",
        behaviorKind: "deterministic",
      },
      versionId: undefined,
      dependencies: [],
      components: [],
      nestedSystems: [],
      inputs: [],
      outputs: [],
      parameters: [],
      bindings: [],
    } as unknown as SystemAsset;
    const contract = contractResolver.resolveContractForTaxonomy(invalid.taxonomy as any);
    expect(contract).toBeDefined();

    await expect(mapSystemContractToRuntimeExecutionContract({
      root: invalid,
      contract: contract!,
    })).rejects.toThrow("requires a system taxonomy root");
  });
});
