import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { AssetResourceBackedView } from "../../../../contracts/asset";
import type { ArtifactBrowseItem, ArtifactBrowseSuccessValue } from "../../../../contracts/artifact-browser";
import { createSuccessResult, type ContractResult } from "../../../../contracts/shared";
import type { ArtifactBrowserMetadataReadPort } from "../../../ports/artifact-browser";
import type { AssetResourceBackedViewListQuery, AssetResourceBackedViewListResult, AssetResourceBackedViewProvider } from "../../../ports/asset";
import { createUnsupportedAssetResourceBackedViewProvider } from "../../../ports/asset";
import { ArtifactResourceBackedViewProvider } from "../asset-artifact-resource-backed-view-provider.service";
import { AssetImageResourceBackedViewProvider, type GeneratedImageOutputDescriptorSource } from "../asset-image-resource-backed-view-provider.service";
import { AssetResourceBackedViewAggregateProvider } from "../asset-resource-backed-view-aggregate-provider.service";

function view(viewId: string, displayName: string): AssetResourceBackedView {
  return {
    viewId,
    viewKind: "artifact",
    assetType: "data-source",
    assetFamily: "resource-backed",
    displayName,
    lifecycleStatus: "draft",
  };
}

class TestProvider implements AssetResourceBackedViewProvider {
  public readonly queries: AssetResourceBackedViewListQuery[] = [];
  public listCalls = 0;
  public readCalls = 0;

  public constructor(public readonly providerId: string, private readonly views: readonly AssetResourceBackedView[], private readonly nextCursor?: string) {}

  public async listResourceBackedViews(query: AssetResourceBackedViewListQuery = {}) {
    this.listCalls += 1;
    this.queries.push(query);
    return {
      items: this.views,
      ...(this.nextCursor ? { nextCursor: this.nextCursor } : {}),
      diagnostics: [{ severity: "info" as const, code: "provider-safe", message: "Safe diagnostic.", providerId: this.providerId, metadata: { safe: true } }],
    };
  }

  public async readResourceBackedView(viewId: string) {
    this.readCalls += 1;
    return this.views.find((item) => item.viewId === viewId);
  }
}

class ThrowingProvider implements AssetResourceBackedViewProvider {
  public readonly providerId = "throwing-provider";
  public async listResourceBackedViews(): Promise<AssetResourceBackedViewListResult> {
    throw new Error("C:\\Users\\jdwall\\secret token stack raw provider payload command bytes blob base64");
  }
  public async readResourceBackedView(): Promise<AssetResourceBackedView | undefined> {
    throw new Error("C:\\Users\\jdwall\\secret token stack raw provider payload command bytes blob base64");
  }
}

class FakeArtifactBrowserMetadataRead implements Pick<ArtifactBrowserMetadataReadPort, "browseArtifacts"> {
  public constructor(private readonly items: readonly ArtifactBrowseItem[]) {}

  public async browseArtifacts(): Promise<ContractResult<ArtifactBrowseSuccessValue>> {
    return createSuccessResult({ items: [...this.items] });
  }

  public async readArtifactDetail(request: Parameters<ArtifactBrowserMetadataReadPort["readArtifactDetail"]>[0]) {
    const item = this.items.find((candidate) => candidate.storageKey === request.locator.storageKey) ?? this.items[0]!;
    return createSuccessResult({
      artifact: {
        locator: request.locator,
        artifactFamily: item.artifactFamily,
        mediaType: item.mediaType,
        sourceKind: item.sourceKind,
        originalName: item.originalName,
      },
    });
  }
}

class FakeGeneratedOutputDescriptorSource implements GeneratedImageOutputDescriptorSource {
  public constructor(private readonly outputId: string) {}

  public async listGeneratedImageOutputDescriptors() {
    return {
      items: [
        {
          outputId: this.outputId,
          output: {
            type: "image" as const,
            engine: "comfyui",
            fileName: "Generated.png",
            mediaType: "image/png",
          },
        },
      ],
    };
  }
}

function artifactItem(artifactId: string, originalName: string, mediaType: string): ArtifactBrowseItem {
  return {
    artifactId,
    storageKey: `uploads/private/${originalName}`,
    artifactFamily: mediaType === "application/pdf" ? "document" : "binary",
    mediaType,
    originalName,
    sourceKind: "upload",
  };
}

function assertSafe(value: unknown) {
  const output = JSON.stringify(value).toLowerCase();
  for (const unsafe of ["c:\\users", "/tmp", "secret", "token", "stack", "raw provider payload", "command", "bytes", "blob", "base64"]) {
    assert.equal(output.includes(unsafe), false, `serialized output included ${unsafe}: ${output}`);
  }
}

