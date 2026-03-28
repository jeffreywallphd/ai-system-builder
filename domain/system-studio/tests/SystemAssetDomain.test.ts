import { describe, expect, it } from "bun:test";
import {
  assertBoundedSystemComposition,
  buildNestedSystemReferences,
  createSystemAsset,
  createSystemStudioTaxonomy,
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
});
