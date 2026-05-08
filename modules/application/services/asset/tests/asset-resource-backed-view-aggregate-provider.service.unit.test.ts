import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { AssetResourceBackedView } from "../../../../contracts/asset";
import type { AssetResourceBackedViewListQuery, AssetResourceBackedViewListResult, AssetResourceBackedViewProvider } from "../../../ports/asset";
import { createUnsupportedAssetResourceBackedViewProvider } from "../../../ports/asset";
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

  it("readResourceBackedView returns the first matching safe view and honors provider-scoped ids", async () => {
    const first = new TestProvider("first-provider", [view("shared", "First")]);
    const second = new TestProvider("second-provider", [view("shared", "Second"), view("only-second", "Only Second")]);
    const aggregate = new AssetResourceBackedViewAggregateProvider({ providers: [first, second] });

    assert.equal((await aggregate.readResourceBackedView("shared"))?.displayName, "First");
    assert.equal((await aggregate.readResourceBackedView("second-provider::only-second"))?.displayName, "Only Second");
    assert.equal(first.readCalls, 1);
    assert.equal(second.readCalls, 1);
  });

  it("does not expose mutation, scanning, runtime, network, or byte-read behavior", async () => {
    const source = readFileSync("modules/application/services/asset/asset-resource-backed-view-aggregate-provider.service.ts", "utf8");
    assert.doesNotMatch(source, /save|update|delete|seed|register|import|finalize|execute|startRuntime|probeRuntime|installRuntime|repairRuntime/i);
    assert.doesNotMatch(source, /node:fs|node:http|node:https|fetch\(|readdir|opendir|glob|scanResources|readBytes|readResourceBytes/i);
  });
});
