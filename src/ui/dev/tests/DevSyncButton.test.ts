import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("DevSyncButton", () => {
  it("implements dev sync request flow with auth token support", () => {
    const source = readSource("ui/dev/DevSyncButton.tsx");

    expect(source).toContain("settingsStore.subscribe");
    expect(source).toContain("config.isProductionMode");
    expect(source).toContain("/sync/pull");
    expect(source).toContain("X-Dev-Sync-Token");
    expect(source).toContain("Sync PC");
    expect(source).toContain("ui-button__spinner");
  });

  it("prompts for stash-and-retry when git pull would overwrite local files", () => {
    const source = readSource("ui/dev/DevSyncButton.tsx");

    expect(source).toContain("window.confirm");
    expect(source).toContain("overwrittenFiles");
    expect(source).toContain("stashFiles");
    expect(source).toContain("stash these files and try the pull again");
  });
});
