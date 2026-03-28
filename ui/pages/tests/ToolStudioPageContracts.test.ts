import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolStudioPage contracts", () => {
  it("binds Tool Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/ToolStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/ToolStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("toolStudioRegistration");
    expect(pageSource).toContain("studioRegistration={toolStudioRegistration}");

    expect(registrationSource).toContain("studioType: ToolStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "tool"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain('providerKind: "mcp"');
    expect(registrationSource).toContain('createToolStudioTaxonomy("conditional")');
  });
});
