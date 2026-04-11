import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.md");
const aiSpecPath = resolve(repoRoot, "docs/context/documentation-indexed-document-metadata.ai.md");
const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
const docsReadmePath = resolve(repoRoot, "docs/README.md");
const docsAiReadmePath = resolve(repoRoot, "docs/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");

const requiredFields = [
  "path",
  "title",
  "docType",
  "domain",
  "status",
  "authoritativeness",
  "summary",
] as const;

const optionalFields = [
  "keywords",
  "relatedCodePaths",
  "relatedDocs",
  "relatedRecordIds",
  "owner",
  "lastReviewed",
  "aiPath",
  "supersedes",
  "supersededBy",
] as const;

type TaxonomyContract = {
  metadataFields: {
    document_type: { allowedValues: string[] };
    status: { allowedValues: string[] };
    authoritativeness: { allowedValues: string[] };
  };
};

type IndexedDocumentMetadataContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  derivedFromTaxonomyContractPath: string;
  identityConventionsContractPath: string;
  requiredFields: string[];
  optionalFields: string[];
  fieldDefinitions: Record<string, {
    type: string;
    description: string;
    derivedFromTaxonomyField?: string;
    format?: string;
  }>;
  crossFieldRules: Array<{ id: string; description: string }>;
  exampleEntry: Record<string, string | string[]>;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("story 6.1.2 indexed document metadata contract guardrails", () => {
  it("keeps indexed-document metadata contract artifacts present", () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("keeps required vs optional fields explicit and stable", () => {
    const contract = readJsonFile<IndexedDocumentMetadataContract>(contractPath);

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("documentation-indexed-document-metadata-standard");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/documentation-indexed-document-metadata.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/documentation-indexed-document-metadata.ai.md");
    expect(contract.derivedFromTaxonomyContractPath).toBe("docs/context/documentation-taxonomy.contract.json");
    expect(contract.identityConventionsContractPath).toBe("docs/context/documentation-identity-and-reference.contract.json");
    expect(contract.requiredFields).toEqual(requiredFields);
    expect(contract.optionalFields).toEqual(optionalFields);

    for (const fieldId of [...requiredFields, ...optionalFields]) {
      expect(contract.fieldDefinitions[fieldId]).toBeDefined();
      expect(contract.fieldDefinitions[fieldId].description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps taxonomy-derived enum fields synchronized", () => {
    const contract = readJsonFile<IndexedDocumentMetadataContract>(contractPath);
    const taxonomy = readJsonFile<TaxonomyContract>(taxonomyContractPath);

    expect(contract.fieldDefinitions.docType.derivedFromTaxonomyField).toBe("document_type");
    expect(contract.fieldDefinitions.status.derivedFromTaxonomyField).toBe("status");
    expect(contract.fieldDefinitions.authoritativeness.derivedFromTaxonomyField).toBe("authoritativeness");
    expect(taxonomy.metadataFields.document_type.allowedValues).toContain("ai-context");
    expect(taxonomy.metadataFields.status.allowedValues).toContain("superseded");
    expect(taxonomy.metadataFields.authoritativeness.allowedValues).toContain("canonical");
  });

  it("keeps supersession and review-date rule anchors", () => {
    const contract = readJsonFile<IndexedDocumentMetadataContract>(contractPath);
    const ruleIds = new Set(contract.crossFieldRules.map((rule) => rule.id));

    expect(ruleIds.has("rule-index-path-must-be-human-markdown")).toBe(true);
    expect(ruleIds.has("rule-index-aipath-must-be-ai-markdown")).toBe(true);
    expect(ruleIds.has("rule-index-supersession-mutual-exclusion")).toBe(true);
    expect(ruleIds.has("rule-index-related-record-ids-must-exist")).toBe(true);
    expect(ruleIds.has("rule-index-related-docs-should-include-stable-record-links")).toBe(true);
    expect(ruleIds.has("rule-index-superseded-status-requires-link")).toBe(true);
    expect(ruleIds.has("rule-index-last-reviewed-not-in-future")).toBe(true);
  });

  it("keeps example entry aligned with required fields", () => {
    const contract = readJsonFile<IndexedDocumentMetadataContract>(contractPath);
    const example = contract.exampleEntry;

    for (const fieldId of requiredFields) {
      expect(example[fieldId]).toBeDefined();
    }
    expect(example.path).toBe("docs/context/documentation-indexing-model.md");
    expect(example.docType).toBe("ai-context");
    expect(example.status).toBe("active");
    expect(example.authoritativeness).toBe("canonical");
    expect(example.aiPath).toBe("docs/context/documentation-indexing-model.ai.md");
    expect(example.relatedRecordIds).toEqual(["doc-context-documentation-taxonomy"]);
  });

  it("keeps docs discoverable from root and context routers", () => {
    const docsReadme = readFileSync(docsReadmePath, "utf8");
    const docsReadmeAi = readFileSync(docsAiReadmePath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextReadmeAi = readFileSync(contextAiReadmePath, "utf8");

    expect(docsReadme).toContain("./context/documentation-indexed-document-metadata.md");
    expect(docsReadmeAi).toContain("./context/documentation-indexed-document-metadata.ai.md");
    expect(contextReadme).toContain("./documentation-indexed-document-metadata.md");
    expect(contextReadmeAi).toContain("./documentation-indexed-document-metadata.ai.md");
  });

  it("keeps human and AI specs aligned to contract anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    for (const anchor of [
      ...requiredFields,
      ...optionalFields,
      "indexed documentation records",
      "registry records",
      "supersededBy",
      "status",
      "authoritativeness",
      "summary",
    ]) {
      expect(humanSpec).toContain(anchor);
      expect(aiSpec).toContain(anchor);
    }
  });
});
