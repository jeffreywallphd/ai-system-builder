import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractJsonPath = resolve(repoRoot, "docs/context/packs/context-pack.contract.json");
const catalogContractPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.contract.json");
const catalogSeedPath = resolve(repoRoot, "docs/context/packs/context-pack-catalog.seed.json");
const metadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/packs/README.md");
const aiSpecPath = resolve(repoRoot, "docs/context/packs/README.ai.md");
const packsReadmePath = resolve(repoRoot, "docs/context/packs/README.md");
const packsAiReadmePath = resolve(repoRoot, "docs/context/packs/README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");

const requiredHeadings = [
  "## Purpose",
  "## When To Use",
  "## When Not To Use",
  "## Invariants",
  "## Authoritative Docs",
  "## Authoritative Code Paths",
  "## Anti-Patterns",
  "## Related Packs",
] as const;

const optionalHeadings = [
  "## Retrieval Order",
  "## Change Triggers",
] as const;

const requiredCatalogFields = [
  "id",
  "title",
  "purpose",
  "domain",
  "owner",
  "status",
  "primaryDocPath",
  "aiDocPath",
  "relatedDocPaths",
  "relatedCodePaths",
] as const;

const optionalCatalogFields = [
  "tags",
  "relatedDocRecordIds",
  "notes",
  "reviewExpectations",
] as const;

type ContextPackContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  requiredSections: Array<{
    id: string;
    heading: string;
    requiredContent: string;
  }>;
  optionalSections: Array<{
    id: string;
    heading: string;
    requiredContent: string;
  }>;
  qualityRules: {
    brevityPolicy: string;
    maxRecommendedWords: number;
    maxRecommendedWordsPerSection: number;
    preferBulletedLists: boolean;
    signalToNoiseRules: string[];
    prohibitedContent: string[];
  };
};

function readContract(): ContextPackContract {
  return JSON.parse(readFileSync(contractJsonPath, "utf8")) as ContextPackContract;
}

