import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { AssetDefinition, AssetReference, AssetResourceBackedView } from "../../../../contracts/asset";
import { BuiltInAssetDefinitionSeedingService } from "../../../../application/services/asset/built-in-asset-definition-seeding.service";
import { AssetRegistryReadFacade, AssetRegistryReadFacadeError } from "../../../../application/services/asset/asset-registry-read-facade.service";
import type { AssetResourceBackedViewProvider, AssetResourceBackedViewQuery } from "../../../../application/services/asset/asset-registry-read-facade.types";
import { BUILT_IN_ASSET_DEFINITION_CATALOG } from "../../../../application/services/asset/built-ins";
import { composeInternalAssetRegistry } from "../composeInternalAssetRegistry";

const definitionRef: AssetReference = { kind: "asset-definition-version", id: "definition.internal", version: "1.0.0" } as AssetReference;

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "internal-asset-registry-composition-"));
}

function validDefinition(overrides: Partial<AssetDefinition> = {}): AssetDefinition {
  return {
    definitionId: "definition.internal",
    assetType: "tool",
    assetFamily: "behavioral",
    version: "1.0.0",
    displayName: "Internal Definition",
    description: "A valid internally composed definition.",
    lifecycleStatus: "draft",
    reviewStatus: "unreviewed",
    provenance: { sourceKind: "human-authored" },
    ...overrides,
  };
}

function validResourceBackedView(overrides: Partial<AssetResourceBackedView> = {}): AssetResourceBackedView {
  return {
    viewId: "view.internal.resource",
    viewKind: "artifact",
    assetType: "data-source",
    assetFamily: "resource-backed",
    assetDefinitionRef: { kind: "asset-definition", id: "builtin.artifact" } as AssetReference,
    displayName: "Internal Resource View",
    summary: "Computed test view from an injected provider seam.",
    lifecycleStatus: "draft",
    metadata: { safe: true, localPath: "/tmp/should-be-removed", token: "secret" },
    ...overrides,
  };
}

class TestResourceBackedViewProvider implements AssetResourceBackedViewProvider {
  public readonly queries: AssetResourceBackedViewQuery[] = [];
  public listCalls = 0;
  public readCalls = 0;

  public constructor(private readonly views: readonly AssetResourceBackedView[]) {}

  public async listResourceBackedViews(query: AssetResourceBackedViewQuery = {}): Promise<readonly AssetResourceBackedView[]> {
    this.listCalls += 1;
    this.queries.push(query);
    return this.views;
  }

  public async readResourceBackedView(viewId: string): Promise<AssetResourceBackedView | undefined> {
    this.readCalls += 1;
    return this.views.find((view) => view.viewId === viewId);
  }
}

class ThrowingResourceBackedViewProvider implements AssetResourceBackedViewProvider {
  public async listResourceBackedViews(): Promise<readonly AssetResourceBackedView[]> {
    throw new Error("/tmp/raw-provider-path token stack should not leak");
  }

  public async readResourceBackedView(): Promise<AssetResourceBackedView | undefined> {
    throw new Error("/tmp/raw-provider-path token stack should not leak");
  }
}

