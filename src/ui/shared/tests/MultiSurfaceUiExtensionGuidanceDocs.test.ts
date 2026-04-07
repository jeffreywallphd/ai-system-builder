import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const extensionGuidancePath = path.join(repoRoot, "docs", "architecture", "multi-surface-ui-extension-guidance.md");
const extensionGuidanceAiPath = path.join(repoRoot, "docs", "architecture", "multi-surface-ui-extension-guidance.ai.md");

describe("multi-surface UI extension guidance docs", () => {
  it("keeps canonical extension guidance docs checked in", () => {
    expect(existsSync(extensionGuidancePath)).toBeTrue();
    expect(existsSync(extensionGuidanceAiPath)).toBeTrue();
  });

  it("documents normative extension workflow and prohibited converged-area bypass rule", () => {
    const doc = readFileSync(extensionGuidancePath, "utf8");

    expect(doc).toContain("## Screen extension workflow");
    expect(doc).toContain("## Shared vs surface-specific placement rules");
    expect(doc).toContain("## Navigation metadata rules");
    expect(doc).toContain("## State and presentation rules for converged areas");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("For converged areas, bypassing shared presentation/state patterns is prohibited without documented justification.");
  });

  it("references canonical implemented UI foundation seams", () => {
    const requiredSeams = [
      "src/ui/shared/components/shell",
      "src/ui/shared/components/presentation-state",
      "src/ui/shared/actions",
      "src/ui/shared/responsive",
      "src/ui/shared/accessibility",
      "src/ui/routes/SurfaceRouteMetadataCatalog.ts",
      "src/ui/desktop/shell",
      "src/ui/web/shell",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps AI companion guidance aligned to canonical doc", () => {
    const aiDoc = readFileSync(extensionGuidanceAiPath, "utf8");

    expect(aiDoc).toContain("Bypassing shared presentation/state patterns for converged areas is prohibited without documented justification.");
    expect(aiDoc).toContain("docs/architecture/multi-surface-ui-extension-guidance.md");
  });
});
