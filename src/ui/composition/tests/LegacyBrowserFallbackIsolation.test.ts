import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("Legacy browser fallback isolation", () => {
  it("routes browser fallback bridge wiring through the explicit legacy boundary module", () => {
    const studioShellFallbackSource = readSource(
      "src/ui/composition/BrowserStudioShellBridgeFallback.ts",
    );
    const registryFallbackSource = readSource(
      "src/ui/composition/BrowserRegistryBridgeFallback.ts",
    );
    const compatibilityShimSource = readSource(
      "src/ui/composition/BrowserFallbackRepositories.ts",
    );

    expect(studioShellFallbackSource).toContain(
      "legacy/LegacyBrowserFallbackRepositories",
    );
    expect(registryFallbackSource).toContain(
      "legacy/LegacyBrowserFallbackRepositories",
    );
    expect(compatibilityShimSource).toContain("Compatibility shim");
  });
});
