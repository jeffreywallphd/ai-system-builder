import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistryEntry = {
  recordId: string;
  path: string;
  relatedDocs?: string[];
  relatedRecordIds?: string[];
};

type RegistrySeed = {
  entries: RegistryEntry[];
};

describe("story 6.4.2 registry cross-reference validation guardrails", () => {
  it("keeps indexed relatedDocs links aligned with stable relatedRecordIds", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const recordIdByPath = new Map(
      registry.entries.map((entry) => [entry.path, entry.recordId]),
    );

    let checkedIndexedRelatedDocLinks = 0;
    for (const entry of registry.entries) {
      const relatedDocs = entry.relatedDocs ?? [];
      const relatedRecordIds = new Set(entry.relatedRecordIds ?? []);

      for (const relatedDocPath of relatedDocs) {
        expect(existsSync(resolve(repoRoot, relatedDocPath))).toBe(true);

        const relatedRecordId = recordIdByPath.get(relatedDocPath);
        if (!relatedRecordId) {
          continue;
        }

        checkedIndexedRelatedDocLinks += 1;
        expect(relatedRecordIds.has(relatedRecordId)).toBe(true);
      }
    }

    expect(checkedIndexedRelatedDocLinks).toBeGreaterThan(0);
  });

  it("documents story 6.4.2 cross-reference checks in human and ai guidance", () => {
    const registryHuman = read("docs/context/documentation-registry.md");
    const registryAi = read("docs/context/documentation-registry.ai.md");
    const validationHuman = read("docs/contributors/docs-foundation-validation.md");
    const validationAi = read("docs/contributors/docs-foundation-validation.ai.md");

    expect(registryHuman).toContain("## Cross-Reference Validation Status (Story 6.4.2)");
    expect(registryAi).toContain("## Cross-Reference Validation Status (Story 6.4.2)");
    expect(validationHuman).toContain("REGISTRY_CROSS_REFERENCE_INVALID");
    expect(validationAi).toContain("REGISTRY_CROSS_REFERENCE_INVALID");
    expect(registryHuman).toContain("npm run docs:validate:registry");
    expect(registryAi).toContain("npm run docs:validate:registry");
  });
});
