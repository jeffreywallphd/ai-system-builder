import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("DevSyncButton", () => {
  it("implements dev sync request flow with auth token support", () => {
    const source = readSource("ui/dev/DevSyncButton.tsx");

    expect(source).toContain("config.isDevSyncEnabled");
    expect(source).toContain("/sync/pull");
    expect(source).toContain("X-Dev-Sync-Token");
    expect(source).toContain("Sync PC");
    expect(source).toContain("ui-button__spinner");
  });
});
