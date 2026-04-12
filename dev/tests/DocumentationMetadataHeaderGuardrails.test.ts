import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/documentation-metadata-header.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/documentation-metadata-header.md");
const aiSpecPath = resolve(repoRoot, "docs/context/documentation-metadata-header.ai.md");
const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");

const requiredFieldIds = [
  "title",
  "doc_type",
  "status",
  "authoritativeness",
  "owned_by",
  "last_reviewed",
] as const;

const optionalFieldIds = [
  "related_code_paths",
  "supersedes",
  "superseded_by",
] as const;

type TaxonomyContract = {
  metadataFields: {
    document_type: { allowedValues: string[] };
    status: { allowedValues: string[] };
    authoritativeness: { allowedValues: string[] };
  };
};

type MetadataHeaderContract = {
  schemaVersion: string;
  format: {
    type: string;
    openingDelimiter: string;
    closingDelimiter: string;
    placement: string;
  };
  requiredFields: Record<string, {
    type: string;
    description: string;
    allowedValues?: string[];
    derivedFromTaxonomyField?: string;
    format?: string;
  }>;
  optionalFields: Record<string, {
    type: string;
    description: string;
  }>;
  crossFieldRules: Array<{ id: string; description: string }>;
  examples: Record<string, Record<string, string | string[]>>;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("documentation metadata header guardrails", () => {
  it("keeps metadata-header contract artifacts present", () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("enforces yaml-frontmatter contract format and required fields", () => {
    const contract = readJsonFile<MetadataHeaderContract>(contractPath);

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.format.type).toBe("yaml-frontmatter");
    expect(contract.format.openingDelimiter).toBe("---");
    expect(contract.format.closingDelimiter).toBe("---");
    expect(contract.format.placement).toContain("first block");

    expect(Object.keys(contract.requiredFields)).toEqual(requiredFieldIds);
    expect(Object.keys(contract.optionalFields)).toEqual(optionalFieldIds);

    for (const fieldId of requiredFieldIds) {
      expect(contract.requiredFields[fieldId].description.trim().length).toBeGreaterThan(0);
    }

    for (const fieldId of optionalFieldIds) {
      expect(contract.optionalFields[fieldId].description.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps enum values synchronized with taxonomy contract", () => {
    const metadataContract = readJsonFile<MetadataHeaderContract>(contractPath);
    const taxonomyContract = readJsonFile<TaxonomyContract>(taxonomyContractPath);

    expect(metadataContract.requiredFields.doc_type.allowedValues).toEqual(
      taxonomyContract.metadataFields.document_type.allowedValues,
    );
    expect(metadataContract.requiredFields.status.allowedValues).toEqual(
      taxonomyContract.metadataFields.status.allowedValues,
    );
    expect(metadataContract.requiredFields.authoritativeness.allowedValues).toEqual(
      taxonomyContract.metadataFields.authoritativeness.allowedValues,
    );
    expect(metadataContract.requiredFields.doc_type.derivedFromTaxonomyField).toBe("document_type");
    expect(metadataContract.requiredFields.last_reviewed.format).toBe("YYYY-MM-DD");
  });

  it("enforces supersession and review-date rule anchors", () => {
    const contract = readJsonFile<MetadataHeaderContract>(contractPath);
    const ruleIds = new Set(contract.crossFieldRules.map((rule) => rule.id));

    expect(ruleIds.has("rule-supersession-mutual-exclusion")).toBe(true);
    expect(ruleIds.has("rule-superseded-status-requires-link")).toBe(true);
    expect(ruleIds.has("rule-last-reviewed-not-in-future")).toBe(true);
  });

  it("requires examples for each approved doc type", () => {
    const contract = readJsonFile<MetadataHeaderContract>(contractPath);
    const requiredDocTypes = [
      "architecture-overview",
      "architecture-reference",
      "contributor-guide",
      "runbook",
      "adr",
      "baseline",
      "ai-context",
    ] as const;

    for (const docType of requiredDocTypes) {
      const example = contract.examples[docType];
      expect(example).toBeDefined();
      expect(example.doc_type).toBe(docType);
      expect(typeof example.title).toBe("string");
      expect(typeof example.owned_by).toBe("string");
      expect(typeof example.last_reviewed).toBe("string");
    }
  });

  it("keeps human and AI specs aligned to contract anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    const requiredAnchors = [
      "YAML frontmatter",
      "title",
      "doc_type",
      "status",
      "authoritativeness",
      "owned_by",
      "last_reviewed",
      "related_code_paths",
      "supersedes",
      "superseded_by",
      "architecture-overview",
      "architecture-reference",
      "contributor-guide",
      "runbook",
      "adr",
      "baseline",
      "ai-context",
    ];

    for (const anchor of requiredAnchors) {
      expect(humanSpec).toContain(anchor);
      expect(aiSpec).toContain(anchor);
    }
  });

  it("keeps context routers linked to the metadata-header contract", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");

    expect(contextReadme).toContain("./documentation-metadata-header.md");
    expect(contextAiReadme).toContain("./documentation-metadata-header.ai.md");
  });
});
