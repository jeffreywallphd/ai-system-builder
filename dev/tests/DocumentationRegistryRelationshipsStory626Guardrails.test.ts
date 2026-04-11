import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistryEntry = {
  recordId: string;
  relatedCodePaths?: string[];
  relatedDocs?: string[];
  relatedRecordIds?: string[];
};

type RegistrySeed = {
  entries: RegistryEntry[];
};

const relationshipExpectations = [
  {
    recordId: "doc-architecture-domain-and-application-core",
    requiredRelatedRecordIds: ["doc-context-pack-architecture-core"],
    requiredRelatedDocs: ["docs/context/packs/architecture-core.pack.md"],
  },
  {
    recordId: "doc-contributors-docs-placement-guide",
    requiredRelatedCodePaths: ["dev/scripts/validate-docs-foundation.cjs"],
    requiredRelatedRecordIds: [
      "doc-contributors-docs-foundation-validation-guide",
      "doc-context-pack-documentation-refactor",
    ],
    requiredRelatedDocs: [
      "docs/contributors/docs-foundation-validation.md",
      "docs/context/routing/task-to-context-routing.seed.json",
    ],
  },
  {
    recordId: "doc-operations-node-bootstrap-identity",
    requiredRelatedRecordIds: [
      "doc-context-pack-runtime-and-host",
      "doc-context-pack-identity-and-security",
      "doc-architecture-domain-runtime-host-surfaces-overview",
    ],
    requiredRelatedDocs: [
      "docs/architecture/host-bootstrap-pipeline.md",
      "docs/context/packs/runtime-and-host.pack.md",
    ],
  },
  {
    recordId: "doc-adr-001-single-authoritative-control-plane",
    requiredRelatedRecordIds: [
      "doc-adr-005-trust-identity-and-security-boundary-enforcement",
      "doc-architecture-domain-runtime-host-surfaces-overview",
      "doc-context-pack-architecture-core",
    ],
    requiredRelatedDocs: [
      "docs/architecture/authoritative-server-host-assembly.md",
      "docs/context/packs/architecture-core.pack.md",
    ],
  },
  {
    recordId: "doc-context-pack-repository-overview",
    requiredRelatedRecordIds: [
      "doc-context-pack-architecture-core",
      "doc-context-pack-runtime-and-host",
      "doc-context-pack-identity-and-security",
      "doc-context-pack-studio-and-system-composition",
    ],
  },
  {
    recordId: "doc-context-pack-documentation-refactor",
    requiredRelatedDocs: [
      "docs/context/documentation-registry.md",
      "docs/context/documentation-indexing-model.md",
    ],
  },
  {
    recordId: "doc-baseline-documentation-migration-baseline",
    requiredRelatedRecordIds: [
      "doc-baseline-documentation-segmentation-migration-inventory",
      "doc-context-pack-documentation-refactor",
    ],
    requiredRelatedDocs: [
      "docs/documentation-segmentation-migration-inventory.md",
      "docs/context/packs/documentation-refactor.pack.md",
    ],
  },
] as const;

describe("story 6.2.6 curated relationship mapping guardrails", () => {
  it("links high-value entries to practical next-hop code and documentation references", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const expected of relationshipExpectations) {
      const entry = entriesById.get(expected.recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }

      const relatedCodePaths = entry.relatedCodePaths ?? [];
      const relatedDocs = entry.relatedDocs ?? [];
      const relatedRecordIds = entry.relatedRecordIds ?? [];

      expect(relatedCodePaths.length + relatedDocs.length + relatedRecordIds.length).toBeGreaterThanOrEqual(4);

      for (const codePath of relatedCodePaths) {
        expect(existsSync(resolve(repoRoot, codePath))).toBe(true);
      }
      for (const docPath of relatedDocs) {
        expect(existsSync(resolve(repoRoot, docPath))).toBe(true);
      }

      expect(new Set(relatedCodePaths).size).toBe(relatedCodePaths.length);
      expect(new Set(relatedDocs).size).toBe(relatedDocs.length);
      expect(new Set(relatedRecordIds).size).toBe(relatedRecordIds.length);

      expect(relatedCodePaths.length).toBeLessThanOrEqual(6);
      expect(relatedDocs.length).toBeLessThanOrEqual(6);
      expect(relatedRecordIds.length).toBeLessThanOrEqual(8);

      for (const relatedRecordId of expected.requiredRelatedRecordIds ?? []) {
        expect(relatedRecordIds).toContain(relatedRecordId);
      }
      for (const docPath of expected.requiredRelatedDocs ?? []) {
        expect(relatedDocs).toContain(docPath);
      }
      for (const codePath of expected.requiredRelatedCodePaths ?? []) {
        expect(relatedCodePaths).toContain(codePath);
      }
    }
  });

  it("documents story 6.2.6 relationship mapping status in human and ai registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## Relationship Mapping Status (Story 6.2.6)");
    expect(ai).toContain("## Relationship Mapping Status (Story 6.2.6)");
    expect(human).toContain("docs/architecture/domain-and-application-core.md");
    expect(ai).toContain("docs/architecture/domain-and-application-core.md");
    expect(human).toContain("docs/node-bootstrap-identity-operations.md");
    expect(ai).toContain("docs/node-bootstrap-identity-operations.md");
    expect(human).toContain("docs/context/packs/documentation-refactor.pack.md");
    expect(ai).toContain("docs/context/packs/documentation-refactor.pack.md");
  });
});
