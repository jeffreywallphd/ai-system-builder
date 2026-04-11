import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const registryPath = resolve(repoRoot, "docs/context/documentation-registry.seed.json");
const humanSpecPath = resolve(repoRoot, "docs/context/documentation-registry.md");
const aiSpecPath = resolve(repoRoot, "docs/context/documentation-registry.ai.md");
const metadataContractPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.contract.json");
const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");

const requiredDiscoveryIndexes = [
  "byDocType",
  "byStatus",
  "byDomain",
  "byAuthoritativeness",
] as const;

type RegistryEntry = {
  recordId: string;
  path: string;
  docType: string;
  domain: string;
  status: string;
  authoritativeness: string;
  summary: string;
  aiPath?: string;
  relatedRecordIds?: string[];
};

type DocumentationRegistry = {
  schemaVersion: string;
  artifactType: string;
  entryContractPath: string;
  taxonomyContractPath: string;
  docTypeCatalog: string[];
  statusCatalog: string[];
  authoritativenessCatalog: string[];
  domainRelationships: Record<string, string[]>;
  entries: RegistryEntry[];
  discoveryIndex: Record<string, Record<string, string[]>>;
};

type IndexedMetadataContract = {
  requiredFields: string[];
};

type TaxonomyContract = {
  metadataFields: {
    document_type: { allowedValues: string[] };
    status: { allowedValues: string[] };
    authoritativeness: { allowedValues: string[] };
  };
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("story 6.1.3 documentation registry structure guardrails", () => {
  it("keeps registry artifacts present", () => {
    expect(existsSync(registryPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("keeps registry contract anchors and major category coverage", () => {
    const registry = readJson<DocumentationRegistry>(registryPath);
    const taxonomy = readJson<TaxonomyContract>(taxonomyContractPath);

    expect(registry.schemaVersion).toBe("1.0.0");
    expect(registry.artifactType).toBe("documentation-registry");
    expect(registry.entryContractPath).toBe("docs/context/documentation-indexed-document-metadata.contract.json");
    expect(registry.taxonomyContractPath).toBe("docs/context/documentation-taxonomy.contract.json");
    expect(registry.docTypeCatalog).toEqual(taxonomy.metadataFields.document_type.allowedValues);
    expect(registry.statusCatalog).toEqual(taxonomy.metadataFields.status.allowedValues);
    expect(registry.authoritativenessCatalog).toEqual(taxonomy.metadataFields.authoritativeness.allowedValues);
    expect(Object.keys(registry.domainRelationships).length).toBeGreaterThanOrEqual(5);
  });

  it("keeps entry shape aligned with metadata contract and existing docs", () => {
    const registry = readJson<DocumentationRegistry>(registryPath);
    const metadataContract = readJson<IndexedMetadataContract>(metadataContractPath);
    const requiredFields = ["recordId", ...metadataContract.requiredFields];

    expect(registry.entries.length).toBeGreaterThanOrEqual(8);

    const recordIds = new Set<string>();
    const coveredDocTypes = new Set<string>();

    for (const entry of registry.entries) {
      for (const fieldName of requiredFields) {
        const value = (entry as unknown as Record<string, unknown>)[fieldName];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }

      expect(entry.path.endsWith(".md")).toBe(true);
      expect(entry.path.endsWith(".ai.md")).toBe(false);
      expect(existsSync(resolve(repoRoot, entry.path))).toBe(true);

      if (entry.aiPath) {
        expect(entry.aiPath.endsWith(".ai.md")).toBe(true);
        expect(existsSync(resolve(repoRoot, entry.aiPath))).toBe(true);
      }

      expect(recordIds.has(entry.recordId)).toBe(false);
      expect(entry.recordId).toMatch(/^doc-[a-z0-9]+(?:-[a-z0-9]+)*$/);
      recordIds.add(entry.recordId);
      coveredDocTypes.add(entry.docType);
    }

    for (const entry of registry.entries) {
      if (!entry.relatedRecordIds) {
        continue;
      }
      for (const relatedRecordId of entry.relatedRecordIds) {
        expect(recordIds.has(relatedRecordId)).toBe(true);
        expect(relatedRecordId).not.toBe(entry.recordId);
      }
    }

    expect([...coveredDocTypes].sort((left, right) => left.localeCompare(right))).toEqual(
      [...registry.docTypeCatalog].sort((left, right) => left.localeCompare(right)),
    );
  });

  it("keeps discovery indexes present and internally consistent", () => {
    const registry = readJson<DocumentationRegistry>(registryPath);
    const recordIds = new Set(registry.entries.map((entry) => entry.recordId));

    for (const indexName of requiredDiscoveryIndexes) {
      const indexMap = registry.discoveryIndex[indexName];
      expect(indexMap).toBeDefined();
      expect(typeof indexMap).toBe("object");

      for (const values of Object.values(indexMap)) {
        expect(Array.isArray(values)).toBe(true);
        for (const recordId of values) {
          expect(recordIds.has(recordId)).toBe(true);
        }
      }
    }
  });

  it("keeps registry discoverable from root and context routers", () => {
    const docsReadme = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
    const docsReadmeAi = readFileSync(resolve(repoRoot, "docs/README.ai.md"), "utf8");
    const contextReadme = readFileSync(resolve(repoRoot, "docs/context/README.md"), "utf8");
    const contextReadmeAi = readFileSync(resolve(repoRoot, "docs/context/README.ai.md"), "utf8");

    expect(docsReadme).toContain("./context/documentation-registry.md");
    expect(docsReadmeAi).toContain("./context/documentation-registry.ai.md");
    expect(contextReadme).toContain("./documentation-registry.md");
    expect(contextReadmeAi).toContain("./documentation-registry.ai.md");
  });
});
