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
  aiPath?: string;
  docType: string;
  domain: string;
  status: string;
  authoritativeness: string;
};

type RegistrySeed = {
  entries: RegistryEntry[];
  discoveryIndex: {
    byDocType: Record<string, string[]>;
    byStatus: Record<string, string[]>;
    byDomain: Record<string, string[]>;
    byAuthoritativeness: Record<string, string[]>;
  };
};

type RoutingSeed = {
  routingExamples: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
  mappings: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
};

const requiredAdrRecordIds = [
  "doc-adr-001-single-authoritative-control-plane",
  "doc-adr-002-workspace-centered-tenancy-and-resource-ownership",
  "doc-adr-003-storage-as-managed-platform-resource",
  "doc-adr-004-studios-as-views-over-shared-system-and-asset-model",
  "doc-adr-005-trust-identity-and-security-boundary-enforcement",
  "doc-adr-006-policy-aware-scheduling-and-controlled-execution",
] as const;

const requiredContextPackRecordIds = [
  "doc-context-pack-repository-overview",
  "doc-context-pack-architecture-core",
  "doc-context-pack-context-system-foundations",
  "doc-context-pack-documentation-refactor",
  "doc-context-pack-runtime-and-host",
  "doc-context-pack-identity-and-security",
  "doc-context-pack-studio-and-system-composition",
] as const;

const requiredContributorGuideRecordIds = [
  "doc-contributors-docs-placement-guide",
  "doc-contributors-context-engineering-system-guide",
  "doc-contributors-docs-foundation-validation-guide",
  "doc-contributors-docs-migration-safety-guide",
  "doc-contributors-adr-informed-implementation-and-review-examples",
] as const;

describe("story 6.2.3 registry population for adr, context packs, and contributor guidance", () => {
  it("indexes the current ADR set with explicit active authoritative metadata", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredAdrRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("adr");
      expect(entry.domain).toBe("decision-records");
      expect(entry.status).toBe("active");
      expect(entry.authoritativeness).toBe("canonical");
      expect(entry.path.startsWith("docs/adr/records/")).toBe(true);
      expect(entry.path.endsWith(".md")).toBe(true);
      expect(entry.path.endsWith(".ai.md")).toBe(false);
      expect(existsSync(resolve(repoRoot, entry.path))).toBe(true);
      expect(typeof entry.aiPath).toBe("string");
      expect((entry.aiPath || "").endsWith(".ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.aiPath || ""))).toBe(true);
    }

    expect(registry.discoveryIndex.byDocType.adr).toEqual(expect.arrayContaining(requiredAdrRecordIds));
    expect(registry.discoveryIndex.byStatus.active).toEqual(expect.arrayContaining(requiredAdrRecordIds));
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toEqual(expect.arrayContaining(requiredAdrRecordIds));
    expect(registry.discoveryIndex.byDomain["decision-records"]).toEqual(expect.arrayContaining(requiredAdrRecordIds));
  });

  it("indexes context packs and key contributor guidance for practical discovery", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredContextPackRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("ai-context");
      expect(entry.status).toBe("active");
      expect(["canonical", "supplemental"]).toContain(entry.authoritativeness);
      expect(entry.path.startsWith("docs/context/packs/")).toBe(true);
      expect(entry.path.endsWith(".pack.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.path))).toBe(true);
      expect(typeof entry.aiPath).toBe("string");
      expect((entry.aiPath || "").endsWith(".pack.ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.aiPath || ""))).toBe(true);
    }

    for (const recordId of requiredContributorGuideRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("contributor-guide");
      expect(entry.domain).toBe("contributors");
      expect(entry.status).toBe("active");
      expect(["canonical", "reference"]).toContain(entry.authoritativeness);
      expect(entry.path.startsWith("docs/contributors/")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.path))).toBe(true);
      expect(typeof entry.aiPath).toBe("string");
      expect((entry.aiPath || "").endsWith(".ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.aiPath || ""))).toBe(true);
    }

    expect(registry.discoveryIndex.byDocType["ai-context"]).toEqual(expect.arrayContaining(requiredContextPackRecordIds));
    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toEqual(expect.arrayContaining(requiredContributorGuideRecordIds));
    expect(registry.discoveryIndex.byDomain.contributors).toEqual(expect.arrayContaining(requiredContributorGuideRecordIds));
    expect(registry.discoveryIndex.byStatus.active).toEqual(
      expect.arrayContaining([...requiredContextPackRecordIds, ...requiredContributorGuideRecordIds]),
    );
  });

  it("keeps documentation routing mappings linked to new discovery record ids", () => {
    const routing = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as RoutingSeed;

    const documentationExample = routing.routingExamples.find(
      (example) => example.taskId === "example-documentation-routing-restructure",
    );
    expect(Array.isArray(documentationExample?.relatedDocRecordIds)).toBe(true);
    expect(documentationExample?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-context-pack-documentation-refactor",
        "doc-contributors-docs-placement-guide",
        "doc-contributors-docs-migration-safety-guide",
        "doc-contributors-docs-foundation-validation-guide",
      ]),
    );

    const documentationRoute = routing.mappings.find(
      (mapping) => mapping.taskId === "documentation-refactor-context-and-architecture",
    );
    expect(Array.isArray(documentationRoute?.relatedDocRecordIds)).toBe(true);
    expect(documentationRoute?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-context-pack-documentation-refactor",
        "doc-contributors-docs-placement-guide",
        "doc-contributors-docs-migration-safety-guide",
        "doc-contributors-docs-foundation-validation-guide",
      ]),
    );
  });

  it("documents story 6.2.3 population status in human and ai registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## ADR, Context Pack, and Contributor Population Status (Story 6.2.3)");
    expect(ai).toContain("## ADR, Context Pack, and Contributor Population Status (Story 6.2.3)");
    expect(human).toContain("docs/adr/records/adr-00*.md");
    expect(ai).toContain("docs/adr/records/adr-00*.md");
    expect(human).toContain("docs/context/packs/*.pack.md");
    expect(ai).toContain("docs/context/packs/*.pack.md");
    expect(human).toContain("docs/contributors/context-engineering-system-guide.md");
    expect(ai).toContain("docs/contributors/context-engineering-system-guide.md");
  });
});
