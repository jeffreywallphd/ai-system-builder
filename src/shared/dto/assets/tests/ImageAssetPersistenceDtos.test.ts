import { describe, expect, it } from "bun:test";
import { normalizeImageAssetPersistenceOperationKey } from "../ImageAssetPersistenceDtos";

describe("ImageAssetPersistenceDtos", () => {
  it("normalizes image-asset persistence operation keys", () => {
    expect(normalizeImageAssetPersistenceOperationKey("  IMAGE-ASSET-CREATE-001  "))
      .toBe("image-asset-create-001");
  });
});
