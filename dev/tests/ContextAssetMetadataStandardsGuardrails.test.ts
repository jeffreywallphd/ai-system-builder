import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const metadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/context-asset-metadata.md");
const aiSpecPath = resolve(repoRoot, "docs/context/context-asset-metadata.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");

const requiredFields = [
  "id",
  "title",
  "purpose",
  "domain",
  "owner",
  "status",
  "relatedDocPaths",
  "relatedCodePaths",
] as const;

const optionalFields = [
  "tags",
  "notes",
  "reviewExpectations",
] as const;

type ContextAssetMetadataContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  requiredFields: string[];
  optionalFields: string[];
  reviewExpectations: {
    requiredFieldsWhenPresent: string[];
    optionalFields: string[];
    allowedCadenceValues: string[];
  };
  assetTypeRequirements: Record<string, {
    requiredFields: string[];
    optionalFields: string[];
  }>;
  crossFieldRules: Array<{ id: string; description: string }>;
};

describe("context asset metadata standard guardrails", () => {
  it("keeps metadata standard artifacts present", () => {
    expect(existsSync(metadataContractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("keeps required vs optional metadata fields explicit", () => {
    const contract = JSON.parse(readFileSync(metadataContractPath, "utf8")) as ContextAssetMetadataContract;

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("context-asset-metadata-standard");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/context-asset-metadata.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/context-asset-metadata.ai.md");
    expect(contract.requiredFields).toEqual(requiredFields);
    expect(contract.optionalFields).toEqual(optionalFields);

    expect(contract.reviewExpectations.requiredFieldsWhenPresent).toEqual(["cadence"]);
    expect(contract.reviewExpectations.optionalFields).toContain("lastReviewed");
    expect(contract.reviewExpectations.allowedCadenceValues).toContain("per-epic-milestone");

    for (const requirement of Object.values(contract.assetTypeRequirements)) {
      expect(requirement.requiredFields).toEqual(requiredFields);
      expect(requirement.optionalFields.length).toBeGreaterThanOrEqual(2);
    }

    const ruleIds = new Set(contract.crossFieldRules.map((rule) => rule.id));
    expect(ruleIds.has("metadata-id-stable-after-publication")).toBe(true);
    expect(ruleIds.has("metadata-status-must-use-parent-contract-enum")).toBe(true);
    expect(ruleIds.has("metadata-review-expectations-requires-cadence")).toBe(true);
  });

  it("keeps metadata standard discoverable from the context router", () => {
    const contextReadme = readFileSync(contextReadmePath, "utf8");
    const contextAiReadme = readFileSync(contextAiReadmePath, "utf8");

    expect(contextReadme).toContain("./context-asset-metadata.md");
    expect(contextAiReadme).toContain("./context-asset-metadata.ai.md");
  });

  it("keeps human and AI specs aligned to mandatory field anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    for (const anchor of [...requiredFields, ...optionalFields, "reviewExpectations", "cadence"]) {
      expect(humanSpec).toContain(anchor);
      expect(aiSpec).toContain(anchor);
    }
  });
});
