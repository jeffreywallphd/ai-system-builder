import { describe, expect, it } from "bun:test";
import { normalizeGeneratedResultPersistenceOperationKey } from "../GeneratedResultPersistenceDtos";

describe("GeneratedResultPersistenceDtos", () => {
  it("normalizes generated-result persistence operation keys", () => {
    expect(normalizeGeneratedResultPersistenceOperationKey("  GENERATED-RESULT-CREATE-001  "))
      .toBe("generated-result-create-001");
  });
});
