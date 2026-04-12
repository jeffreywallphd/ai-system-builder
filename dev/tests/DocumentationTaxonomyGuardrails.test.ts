import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/documentation-taxonomy.md");
const aiSpecPath = resolve(repoRoot, "docs/context/documentation-taxonomy.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");

const requiredDocumentTypes = [
  "architecture-overview",
  "architecture-reference",
  "contributor-guide",
  "runbook",
  "adr",
  "baseline",
  "ai-context",
] as const;

const requiredAuthoritativenessValues = [
  "canonical",
  "reference",
  "supplemental",
  "historical",
] as const;

const requiredStatusValues = [
  "draft",
  "active",
  "deprecated",
  "superseded",
  "archived",
] as const;

type TaxonomyContract = {
  schemaVersion: string;
  metadataFields: {
    document_type: { dimension: string; required: boolean; allowedValues: string[] };
    authoritativeness: { dimension: string; required: boolean; allowedValues: string[] };
    status: { dimension: string; required: boolean; allowedValues: string[] };
  };
  documentTypes: Record<string, {
    purpose: string;
    audience: string[];
    allowedContentScope: string[];
    antiPatterns: string[];
  }>;
};

function readContract(): TaxonomyContract {
  return JSON.parse(readFileSync(contractPath, "utf8")) as TaxonomyContract;
}

describe("documentation taxonomy guardrails", () => {
  it("keeps taxonomy artifacts present", () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("enforces canonical document type and metadata field enums", () => {
    const contract = readContract();

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.metadataFields.document_type.dimension).toBe("role");
    expect(contract.metadataFields.authoritativeness.dimension).toBe("authority");
    expect(contract.metadataFields.status.dimension).toBe("lifecycle");
    expect(contract.metadataFields.document_type.required).toBe(true);
    expect(contract.metadataFields.authoritativeness.required).toBe(true);
    expect(contract.metadataFields.status.required).toBe(true);
    expect(contract.metadataFields.document_type.allowedValues).toEqual(requiredDocumentTypes);
    expect(contract.metadataFields.authoritativeness.allowedValues).toEqual(requiredAuthoritativenessValues);
    expect(contract.metadataFields.status.allowedValues).toEqual(requiredStatusValues);
  });

  it("requires full definitions for each approved document type", () => {
    const contract = readContract();
    const documentTypeIds = Object.keys(contract.documentTypes).sort((left, right) => left.localeCompare(right));
    const requiredIds = [...requiredDocumentTypes].sort((left, right) => left.localeCompare(right));

    expect(documentTypeIds).toEqual(requiredIds);

    for (const documentTypeId of requiredDocumentTypes) {
      const definition = contract.documentTypes[documentTypeId];
      expect(definition.purpose.trim().length).toBeGreaterThan(0);
      expect(definition.audience.length).toBeGreaterThan(0);
      expect(definition.allowedContentScope.length).toBeGreaterThan(0);
      expect(definition.antiPatterns.length).toBeGreaterThan(0);
    }
  });

  it("keeps context routers and placement guide linked to the canonical taxonomy", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");
    const placementGuide = readFileSync(placementGuidePath, "utf8");

    expect(contextReadme).toContain("./documentation-taxonomy.md");
    expect(contextAiReadme).toContain("./documentation-taxonomy.ai.md");
    expect(placementGuide).toContain("docs/context/documentation-taxonomy.md");
  });

  it("keeps human and AI taxonomy specs aligned to required metadata fields", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    const requiredAnchors = [
      "document_type",
      "authoritativeness",
      "status",
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

    expect(humanSpec).toContain("documentation-taxonomy.contract.json");
    expect(aiSpec).toContain("documentation-taxonomy.contract.json");
  });
});
