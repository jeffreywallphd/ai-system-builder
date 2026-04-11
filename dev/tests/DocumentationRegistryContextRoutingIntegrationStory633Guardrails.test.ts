import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistryEntry = {
  recordId: string;
  path: string;
};

type RoutingSeed = {
  mappings: Array<{
    taskId: string;
    relatedDocPaths: string[];
    relatedDocRecordIds?: string[];
  }>;
  routingExamples: Array<{
    taskId: string;
    expectedRelatedDocOrder?: string[];
    relatedDocRecordIds?: string[];
  }>;
};

type PackCatalogSeed = {
  packs: Array<{
    id: string;
    primaryDocPath: string;
    relatedDocPaths?: string[];
    relatedDocRecordIds?: string[];
  }>;
};

describe("story 6.3.3 registry context-routing integration guardrails", () => {
  it("keeps routing mappings and examples aligned to indexed registry record IDs", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as {
      entries: RegistryEntry[];
    };
    const routing = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as RoutingSeed;

    const recordIds = new Set(registry.entries.map((entry) => entry.recordId));
    const recordIdByPath = new Map(registry.entries.map((entry) => [entry.path, entry.recordId]));

    for (const mapping of routing.mappings) {
      expect(Array.isArray(mapping.relatedDocRecordIds)).toBe(true);
      expect((mapping.relatedDocRecordIds || []).length).toBeGreaterThan(0);
      const mappingIds = new Set(mapping.relatedDocRecordIds || []);
      for (const recordId of mappingIds) {
        expect(recordIds.has(recordId)).toBe(true);
      }

      for (const path of mapping.relatedDocPaths || []) {
        const indexedRecordId = recordIdByPath.get(path);
        if (!indexedRecordId) {
          continue;
        }
        expect(mappingIds.has(indexedRecordId)).toBe(true);
      }
    }

    for (const example of routing.routingExamples) {
      const indexedDocIds = (example.expectedRelatedDocOrder || [])
        .map((path) => recordIdByPath.get(path))
        .filter((value): value is string => typeof value === "string");
      if (indexedDocIds.length === 0) {
        continue;
      }

      expect(Array.isArray(example.relatedDocRecordIds)).toBe(true);
      expect((example.relatedDocRecordIds || []).length).toBeGreaterThan(0);
      const exampleIds = new Set(example.relatedDocRecordIds || []);
      for (const recordId of exampleIds) {
        expect(recordIds.has(recordId)).toBe(true);
      }
      for (const indexedDocId of indexedDocIds) {
        expect(exampleIds.has(indexedDocId)).toBe(true);
      }
    }
  });

  it("keeps pack catalog references aligned to indexed registry record IDs", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as {
      entries: RegistryEntry[];
    };
    const catalog = JSON.parse(read("docs/context/packs/context-pack-catalog.seed.json")) as PackCatalogSeed;
    const recordIds = new Set(registry.entries.map((entry) => entry.recordId));
    const recordIdByPath = new Map(registry.entries.map((entry) => [entry.path, entry.recordId]));

    for (const pack of catalog.packs) {
      expect(Array.isArray(pack.relatedDocRecordIds)).toBe(true);
      expect((pack.relatedDocRecordIds || []).length).toBeGreaterThan(0);
      const packIds = new Set(pack.relatedDocRecordIds || []);
      for (const recordId of packIds) {
        expect(recordIds.has(recordId)).toBe(true);
      }

      const indexedPaths = [pack.primaryDocPath, ...(pack.relatedDocPaths || [])]
        .map((path) => recordIdByPath.get(path))
        .filter((value): value is string => typeof value === "string");

      for (const indexedRecordId of indexedPaths) {
        expect(packIds.has(indexedRecordId)).toBe(true);
      }
    }
  });

  it("documents story 6.3.3 integration boundaries in registry and routing contract guidance", () => {
    const registryHuman = read("docs/context/documentation-registry.md");
    const registryAi = read("docs/context/documentation-registry.ai.md");
    const routingHuman = read("docs/context/routing/prompt-routing-contract.md");
    const routingAi = read("docs/context/routing/prompt-routing-contract.ai.md");

    expect(registryHuman).toContain("## Context Routing and Pack Selection Integration Status (Story 6.3.3)");
    expect(registryAi).toContain("## Context Routing and Pack Selection Integration Status (Story 6.3.3)");
    expect(registryHuman).toContain("relatedDocRecordIds");
    expect(registryAi).toContain("relatedDocRecordIds");
    expect(routingHuman).toContain("Every active mapping must include `relatedDocRecordIds`");
    expect(routingAi).toContain("Every active mapping must include `relatedDocRecordIds`");
  });
});
