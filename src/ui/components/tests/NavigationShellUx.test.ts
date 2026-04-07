import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("navigation shell ux regressions", () => {
  it("keeps command palette hidden unless open and anchored to header-right flyout styles", () => {
    const source = readSource("ui/components/navigation/CommandPalette.tsx");

    expect(source).toContain("if (!isOpen)");
    expect(source).toContain("ui-command-palette");
    expect(source).toContain("ui-overlay-panel--right");
  });

  it("renders breadcrumbs with inline context navigation classes without card styling", () => {
    const source = readSource("ui/components/navigation/ContextNavigationBar.tsx");

    expect(source).toContain("ui-context-nav");
    expect(source).toContain("ui-context-nav__breadcrumbs");
    expect(source).not.toContain("ui-card");
  });
});
