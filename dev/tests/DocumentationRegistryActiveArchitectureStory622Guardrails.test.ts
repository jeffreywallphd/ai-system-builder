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
  status: string;
  domain: string;
};

type RegistrySeed = {
  entries: RegistryEntry[];
  discoveryIndex: {
    byDomain: Record<string, string[]>;
  };
};

type RoutingSeed = {
  routingExamples: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
  mappings: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
};

const requiredArchitectureRecordIds = [
  "doc-architecture-domain-and-application-core",
  "doc-architecture-layers-and-boundaries",
  "doc-architecture-domain-taxonomy",
  "doc-architecture-domain-migration-inventory",
  "doc-architecture-migration-sequence-and-priority",
  "doc-architecture-domainization-rollout-boundaries",
  "doc-architecture-supersession-and-retirement-governance",
  "doc-architecture-document-scope-boundaries",
  "doc-architecture-domain-cross-linking-rules",
  "doc-architecture-domain-core-platform-and-composition-overview",
  "doc-architecture-domain-runtime-host-surfaces-overview",
  "doc-architecture-domain-identity-trust-and-security-overview",
  "doc-architecture-domain-workspace-storage-and-assets-overview",
  "doc-architecture-domain-execution-control-plane-and-scheduling-overview",
  "doc-architecture-domain-studio-and-system-composition-overview",
  "doc-architecture-domain-api-and-transport-surfaces-overview",
  "doc-architecture-domain-deployment-policy-and-audit-governance-overview",
] as const;

describe("story 6.2.2 active architecture registry population guardrails", () => {
  it("indexes key active architecture domain and routing materials", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredArchitectureRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }

      expect(entry.status).toBe("active");
      expect(["architecture-overview", "architecture-reference"]).toContain(entry.docType);
      expect(entry.path.startsWith("docs/architecture/")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.path))).toBe(true);
      expect(typeof entry.aiPath).toBe("string");
      expect((entry.aiPath || "").endsWith(".ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, entry.aiPath || ""))).toBe(true);
    }
  });

  it("keeps architecture-focused discovery indexes and routing record-id links usable", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const routing = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as RoutingSeed;
    const recordIds = new Set(registry.entries.map((entry) => entry.recordId));

    const architectureDomainIds = registry.discoveryIndex.byDomain.architecture ?? [];
    expect(architectureDomainIds.length).toBeGreaterThanOrEqual(10);
    expect(architectureDomainIds).toEqual(
      expect.arrayContaining([
        "doc-architecture-domain-taxonomy",
        "doc-architecture-domain-runtime-host-surfaces-overview",
        "doc-architecture-domain-execution-control-plane-and-scheduling-overview",
      ]),
    );

    const architectureReviewExample = routing.routingExamples.find(
      (example) => example.taskId === "example-architecture-review-host-boundaries",
    );
    expect(Array.isArray(architectureReviewExample?.relatedDocRecordIds)).toBe(true);
    expect(architectureReviewExample?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-architecture-domain-taxonomy",
        "doc-architecture-domain-runtime-host-surfaces-overview",
      ]),
    );

    const architectureReviewRoute = routing.mappings.find(
      (mapping) => mapping.taskId === "architecture-review-host-boundaries",
    );
    expect(Array.isArray(architectureReviewRoute?.relatedDocRecordIds)).toBe(true);
    expect(architectureReviewRoute?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-architecture-domain-taxonomy",
        "doc-architecture-domain-core-platform-and-composition-overview",
      ]),
    );

    for (const recordId of architectureReviewExample?.relatedDocRecordIds || []) {
      expect(recordIds.has(recordId)).toBe(true);
    }
    for (const recordId of architectureReviewRoute?.relatedDocRecordIds || []) {
      expect(recordIds.has(recordId)).toBe(true);
    }
  });

  it("documents story 6.2.2 architecture population status in human and AI registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## Active Architecture Population Status (Story 6.2.2)");
    expect(ai).toContain("## Active Architecture Population Status (Story 6.2.2)");
    expect(human).toContain("docs/architecture/domains/*/overview.md");
    expect(ai).toContain("docs/architecture/domains/*/overview.md");
  });
});
