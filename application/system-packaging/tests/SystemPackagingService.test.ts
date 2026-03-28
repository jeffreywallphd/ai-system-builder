import { describe, expect, it } from "bun:test";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { createSystemStudioTaxonomy } from "../../../domain/system-studio/SystemAssetDomain";
import { SystemPackagingService } from "../SystemPackagingService";

class PackagingRepository {
  private readonly versions = new Map<string, AssetVersion>();
  public saveCalls = 0;
  public getCalls = 0;

  public seed(version: AssetVersion): void {
    this.versions.set(version.versionId, version);
  }

  public async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> {
    this.getCalls += 1;
    return this.versions.get(versionId);
  }

  public async saveAssetVersion(_version: AssetVersion): Promise<AssetVersion> {
    this.saveCalls += 1;
    throw new Error("Packaging service must not save asset versions.");
  }
}

function createSystemVersion(input: {
  readonly assetId: string;
  readonly versionId: string;
  readonly parentVersionId?: string;
  readonly upstreamVersionIds?: ReadonlyArray<string>;
  readonly dependencies?: ReadonlyArray<Record<string, string>>;
  readonly components?: ReadonlyArray<Record<string, unknown>>;
  readonly nestedSystems?: ReadonlyArray<Record<string, unknown>>;
  readonly executionMetadata?: Record<string, unknown>;
}): AssetVersion {
  return new AssetVersion({
    assetId: input.assetId,
    versionId: input.versionId,
    parentVersionId: input.parentVersionId,
    upstreamVersionIds: input.upstreamVersionIds,
    metadata: {
      metadata: {
        taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
      },
      dependencies: input.dependencies ?? [],
      content: JSON.stringify({
        systemSpec: {
          components: input.components ?? [],
          nestedSystems: input.nestedSystems ?? [],
          executionMetadata: input.executionMetadata,
        },
      }),
    },
  });
}

describe("SystemPackagingService", () => {
  it("produces deterministic version-pinned package manifests", async () => {
    const repository = new PackagingRepository();
    repository.seed(createSystemVersion({
      assetId: "system:root",
      versionId: "system:root:v1",
      parentVersionId: "system:root:v0",
      upstreamVersionIds: ["asset:model:v2", "asset:tool:v3"],
      dependencies: [{ assetId: "asset:config", versionId: "asset:config:v9" }],
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v2",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
      ],
      executionMetadata: {
        runtime: { environment: "container", requirements: ["gpu", "network"] },
        publish: { exportTargets: ["registry"] },
      },
    }));

    const clockA = () => new Date("2026-03-28T10:00:00.000Z");
    const clockB = () => new Date("2026-03-28T12:00:00.000Z");
    const serviceA = new SystemPackagingService(repository, clockA);
    const serviceB = new SystemPackagingService(repository, clockB);

    const packagedA = await serviceA.packageSystemVersion({ versionId: "system:root:v1", packagingVersion: "v1" });
    const packagedB = await serviceB.packageSystemVersion({ versionId: "system:root:v1", packagingVersion: "v1" });

    expect(packagedA.packageId.value).toBe(packagedB.packageId.value);
    expect(packagedA.manifest.packagingMetadata.determinismKey).toBe(packagedB.manifest.packagingMetadata.determinismKey);
    expect(packagedA.manifest.dependencyVersionSnapshot).toEqual(packagedB.manifest.dependencyVersionSnapshot);
    expect(packagedA.manifest.lineage).toEqual({
      parentVersionId: "system:root:v0",
      upstreamVersionIds: ["asset:model:v2", "asset:tool:v3"],
    });
    expect(packagedA.manifest.packagingMetadata.packagedAt).not.toBe(packagedB.manifest.packagingMetadata.packagedAt);
    expect(repository.saveCalls).toBe(0);
  });

  it("resolves nested system-of-systems dependencies into one package graph", async () => {
    const repository = new PackagingRepository();
    repository.seed(createSystemVersion({
      assetId: "system:child",
      versionId: "system:child:v2",
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v4" }],
      components: [
        {
          componentKind: "composite",
          alias: "workflow",
          assetId: "asset:wf",
          versionId: "asset:wf:v7",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
        },
      ],
    }));
    repository.seed(createSystemVersion({
      assetId: "system:root",
      versionId: "system:root:v5",
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v2", alias: "child" }],
      components: [
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v2",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
    }));

    const service = new SystemPackagingService(repository, () => new Date("2026-03-28T00:00:00.000Z"));
    const packaged = await service.packageSystemVersion({ versionId: "system:root:v5" });

    expect(packaged.manifest.requirements.requiresNestedSystemSupport).toBe(true);
    expect(packaged.manifest.recursion.status).toBe("complete");
    expect(packaged.manifest.dependencyVersionSnapshot.map((entry) => `${entry.assetId}@${entry.versionId}`)).toEqual([
      "asset:dataset@asset:dataset:v4",
      "asset:wf@asset:wf:v7",
      "system:child@system:child:v2",
    ]);
    expect(packaged.manifest.dependencyGraph.nodes.some((node) => node.assetId === "system:child")).toBe(true);
  });
});
