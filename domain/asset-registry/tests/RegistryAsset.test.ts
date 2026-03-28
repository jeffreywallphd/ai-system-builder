import { describe, expect, it } from "bun:test";
import { createRegistryAsset } from "../RegistryAsset";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../taxonomy/CompositionTaxonomy";
import { AssetLineageRelationshipType } from "../../assets/AssetLineageEdge";

function createBaseRegistryAsset() {
  return createRegistryAsset({
    assetId: "asset:workflow",
    versionId: "asset:workflow:v1",
    name: "workflow",
    kind: "workflow-definition",
    status: "available",
    taxonomy: {
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    },
    contract: {
      version: "1.0.0",
      parameters: Object.freeze([]),
    },
    provenance: {
      creatorId: "author",
      sourceType: "generated",
      sourceLabel: "workflow-studio",
      directUpstreamVersionIds: ["asset:model:v1"],
      directDownstreamVersionIds: [],
      upstreamAssets: [
        {
          assetId: "asset:model",
          versionId: "asset:model:v1",
          relationship: AssetLineageRelationshipType.INPUT_TO,
        },
      ],
    },
    dependencies: [
      {
        direction: "upstream",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        relationshipType: AssetLineageRelationshipType.INPUT_TO,
        source: "lineage-edge",
      },
    ],
    versionHistory: [
      {
        versionId: "asset:workflow:v1",
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        upstreamVersionIds: ["asset:model:v1"],
        upstreamAdded: ["asset:model:v1"],
        upstreamRemoved: [],
      },
    ],
    lineage: {
      rootVersionId: "asset:workflow:v1",
      upstream: [{ assetId: "asset:model", versionId: "asset:model:v1", depth: 1 }],
      downstream: [],
    },
  });
}

describe("RegistryAsset", () => {
  it("represents composite snapshots with dependency lineage references", () => {
    const registryAsset = createBaseRegistryAsset();

    expect(registryAsset.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "deterministic",
    });
    expect(registryAsset.dependencies).toEqual([
      {
        direction: "upstream",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        relationshipType: AssetLineageRelationshipType.INPUT_TO,
        source: "lineage-edge",
      },
    ]);
    expect(registryAsset.provenance.directUpstreamVersionIds).toEqual(["asset:model:v1"]);
  });

  it("represents atomic snapshots and preserves identity + version references", () => {
    const registryAsset = createRegistryAsset({
      ...createBaseRegistryAsset(),
      assetId: "asset:model",
      versionId: "asset:model:v3",
      kind: "generic",
      taxonomy: {
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.model,
        behaviorKind: TaxonomyBehaviorKinds.none,
      },
      dependencies: [],
    });

    expect(registryAsset.assetId).toBe("asset:model");
    expect(registryAsset.versionId).toBe("asset:model:v3");
    expect(registryAsset.taxonomy).toEqual({
      structuralKind: "atomic",
      semanticRole: "model",
      behaviorKind: "none",
    });
  });

  it("returns immutable projection snapshots", () => {
    const registryAsset = createBaseRegistryAsset();
    expect(Object.isFrozen(registryAsset)).toBeTrue();
    expect(Object.isFrozen(registryAsset.dependencies)).toBeTrue();
    expect(Object.isFrozen(registryAsset.versionHistory)).toBeTrue();
    expect(Object.isFrozen(registryAsset.lineage)).toBeTrue();
    expect(Object.isFrozen(registryAsset.provenance)).toBeTrue();
  });
});
