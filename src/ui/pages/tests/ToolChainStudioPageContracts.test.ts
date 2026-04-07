import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolChainStudioPage contracts", () => {
  it("binds Tool Chain Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/ToolChainStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/ToolChainStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("toolChainStudioRegistration");
    expect(pageSource).toContain("studioRegistration={toolChainStudioRegistration}");

    expect(registrationSource).toContain("studioType: ToolChainStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "tool-chain"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("createToolChainStudioTaxonomy()");
  });
});
