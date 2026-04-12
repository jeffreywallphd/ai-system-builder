import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("multi-surface UI architecture documentation guardrails", () => {
  it("keeps canonical layering and folder responsibilities explicit", () => {
    const doc = readProjectFile("docs/architecture/multi-surface-ui-composition-foundation.md");

    const requiredTokens = [
      "Canonical layering model",
      "src/ui/shared",
      "src/ui/desktop",
      "src/ui/web",
      "src/ui/state",
      "src/ui/presenters",
      "src/ui/components",
      "src/ui/pages",
      "What stays out of page components",
      "Desktop and thin-client layering expectations",
      "Surface composition plan",
      "Contributor placement rules",
    ] as const;

    for (const token of requiredTokens) {
      expect(doc).toContain(token);
    }
  });

  it("keeps architecture indexes and companion docs linked to the canonical multi-surface guidance", () => {
    const architectureReadme = readProjectFile("docs/architecture/README.md");
    const aiArchitectureReadme = readProjectFile("docs/architecture/README.ai.md");
    const presentationDoc = readProjectFile("docs/architecture/presentation-and-state.md");
    const aiCompanionDoc = readProjectFile("docs/architecture/multi-surface-ui-composition-foundation.ai.md");

    expect(architectureReadme).toContain("multi-surface-ui-composition-foundation.md");
    expect(aiArchitectureReadme).toContain("docs/architecture/multi-surface-ui-composition-foundation.md");
    expect(presentationDoc).toContain("docs/architecture/multi-surface-ui-composition-foundation.md");
    expect(aiCompanionDoc).toContain("docs/architecture/multi-surface-ui-composition-foundation.md");
  });
});

