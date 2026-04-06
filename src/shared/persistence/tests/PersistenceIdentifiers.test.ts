import { describe, expect, it } from "bun:test";
import {
  createPersistenceIdentifierGenerator,
  normalizePersistenceIdentifierToken,
  toPersistenceScopedIdentifier,
} from "../PersistenceIdentifiers";

describe("PersistenceIdentifiers", () => {
  it("builds deterministic generated ids with namespace and parts", () => {
    const generator = createPersistenceIdentifierGenerator({
      randomId: () => "uuid-token-1",
    });

    expect(generator.next("workspace", "assets", "alpha")).toBe("workspace:assets:alpha:uuid-token-1");
  });

  it("normalizes identifier tokens and validates format", () => {
    expect(normalizePersistenceIdentifierToken("  Node:Alpha-1  ")).toBe("node:alpha-1");
    expect(() => normalizePersistenceIdentifierToken("bad token with spaces")).toThrow("must use lowercase");
    expect(toPersistenceScopedIdentifier("workspace", "ASSET_1")).toBe("workspace:asset_1");
  });
});
