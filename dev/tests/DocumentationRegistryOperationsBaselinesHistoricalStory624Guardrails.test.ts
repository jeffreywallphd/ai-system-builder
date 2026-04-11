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
  docType: string;
  domain: string;
  status: string;
  authoritativeness: string;
  supersededBy?: string;
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

const requiredOperationsRecordIds = [
  "doc-operations-node-bootstrap-identity",
  "doc-operations-security-policy-configuration",
  "doc-operations-secret-health-diagnostics",
  "doc-operations-workspace-administration",
  "doc-operations-storage-administration",
] as const;

const requiredBaselineRecordIds = [
  "doc-baseline-documentation-migration-baseline",
  "doc-baseline-documentation-segmentation-migration-inventory",
  "doc-baseline-feature-1-documentation-foundation-handoff",
] as const;

const requiredSupersededRecordIds = [
  "doc-architecture-superseded-presentation-and-state",
  "doc-architecture-superseded-shared-asset-contracts",
  "doc-architecture-superseded-workflow-execution-and-tools",
] as const;

describe("story 6.2.4 operations, baselines, and historical registry population guardrails", () => {
  it("indexes operations runbooks with active lifecycle and practical discovery metadata", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredOperationsRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("runbook");
      expect(entry.domain).toBe("operations");
      expect(entry.status).toBe("active");
      expect(["canonical", "reference"]).toContain(entry.authoritativeness);
      expect(entry.path.startsWith("docs/")).toBe(true);
      expect(entry.path.endsWith(".md")).toBe(true);
    }

    expect(registry.discoveryIndex.byDocType.runbook).toEqual(expect.arrayContaining(requiredOperationsRecordIds));
    expect(registry.discoveryIndex.byDomain.operations).toEqual(expect.arrayContaining(requiredOperationsRecordIds));
    expect(registry.discoveryIndex.byStatus.active).toEqual(expect.arrayContaining(requiredOperationsRecordIds));
  });

  it("indexes selective baseline anchors as historical and separates archived vs active lifecycle", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredBaselineRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("baseline");
      expect(entry.domain).toBe("baselines");
      expect(["active", "archived"]).toContain(entry.status);
      expect(entry.authoritativeness).toBe("historical");
    }

    expect(entriesById.get("doc-baseline-documentation-migration-baseline")?.status).toBe("archived");
    expect(entriesById.get("doc-baseline-feature-1-documentation-foundation-handoff")?.status).toBe("archived");
    expect(entriesById.get("doc-baseline-documentation-segmentation-migration-inventory")?.status).toBe("active");

    expect(registry.discoveryIndex.byDocType.baseline).toEqual(expect.arrayContaining(requiredBaselineRecordIds));
    expect(registry.discoveryIndex.byDomain.baselines).toEqual(expect.arrayContaining(requiredBaselineRecordIds));
    expect(registry.discoveryIndex.byStatus.archived).toEqual(
      expect.arrayContaining([
        "doc-baseline-documentation-migration-baseline",
        "doc-baseline-feature-1-documentation-foundation-handoff",
      ]),
    );
  });

  it("indexes superseded architecture stubs as historical and keeps replacement linkage explicit", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const recordId of requiredSupersededRecordIds) {
      const entry = entriesById.get(recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.docType).toBe("architecture-reference");
      expect(entry.domain).toBe("architecture");
      expect(entry.status).toBe("superseded");
      expect(entry.authoritativeness).toBe("historical");
      expect(typeof entry.supersededBy).toBe("string");
      expect((entry.supersededBy || "").startsWith("docs/architecture/domains/")).toBe(true);
    }

    expect(registry.discoveryIndex.byStatus.superseded).toEqual(expect.arrayContaining(requiredSupersededRecordIds));
    expect(registry.discoveryIndex.byAuthoritativeness.historical).toEqual(
      expect.arrayContaining([...requiredBaselineRecordIds, ...requiredSupersededRecordIds]),
    );
  });

  it("connects diagnostics and runtime-security routing to operations record ids", () => {
    const routing = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as RoutingSeed;

    const diagnosticsExample = routing.routingExamples.find(
      (example) => example.taskId === "example-diagnostics-host-startup-regression",
    );
    expect(diagnosticsExample?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-operations-node-bootstrap-identity",
        "doc-operations-secret-health-diagnostics",
        "doc-operations-security-policy-configuration",
      ]),
    );

    const runtimeSecurityExample = routing.routingExamples.find(
      (example) => example.taskId === "example-runtime-security-identity-policy-hardening",
    );
    expect(runtimeSecurityExample?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-operations-security-policy-configuration",
        "doc-operations-secret-health-diagnostics",
      ]),
    );

    const diagnosticsMapping = routing.mappings.find(
      (mapping) => mapping.taskId === "runtime-host-diagnostics-triage",
    );
    expect(diagnosticsMapping?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-operations-node-bootstrap-identity",
        "doc-operations-secret-health-diagnostics",
        "doc-operations-security-policy-configuration",
      ]),
    );

    const runtimeSecurityMapping = routing.mappings.find(
      (mapping) => mapping.taskId === "runtime-security-identity-and-policy-hardening",
    );
    expect(runtimeSecurityMapping?.relatedDocRecordIds).toEqual(
      expect.arrayContaining([
        "doc-operations-security-policy-configuration",
        "doc-operations-secret-health-diagnostics",
      ]),
    );
  });

  it("documents story 6.2.4 population status in human and ai registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## Operations, Baseline, and Historical Population Status (Story 6.2.4)");
    expect(ai).toContain("## Operations, Baseline, and Historical Population Status (Story 6.2.4)");
    expect(human).toContain("docs/security-policy-configuration-operations.md");
    expect(ai).toContain("docs/security-policy-configuration-operations.md");
    expect(human).toContain("docs/documentation-segmentation-migration-inventory.md");
    expect(ai).toContain("docs/documentation-segmentation-migration-inventory.md");
    expect(human).toContain("docs/architecture/presentation-and-state.md");
    expect(ai).toContain("docs/architecture/presentation-and-state.md");
  });
});
