import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("AppLayout intent UX integrations", () => {
  it("wires global command palette and guided onboarding into the shell", () => {
    const source = readSource("ui/layout/AppLayout.tsx");

    expect(source).toContain("GlobalCommandTrigger");
    expect(source).toContain("CommandPalette");
    expect(source).toContain("GuidedOnboardingFlowSurface");
    expect(source).toContain("window.addEventListener(\"keydown\"");
    expect(readSource("ui/routes/GuidedOnboardingFlow.ts")).toContain("Cmd/Ctrl + K");
  });
});
