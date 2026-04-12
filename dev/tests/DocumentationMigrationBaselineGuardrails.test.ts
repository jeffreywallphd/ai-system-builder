import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const repoRoot = process.cwd();
const docsRoot = resolve(repoRoot, "docs");
const inventoryPath = resolve(docsRoot, "documentation-migration-baseline.inventory.json");
const baselineMdPath = resolve(docsRoot, "documentation-migration-baseline.md");
const baselineAiMdPath = resolve(docsRoot, "documentation-migration-baseline.ai.md");
const excludedPaths = new Set([
  "docs/documentation-migration-baseline.inventory.json",
  "docs/documentation-migration-baseline.md",
  "docs/documentation-migration-baseline.ai.md",
]);

const allowedRoles = new Set([
  "architectural",
  "operational",
  "contributor-facing",
  "historical",
  "ai-context-oriented",
]);

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

function collectDocsMarkdownFiles(currentPath: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(currentPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDocsMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(normalizePath(relative(repoRoot, fullPath)));
    }
  }

  return results;
}

describe("documentation migration baseline guardrails", () => {
  it("keeps the machine-readable inventory in sync with docs markdown files", () => {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

    const diskPaths = collectDocsMarkdownFiles(docsRoot)
      .filter((pathValue) => !excludedPaths.has(pathValue))
      .sort((left, right) => left.localeCompare(right));

    const inventoryPaths = inventory.documents
      .map((doc: { path: string }) => doc.path)
      .sort((left: string, right: string) => left.localeCompare(right));

    expect(inventoryPaths).toEqual(diskPaths);
  });

  it("enforces valid role taxonomy and required migration risk anchors", () => {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));

    for (const doc of inventory.documents) {
      expect(allowedRoles.has(doc.primaryRole)).toBe(true);
      for (const role of doc.secondaryRoles) {
        expect(allowedRoles.has(role)).toBe(true);
        expect(role).not.toBe(doc.primaryRole);
      }
      expect(typeof doc.hasOwnershipSignal).toBe("boolean");
      expect(typeof doc.likelyOverloaded).toBe("boolean");
      expect(typeof doc.metrics.wordCount).toBe("number");
    }

    const requiredRiskIds = [
      "risk-001-overloaded-entry-documents",
      "risk-002-ownership-metadata-gap",
      "risk-003-namespace-overload-at-docs-root",
      "risk-004-ai-human-duplication-surface",
      "risk-005-historical-and-current-doc-mixing",
    ] as const;

    const riskIds = new Set(inventory.migrationRisks.map((risk: { id: string }) => risk.id));
    for (const riskId of requiredRiskIds) {
      expect(riskIds.has(riskId)).toBe(true);
    }

    expect(inventory.summary.totalMarkdownFiles).toBe(inventory.documents.length);
  });

  it("keeps human and AI baseline companion docs aligned to the inventory artifact", () => {
    const baselineMd = readFileSync(baselineMdPath, "utf8");
    const baselineAiMd = readFileSync(baselineAiMdPath, "utf8");

    expect(baselineMd).toContain("documentation-migration-baseline.inventory.json");
    expect(baselineMd).toContain("Story 1.1.1");
    expect(baselineAiMd).toContain("documentation-migration-baseline.inventory.json");
    expect(baselineAiMd).toContain("Role taxonomy used");
  });
});
