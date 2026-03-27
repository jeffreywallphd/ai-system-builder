import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("StudioShellPage contracts", () => {
  it("composes bounded shell panels and service orchestration", () => {
    const source = readSource("ui/pages/StudioShellPage.tsx");

    expect(source).toContain('data-testid="studio-shell-page"');
    expect(source).toContain("StudioShellService");
    expect(source).toContain("StudioShellPanel");
    expect(source).toContain("StudioShellValidationIssuesPanel");
    expect(source).toContain("Studio/session context");
    expect(source).toContain("Asset draft authoring");
    expect(source).toContain("Taxonomy / contract / provenance");
    expect(source).toContain("Dependencies");
    expect(source).toContain("Lifecycle / publish / version status");
    expect(source).toContain("StudioShellValidationIssuesPanel");
    expect(source).toContain("StudioShellExtensionRegistry");
    expect(source).toContain("atomicStudio");
    expect(source).toContain("renderExtensions(");
    expect(source).toContain("StudioShellExtensionSlots");
    expect(source).toContain("service.loadSnapshot");
    expect(source).toContain("service.createDraft");
    expect(source).toContain("service.updateDraft");
    expect(source).toContain("service.updateDependencies");
    expect(source).toContain("service.transitionLifecycle");
    expect(source).toContain("service.publishVersion");
    expect(source).toContain("service.validateDraft");
  });
});