describe("AssetResourceBackedViewAggregateProvider", () => {
  it("combines provider results in deterministic order and preserves item ordering within providers", async () => {
    const first = new TestProvider("first-provider", [view("view.1", "One"), view("view.2", "Two")]);
    const second = new TestProvider("second-provider", [view("view.3", "Three")]);
    const aggregate = new AssetResourceBackedViewAggregateProvider({ providers: [first, second] });

    const result = await aggregate.listResourceBackedViews();

    assert.deepEqual(result.items.map((item) => item.viewId), ["view.1", "view.2", "view.3"]);
    assert.equal(first.listCalls, 1);
    assert.equal(second.listCalls, 1);
  });

  it("returns an empty list when no providers are supplied", async () => {
    const aggregate = new AssetResourceBackedViewAggregateProvider();
    assert.deepEqual(await aggregate.listResourceBackedViews(), { items: [] });
  });

  it("preserves safe diagnostics and sanitizes unsafe provider diagnostics/data", async () => {
    const provider: AssetResourceBackedViewProvider = {
      providerId: "unsafe-provider",
      async listResourceBackedViews() {
        return {
          items: [{ ...view("view.unsafe", "Unsafe"), metadata: { safe: "yes", localPath: "/tmp/private", token: "secret" } }],
          diagnostics: [{ severity: "warning", code: "provider-warning", message: "/tmp raw provider payload token", providerId: "unsafe-provider", metadata: { safe: true, path: "/tmp/private" } }],
        };
      },
      async readResourceBackedView() {
        return undefined;
      },
    };

    const result = await new AssetResourceBackedViewAggregateProvider({ providers: [provider] }).listResourceBackedViews({ limit: 10 });

    assert.equal(result.items[0]?.metadata?.safe, "yes");
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-provider-unsafe-data"), true);
    assertSafe(result);
  });

  it("converts thrown provider errors into sanitized diagnostics", async () => {
    const result = await new AssetResourceBackedViewAggregateProvider({ providers: [new ThrowingProvider()] }).listResourceBackedViews();

    assert.deepEqual(result.items, []);
    assert.equal(result.diagnostics?.[0]?.code, "resource-backed-view-provider-partial-failure");
    assertSafe(result);
  });

  it("respects and clamps limit safely", async () => {
    const first = new TestProvider("first-provider", [view("view.1", "One"), view("view.2", "Two")]);
    const second = new TestProvider("second-provider", [view("view.3", "Three")]);
    const aggregate = new AssetResourceBackedViewAggregateProvider({ providers: [first, second], maxListLimit: 2 });

    const result = await aggregate.listResourceBackedViews({ limit: 50 });

    assert.deepEqual(result.items.map((item) => item.viewId), ["view.1", "view.2"]);
    assert.equal(second.listCalls, 0);
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-provider-limit-clamped"), true);
  });

  it("passes through a single provider cursor and diagnoses multi-provider cursors as first-page aggregation", async () => {
    const singleProvider = new TestProvider("single-provider", [view("view.1", "One")], "next.single");
    const single = await new AssetResourceBackedViewAggregateProvider({ providers: [singleProvider] }).listResourceBackedViews({ cursor: "cursor.one" });
    assert.equal(singleProvider.queries[0]?.cursor, "cursor.one");
    assert.equal(single.nextCursor, "next.single");

    const first = new TestProvider("first-provider", [view("view.1", "One")]);
    const second = new TestProvider("second-provider", [view("view.2", "Two")]);
    const multi = await new AssetResourceBackedViewAggregateProvider({ providers: [first, second] }).listResourceBackedViews({ cursor: "cursor.many" });
    assert.equal(first.queries[0]?.cursor, undefined);
    assert.equal(second.queries[0]?.cursor, undefined);
    assert.equal(multi.nextCursor, undefined);
    assert.equal(multi.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-aggregate-cursor-unsupported"), true);
  });

  it("handles unsupported providers as non-fatal diagnostics", async () => {
    const unsupported = createUnsupportedAssetResourceBackedViewProvider({ providerId: "dataset-provider", sourceKind: "dataset" });
    const supported = new TestProvider("supported-provider", [view("view.1", "One")]);
    const result = await new AssetResourceBackedViewAggregateProvider({ providers: [unsupported, supported] }).listResourceBackedViews();

    assert.deepEqual(result.items.map((item) => item.viewId), ["view.1"]);
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-provider-unsupported"), true);
  });

  it("combines artifact/document provider results with unsupported providers", async () => {
    const artifactProvider = new ArtifactResourceBackedViewProvider({
      artifactBrowserMetadataRead: new FakeArtifactBrowserMetadataRead([
        artifactItem("artifact-report", "Report.pdf", "application/pdf"),
        artifactItem("artifact-binary", "Unknown.bin", "application/octet-stream"),
      ]),
    });
    const unsupported = createUnsupportedAssetResourceBackedViewProvider({ providerId: "dataset-provider", sourceKind: "dataset" });

    const result = await new AssetResourceBackedViewAggregateProvider({
      providers: [unsupported, artifactProvider],
      maxListLimit: 10,
    }).listResourceBackedViews({ limit: 10 });

    assert.deepEqual(result.items.map((item) => item.viewKind), ["document", "artifact"]);
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-provider-unsupported"), true);
    assertSafe(result);
  });

  it("combines image/generated-output provider results with artifact/document and unsupported providers deterministically", async () => {
    const artifactProvider = new ArtifactResourceBackedViewProvider({
      artifactBrowserMetadataRead: new FakeArtifactBrowserMetadataRead([
        artifactItem("artifact-report", "Report.pdf", "application/pdf"),
      ]),
    });
    const imageProvider = new AssetImageResourceBackedViewProvider({
      generatedImageOutputDescriptorSource: new FakeGeneratedOutputDescriptorSource("generated-output-1"),
    });
    const unsupported = createUnsupportedAssetResourceBackedViewProvider({ providerId: "dataset-provider", sourceKind: "dataset" });

    const result = await new AssetResourceBackedViewAggregateProvider({
      providers: [unsupported, artifactProvider, imageProvider],
      maxListLimit: 10,
    }).listResourceBackedViews({ limit: 10 });

    assert.deepEqual(result.items.map((item) => item.viewKind), ["document", "generated-output"]);
    assert.equal(result.items[1]?.assetDefinitionRef, undefined);
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "resource-backed-view-provider-unsupported"), true);
    assert.equal(result.diagnostics?.some((diagnostic) => diagnostic.code === "image-resource-backed-view-image-source-unavailable"), true);
    assertSafe(result);
  });

  it("keeps generated-output views distinct from image asset views when ids could otherwise collide", async () => {
    const imageProvider = new AssetImageResourceBackedViewProvider({
      imageAssetDescriptorRead: {
        async listImageAssetDescriptors() {
          return {
            items: [
              {
                assetId: "shared",
                artifactId: "artifact-shared",
                source: "generated" as const,
                metadata: { originalFileName: "Final.png", createdAt: "2026-01-01T00:00:00.000Z" },
              },
            ],
          };
        },
      },
      generatedImageOutputDescriptorSource: new FakeGeneratedOutputDescriptorSource("shared"),
    });

    const result = await new AssetResourceBackedViewAggregateProvider({ providers: [imageProvider], maxListLimit: 10 }).listResourceBackedViews({ limit: 10 });

    assert.deepEqual(result.items.map((item) => item.viewKind), ["image-asset", "generated-output"]);
    assert.notEqual(result.items[0]?.viewId, result.items[1]?.viewId);
  });

  it("readResourceBackedView returns the first matching safe view and honors provider-scoped ids", async () => {
    const first = new TestProvider("first-provider", [view("shared", "First")]);
    const second = new TestProvider("second-provider", [view("shared", "Second"), view("only-second", "Only Second")]);
    const aggregate = new AssetResourceBackedViewAggregateProvider({ providers: [first, second] });

    assert.equal((await aggregate.readResourceBackedView("shared"))?.displayName, "First");
    assert.equal((await aggregate.readResourceBackedView("second-provider::only-second"))?.displayName, "Only Second");
    assert.equal(first.readCalls, 1);
    assert.equal(second.readCalls, 1);
  });

  it("routes detail reads to the known owning provider after list without changing public view ids", async () => {
    const first = new TestProvider("first-provider", [view("view.1", "One")]);
    const second = new TestProvider("second-provider", [view("view.2", "Two")]);
    const aggregate = new AssetResourceBackedViewAggregateProvider({ providers: [first, second] });

    await aggregate.listResourceBackedViews();
    assert.equal((await aggregate.readResourceBackedView("view.2"))?.displayName, "Two");
    assert.equal(first.readCalls, 0);
    assert.equal(second.readCalls, 1);
  });

  it("does not expose mutation, scanning, runtime, network, or byte-read behavior", async () => {
    const source = readFileSync("modules/application/services/asset/asset-resource-backed-view-aggregate-provider.service.ts", "utf8");
    assert.doesNotMatch(source, /\b(?:save|update|delete|seed|register|importAsset|finalize|execute|startRuntime|probeRuntime|installRuntime|repairRuntime)\b/i);
    assert.doesNotMatch(source, /node:fs|node:http|node:https|fetch\(|readdir|opendir|glob|scanResources|readBytes|readResourceBytes/i);
  });
});