describe("composeInternalAssetRegistry", () => {
  it("composes local Asset Kernel repositories/use cases and the Asset Registry read facade", async () => {
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot(), now: () => "2026-05-07T00:00:00.000Z" });

    assert.equal(composition.readFacade instanceof AssetRegistryReadFacade, true);
    assert.equal(typeof composition.assetKernel.repositories.definitionRepository.listDefinitions, "function");
    assert.equal(typeof composition.assetKernel.useCases.registerAssetDefinition.execute, "function");
    assert.deepEqual(composition.diagnostics, {
      storeKind: "asset-kernel-local-store",
      schemaVersion: 1,
      registryFacadeComposed: true,
      resourceBackedViewsEnabled: false,
      builtInCatalogDefinitionCount: BUILT_IN_ASSET_DEFINITION_CATALOG.length,
    });
  });

  it("accepts a host-owned root and initializes local persistence under the asset-kernel child directory", async () => {
    const rootDirectory = await tempRoot();
    assert.equal(existsSync(join(rootDirectory, "asset-kernel")), false);

    composeInternalAssetRegistry({ rootDirectory, now: () => "2026-05-07T00:00:00.000Z" });

    assert.equal((await stat(join(rootDirectory, "asset-kernel"))).isDirectory(), true);
    assert.deepEqual(JSON.parse(await readFile(join(rootDirectory, "asset-kernel", "definitions.json"), "utf8")), []);
  });

  it("keeps diagnostics sanitized and free of local filesystem details", async () => {
    const rootDirectory = await tempRoot();
    const composition = composeInternalAssetRegistry({ rootDirectory });

    assert.equal("rootDirectory" in composition.diagnostics, false);
    assert.equal("path" in composition.diagnostics, false);
    assert.doesNotMatch(JSON.stringify(composition.diagnostics), /(?:\/tmp|[A-Za-z]:\\|\.\.\/|\.\/|secret|token|stack)/i);
  });

  it("registers a definition through composed use cases and reads it through the facade", async () => {
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot() });

    assert.equal((await composition.assetKernel.useCases.registerAssetDefinition.execute(validDefinition())).ok, true);

    const cards = await composition.readFacade.listDefinitionCards({ includeCustom: true });
    const detail = await composition.readFacade.readDefinitionDetail(definitionRef);
    assert.deepEqual(cards.items.map((card) => card.definitionId), ["definition.internal"]);
    assert.equal(detail?.definition.definitionId, "definition.internal");
  });

  it("can list explicitly seeded built-ins without seeding during helper composition", async () => {
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot(), now: () => "2026-05-07T00:00:00.000Z" });
    assert.equal((await composition.readFacade.listDefinitionCards({ includeBuiltIns: true })).items.length, 0);

    const seeding = new BuiltInAssetDefinitionSeedingService({
      definitionRepository: composition.assetKernel.repositories.definitionRepository,
      registerAssetDefinition: composition.assetKernel.useCases.registerAssetDefinition,
      now: () => "2026-05-07T00:00:00.000Z",
    });
    const result = await seeding.seedDefinitions(BUILT_IN_ASSET_DEFINITION_CATALOG.slice(0, 2));

    assert.equal(result.createdCount, 2);
    const cards = await composition.readFacade.listDefinitionCards({ includeBuiltIns: true, includeCustom: false });
    assert.deepEqual(cards.items.map((card) => card.builtIn), [true, true]);
  });

  it("returns empty resource-backed results when no provider seam is supplied", async () => {
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot() });

    assert.deepEqual(await composition.readFacade.listResourceBackedViewCards(), { items: [] });
    assert.equal(await composition.readFacade.readResourceBackedViewDetail("missing"), undefined);
    assert.equal(composition.resourceBackedViewProvider, undefined);
    assert.equal(composition.diagnostics.resourceBackedViewsEnabled, false);
  });

  it("delegates resource-backed reads to an injected provider seam without scanning resources itself", async () => {
    const provider = new TestResourceBackedViewProvider([validResourceBackedView()]);
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot(), resourceBackedViewProvider: provider });

    const cards = await composition.readFacade.listResourceBackedViewCards({ searchText: "resource", includeMetadata: true, limit: 10 });
    const detail = await composition.readFacade.readResourceBackedViewDetail("view.internal.resource", { includeMetadata: true });

    assert.equal(composition.resourceBackedViewProvider, provider);
    assert.equal(composition.diagnostics.resourceBackedViewsEnabled, true);
    assert.equal(provider.listCalls, 1);
    assert.equal(provider.readCalls, 1);
    assert.deepEqual(provider.queries, [{ searchText: "resource", assetTypes: undefined, assetFamilies: undefined, lifecycleStatuses: undefined, limit: 10, cursor: undefined }]);
    assert.deepEqual(cards.items.map((card) => card.viewId), ["view.internal.resource"]);
    assert.equal(detail?.view.viewId, "view.internal.resource");
    assert.deepEqual(cards.items[0]?.metadata, { safe: true });
  });

  it("surfaces provider failures through sanitized facade errors", async () => {
    const composition = composeInternalAssetRegistry({ rootDirectory: await tempRoot(), resourceBackedViewProvider: new ThrowingResourceBackedViewProvider() });

    await assert.rejects(() => composition.readFacade.listResourceBackedViewCards(), (error: unknown) => {
      assert.equal(error instanceof AssetRegistryReadFacadeError, true);
      assert.equal((error as AssetRegistryReadFacadeError).code, "resource-backed-view-provider-failed");
      assert.doesNotMatch((error as Error).message, /(?:\/tmp|secret|token|stack|provider-path)/i);
      return true;
    });
  });

  it("does not import public transports, UI, runtime adapters, provider clients, or storage source readers", async () => {
    const source = await readFile(join(process.cwd(), "modules/hosts/shared/composition/composeInternalAssetRegistry.ts"), "utf8");

    assert.doesNotMatch(source, /adapters\/transport|ipc-electron|api-express|electron|express|preload|renderer|thin-client|apps\//i);
    assert.doesNotMatch(source, /runtime|runtime-readiness|runtime-task|huggingface|artifact\/(?!asset)|model\/huggingface|dataset|image\//i);
    assert.doesNotMatch(source, /readdir|readFile|opendir|glob|fetch|scan|crawler/i);
  });
});
