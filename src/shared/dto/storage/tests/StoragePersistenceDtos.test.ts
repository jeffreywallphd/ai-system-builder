import { describe, expect, it } from "bun:test";
import { normalizeStorageMutationOperationKey } from "../StoragePersistenceDtos";

describe("StoragePersistenceDtos", () => {
  it("normalizes storage persistence operation keys", () => {
    expect(normalizeStorageMutationOperationKey("  STORAGE-CREATE-001  ")).toBe("storage-create-001");
  });
});
