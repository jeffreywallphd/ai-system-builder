import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const templatesDir = resolve(repoRoot, "docs/context/templates");
const registryHumanSpecPath = resolve(repoRoot, "docs/context/documentation-registry.md");
const registryAiSpecPath = resolve(repoRoot, "docs/context/documentation-registry.ai.md");
const metadataContractPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.contract.json");
const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
const registrySeedPath = resolve(repoRoot, "docs/context/documentation-registry.seed.json");

const templateFiles = [
  "documentation-registry-entry.template.json",
  "documentation-registry-entry.architecture.template.json",
  "documentation-registry-entry.adr.template.json",
  "documentation-registry-entry.context-pack.template.json",
] as const;

const allowedRecordIdPattern = /^doc-[a-z0-9]+(?:-[a-z0-9]+)*$/;

type MetadataContract = {
  requiredFields: string[];
  optionalFields: string[];
};

type TaxonomyContract = {
  metadataFields: {
    document_type: { allowedValues: string[] };
    status: { allowedValues: string[] };
    authoritativeness: { allowedValues: string[] };
  };
};

type RegistrySeed = {
  domainRelationships: Record<string, string[]>;
};

type RegistryEntryTemplate = {
  recordId: string;
  path: string;
  docType: string;
  domain: string;
  status: string;
  authoritativeness: string;
  aiPath?: string;
  relatedRecordIds?: string[];
  supersededBy?: string;
  [key: string]: unknown;
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

describe("story 6.1.6 documentation registry authoring patterns guardrails", () => {
  it("keeps registry authoring starter templates present and discoverable", () => {
    const templatesReadme = read(resolve(templatesDir, "README.md"));
    const templatesReadmeAi = read(resolve(templatesDir, "README.ai.md"));
    const registryHumanSpec = read(registryHumanSpecPath);
    const registryAiSpec = read(registryAiSpecPath);

    for (const templateFile of templateFiles) {
      expect(existsSync(resolve(templatesDir, templateFile))).toBe(true);
      expect(templatesReadme).toContain(templateFile);
      expect(templatesReadmeAi).toContain(templateFile);
      expect(registryHumanSpec).toContain(templateFile);
      expect(registryAiSpec).toContain(templateFile);
    }
  });

  it("keeps starter templates aligned to metadata contract and identity conventions", () => {
    const metadataContract = readJson<MetadataContract>(metadataContractPath);
    const taxonomy = readJson<TaxonomyContract>(taxonomyContractPath);
    const registry = readJson<RegistrySeed>(registrySeedPath);

    const requiredFields = new Set(["recordId", ...metadataContract.requiredFields]);
    const allowedFields = new Set(["recordId", ...metadataContract.requiredFields, ...metadataContract.optionalFields]);
    const allowedDocTypes = new Set(taxonomy.metadataFields.document_type.allowedValues);
    const allowedStatuses = new Set(taxonomy.metadataFields.status.allowedValues);
    const allowedAuthoritativeness = new Set(taxonomy.metadataFields.authoritativeness.allowedValues);
    const allowedDomains = new Set(Object.keys(registry.domainRelationships));

    for (const templateFile of templateFiles) {
      const template = readJson<RegistryEntryTemplate>(resolve(templatesDir, templateFile));

      for (const fieldName of requiredFields) {
        expect(typeof template[fieldName]).toBe("string");
        expect((template[fieldName] as string).trim().length).toBeGreaterThan(0);
      }

      for (const fieldName of Object.keys(template)) {
        expect(allowedFields.has(fieldName)).toBe(true);
      }

      expect(template.recordId).toMatch(allowedRecordIdPattern);
      expect(template.path.startsWith("docs/")).toBe(true);
      expect(template.path.endsWith(".md")).toBe(true);
      expect(template.path.endsWith(".ai.md")).toBe(false);

      if (template.aiPath) {
        expect(template.aiPath.endsWith(".ai.md")).toBe(true);
      }

      expect(allowedDocTypes.has(template.docType)).toBe(true);
      expect(allowedStatuses.has(template.status)).toBe(true);
      expect(allowedAuthoritativeness.has(template.authoritativeness)).toBe(true);
      expect(allowedDomains.has(template.domain)).toBe(true);

      if (template.relatedRecordIds) {
        expect(Array.isArray(template.relatedRecordIds)).toBe(true);
        expect(template.relatedRecordIds.length).toBeGreaterThan(0);
      }

      if (template.status === "superseded") {
        expect(typeof template.supersededBy).toBe("string");
        expect((template.supersededBy || "").trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps category-specific starter patterns explicit", () => {
    const architectureTemplate = readJson<RegistryEntryTemplate>(resolve(templatesDir, "documentation-registry-entry.architecture.template.json"));
    const adrTemplate = readJson<RegistryEntryTemplate>(resolve(templatesDir, "documentation-registry-entry.adr.template.json"));
    const contextPackTemplate = readJson<RegistryEntryTemplate>(resolve(templatesDir, "documentation-registry-entry.context-pack.template.json"));

    expect(architectureTemplate.docType).toBe("architecture-reference");
    expect(architectureTemplate.domain).toBe("architecture");

    expect(adrTemplate.docType).toBe("adr");
    expect(adrTemplate.domain).toBe("decision-records");
    expect(adrTemplate.path.startsWith("docs/adr/records/")).toBe(true);

    expect(contextPackTemplate.docType).toBe("ai-context");
    expect(contextPackTemplate.path.startsWith("docs/context/packs/")).toBe(true);
  });
});
