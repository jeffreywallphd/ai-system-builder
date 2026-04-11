import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanSpecPath = resolve(repoRoot, "docs/context/documentation-identity-and-reference-conventions.md");
const aiSpecPath = resolve(repoRoot, "docs/context/documentation-identity-and-reference-conventions.ai.md");
const contractPath = resolve(repoRoot, "docs/context/documentation-identity-and-reference.contract.json");
const registryPath = resolve(repoRoot, "docs/context/documentation-registry.seed.json");
const routingSeedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");
const packCatalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");

type IdentityContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  stableIdentity: {
    field: string;
    pattern: string;
  };
  crossArtifactReferenceFields: {
    registryEntry: string[];
    routingMapping: string[];
    routingExample: string[];
    contextPackCatalogEntry: string[];
  };
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("story 6.1.4 documentation identity and reference guardrails", () => {
  it("keeps identity convention artifacts present", () => {
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
    expect(existsSync(contractPath)).toBe(true);
  });

  it("keeps identity contract anchors stable", () => {
    const contract = readJson<IdentityContract>(contractPath);
    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("documentation-identity-and-reference-conventions");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/documentation-identity-and-reference-conventions.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/documentation-identity-and-reference-conventions.ai.md");
    expect(contract.stableIdentity.field).toBe("recordId");
    expect(contract.stableIdentity.pattern).toBe("^doc-[a-z0-9]+(?:-[a-z0-9]+)*$");
    expect(contract.crossArtifactReferenceFields.registryEntry).toContain("relatedRecordIds");
    expect(contract.crossArtifactReferenceFields.routingMapping).toContain("relatedDocRecordIds");
    expect(contract.crossArtifactReferenceFields.routingExample).toContain("relatedDocRecordIds");
    expect(contract.crossArtifactReferenceFields.contextPackCatalogEntry).toContain("relatedDocRecordIds");
  });

  it("keeps registry and cross-artifact stable key references resolvable", () => {
    const registry = readJson<{ entries: Array<{ recordId: string; relatedRecordIds?: string[] }> }>(registryPath);
    const routing = readJson<{
      mappings: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
      routingExamples: Array<{ taskId: string; relatedDocRecordIds?: string[] }>;
    }>(routingSeedPath);
    const packCatalog = readJson<{ packs: Array<{ id: string; relatedDocRecordIds?: string[] }> }>(packCatalogSeedPath);

    const recordIds = new Set(registry.entries.map((entry) => entry.recordId));
    for (const recordId of recordIds) {
      expect(recordId).toMatch(/^doc-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }

    for (const entry of registry.entries) {
      for (const relatedRecordId of entry.relatedRecordIds || []) {
        expect(recordIds.has(relatedRecordId)).toBe(true);
      }
    }

    const mapping = routing.mappings.find((entry) => entry.taskId === "documentation-refactor-context-and-architecture");
    expect(mapping).toBeDefined();
    for (const relatedRecordId of mapping?.relatedDocRecordIds || []) {
      expect(recordIds.has(relatedRecordId)).toBe(true);
    }

    const example = routing.routingExamples.find((entry) => entry.taskId === "example-documentation-routing-restructure");
    expect(example).toBeDefined();
    for (const relatedRecordId of example?.relatedDocRecordIds || []) {
      expect(recordIds.has(relatedRecordId)).toBe(true);
    }

    const pack = packCatalog.packs.find((entry) => entry.id === "documentation-refactor");
    expect(pack).toBeDefined();
    for (const relatedRecordId of pack?.relatedDocRecordIds || []) {
      expect(recordIds.has(relatedRecordId)).toBe(true);
    }
  });

  it("keeps identity conventions discoverable from root and context routers", () => {
    const docsReadme = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
    const docsReadmeAi = readFileSync(resolve(repoRoot, "docs/README.ai.md"), "utf8");
    const contextReadme = readFileSync(resolve(repoRoot, "docs/context/README.md"), "utf8");
    const contextReadmeAi = readFileSync(resolve(repoRoot, "docs/context/README.ai.md"), "utf8");

    expect(docsReadme).toContain("./context/documentation-identity-and-reference-conventions.md");
    expect(docsReadmeAi).toContain("./context/documentation-identity-and-reference-conventions.ai.md");
    expect(contextReadme).toContain("./documentation-identity-and-reference-conventions.md");
    expect(contextReadmeAi).toContain("./documentation-identity-and-reference-conventions.ai.md");
  });
});

