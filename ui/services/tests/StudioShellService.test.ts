import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("StudioShellService", () => {
  it("uses the desktop Studio Shell bridge for all shell operations", () => {
    const source = readSource("ui/services/StudioShellService.ts");

    expect(source).toContain("resolveDesktopStudioShellBridge");
    expect(source).toContain("initializeStudio(");
    expect(source).toContain("loadSnapshot(");
    expect(source).toContain("startSession(");
    expect(source).toContain("createDraft(");
    expect(source).toContain("updateDraft(");
    expect(source).toContain("updateDependencies(");
    expect(source).toContain("transitionLifecycle(");
    expect(source).toContain("publishVersion(");
    expect(source).toContain("validateDraft(");
    expect(source).not.toContain("fetch(");
  });
});
