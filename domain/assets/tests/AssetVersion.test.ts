import { describe, expect, it } from "bun:test";
import { AssetVersion } from "../AssetVersion";

describe("AssetVersion", () => {
  it("normalizes and stores immutable version metadata", () => {
    const version = new AssetVersion({
      assetId: "asset-1",
      versionId: "v1",
      upstreamVersionIds: ["v0", " v0 ", "v-legacy"],
      contentSha256: "ABCD",
      metadata: { source: "upload" },
    });

    expect(version.assetId.value).toBe("asset-1");
    expect(version.versionId).toBe("v1");
    expect(version.contentSha256).toBe("abcd");
    expect(version.upstreamVersionIds).toEqual(["v0", "v-legacy"]);
    expect(() => ((version.metadata as Record<string, unknown>).source = "x")).toThrow();
  });

  it("rejects self-referential upstream versions", () => {
    expect(
      () =>
        new AssetVersion({
          assetId: "asset-1",
          versionId: "v1",
          upstreamVersionIds: ["v1"],
        }),
    ).toThrow("cannot include the version itself");
  });
});
