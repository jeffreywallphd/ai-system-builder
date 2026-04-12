import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const migratedLinkStubs = [
  "docs/architecture/presentation-and-state.md",
  "docs/architecture/presentation-and-state.ai.md",
  "docs/architecture/shared-asset-contracts.md",
  "docs/architecture/shared-asset-contracts.ai.md",
  "docs/architecture/workflow-execution-and-tools.md",
  "docs/architecture/workflow-execution-and-tools.ai.md",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .length;
}

describe("story 5.2.6 redundant fragment cleanup guardrails", () => {
  it("keeps migrated link stubs concise and redirect-only after segmentation cleanup", () => {
    for (const path of migratedLinkStubs) {
      const content = read(path);

      expect(content).toContain("## Supersession Notice");
      expect(content).toContain("## Redirect");
      expect(content).toContain("Effective date:");
      expect(content).toContain("Reason:");
      expect(content).toContain("Retention/removal trigger:");

      expect(content).not.toContain("## Split Routing for Previously Mixed Content");
      expect(content).not.toContain("## Related ADRs");
      expect(countWords(content)).toBeLessThanOrEqual(260);
    }
  });
});