describe("context pack contract guardrails", () => {
  it("keeps context pack contract artifacts present", () => {
    expect(existsSync(contractJsonPath)).toBe(true);
    expect(existsSync(catalogContractPath)).toBe(true);
    expect(existsSync(catalogSeedPath)).toBe(true);
    expect(existsSync(metadataContractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("enforces required and optional sections in the machine-readable contract", () => {
    const contract = readContract();

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("context-pack-contract");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/packs/README.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/packs/README.ai.md");
    expect(contract.requiredSections.map((section) => section.heading)).toEqual(requiredHeadings);
    expect(contract.optionalSections.map((section) => section.heading)).toEqual(optionalHeadings);

    for (const section of [...contract.requiredSections, ...contract.optionalSections]) {
      expect(section.id.trim().length).toBeGreaterThan(0);
      expect(section.requiredContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("enforces brevity, signal-to-noise, and prohibited-content rules", () => {
    const contract = readContract();

    expect(contract.qualityRules.brevityPolicy).toBe("concise-and-scanable");
    expect(contract.qualityRules.maxRecommendedWords).toBe(900);
    expect(contract.qualityRules.maxRecommendedWordsPerSection).toBe(160);
    expect(contract.qualityRules.preferBulletedLists).toBe(true);
    expect(contract.qualityRules.signalToNoiseRules.length).toBeGreaterThanOrEqual(3);
    expect(contract.qualityRules.prohibitedContent).toContain("step-by-step runbooks");
    expect(contract.qualityRules.prohibitedContent).toContain("feature delivery checklists");
  });

  it("keeps catalog metadata requirements explicit and aligned to the shared metadata contract", () => {
    const catalogContract = JSON.parse(readFileSync(catalogContractPath, "utf8")) as {
      schemaVersion: string;
      artifactType: string;
      contextAssetMetadataContractPath: string;
      entryRequiredFields: string[];
      entryOptionalFields: string[];
      reviewExpectationsRequiredFieldsWhenPresent: string[];
    };
    const sharedMetadataContract = JSON.parse(readFileSync(metadataContractPath, "utf8")) as {
      requiredFields: string[];
      optionalFields: string[];
      reviewExpectations: { requiredFieldsWhenPresent: string[] };
    };
    const catalogSeed = JSON.parse(readFileSync(catalogSeedPath, "utf8")) as {
      packs: Array<Record<string, unknown>>;
    };

    expect(catalogContract.schemaVersion).toBe("1.0.0");
    expect(catalogContract.artifactType).toBe("context-pack-catalog");
    expect(catalogContract.contextAssetMetadataContractPath).toBe("docs/context/context-asset-metadata.contract.json");
    expect(catalogContract.entryRequiredFields).toEqual(requiredCatalogFields);
    expect(catalogContract.entryOptionalFields).toEqual(optionalCatalogFields);
    expect(catalogContract.reviewExpectationsRequiredFieldsWhenPresent).toEqual(["cadence"]);

    expect(sharedMetadataContract.requiredFields).toContain("id");
    expect(sharedMetadataContract.requiredFields).toContain("relatedCodePaths");
    expect(sharedMetadataContract.optionalFields).toContain("reviewExpectations");
    expect(sharedMetadataContract.reviewExpectations.requiredFieldsWhenPresent).toEqual(["cadence"]);
    expect(catalogSeed.packs.length).toBeGreaterThanOrEqual(1);
    const catalogPackIds = catalogSeed.packs.map((entry) => entry.id);
    expect(catalogPackIds).toContain("context-system-foundations");
    expect(catalogPackIds).toContain("repository-overview");
    expect(catalogPackIds).toContain("architecture-core");
    expect(catalogPackIds).toContain("documentation-refactor");
    expect(catalogPackIds).toContain("runtime-and-host");
    expect(catalogPackIds).toContain("identity-and-security");
    expect(catalogPackIds).toContain("studio-and-system-composition");

    const expectedAdrDocsByPackId: Record<string, string[]> = {
      "repository-overview": [
        "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      ],
      "architecture-core": [
        "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      ],
      "runtime-and-host": [
        "docs/adr/records/adr-001-single-authoritative-control-plane.md",
      ],
      "identity-and-security": [
        "docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md",
      ],
      "studio-and-system-composition": [
        "docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md",
      ],
    };

    for (const entry of catalogSeed.packs) {
      for (const requiredField of requiredCatalogFields) {
        expect(entry[requiredField]).toBeDefined();
      }
      const expectedAdrDocs = expectedAdrDocsByPackId[String(entry.id)] ?? [];
      const relatedDocPaths = entry.relatedDocPaths as string[];
      for (const adrDocPath of expectedAdrDocs) {
        expect(relatedDocPaths).toContain(adrDocPath);
      }
    }
  });

  it("keeps human and AI pack specs aligned to required section anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanSpec).toContain(heading);
      expect(aiSpec).toContain(heading);
    }

    expect(humanSpec).toContain("Required Sections");
    expect(aiSpec).toContain("Required Sections");
    expect(humanSpec).toContain("Optional Sections");
    expect(aiSpec).toContain("Optional Sections");
    expect(humanSpec).toContain("Brevity and Signal-To-Noise Rules");
    expect(aiSpec).toContain("Brevity and Signal Rules");
    expect(humanSpec).toContain("Content That Must Not Appear in a Context Pack");
    expect(aiSpec).toContain("Do Not Include");
    expect(humanSpec).toContain("## ADR Citation Conventions");
    expect(aiSpec).toContain("## ADR Citation Conventions");
    expect(humanSpec).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.md");
    expect(aiSpec).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.ai.md");
  });

  it("keeps contract discoverable from context and pack routers", () => {
    const packsReadme = readFileSync(packsReadmePath, "utf8");
    const packsAiReadme = readFileSync(packsAiReadmePath, "utf8");
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");

    expect(packsReadme).toContain("./context-pack.contract.json");
    expect(packsAiReadme).toContain("./context-pack.contract.json");
    expect(packsReadme).toContain("../context-asset-metadata.md");
    expect(packsAiReadme).toContain("../context-asset-metadata.ai.md");
    expect(contextReadme).toContain("./packs/README.md#standard-context-pack-contract");
    expect(contextAiReadme).toContain("./packs/README.ai.md#standard-context-pack-contract");
  });
});
