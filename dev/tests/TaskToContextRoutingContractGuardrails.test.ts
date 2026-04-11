import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
const seedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");
const metadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/routing/prompt-routing-contract.md");
const aiSpecPath = resolve(repoRoot, "docs/context/routing/prompt-routing-contract.ai.md");
const routingReadmePath = resolve(repoRoot, "docs/context/routing/README.md");
const routingAiReadmePath = resolve(repoRoot, "docs/context/routing/README.ai.md");

const expectedTaskCategories = [
  "architecture-review",
  "feature-decomposition",
  "coding-implementation",
  "migration-refactor",
  "diagnostics",
  "ui-studio",
  "runtime-security",
  "documentation-change",
] as const;

const expectedRoutingRequestFields = [
  "taskSummary",
  "taskCategory",
  "requestedOutcomes",
  "changedPaths",
  "constraints",
] as const;

const expectedPriorityTiers = [
  "critical",
  "high",
  "normal",
  "low",
] as const;

const requiredMappingMetadataFields = [
  "id",
  "title",
  "purpose",
  "domain",
  "owner",
  "status",
  "relatedDocPaths",
  "relatedCodePaths",
] as const;

type RoutingCategory = {
  id: string;
  displayName: string;
  defaultSelectionMode: string;
  defaultPriorityTier: string;
};

type RoutingContract = {
  schemaVersion: string;
  artifactType: string;
  canonicalHumanSpecPath: string;
  canonicalAiSpecPath: string;
  routingRequestRequiredFields: string[];
  supportedTaskCategories: RoutingCategory[];
  mappingRequiredFields: string[];
  mappingOptionalFields: string[];
  priorityTiers: string[];
  contextAssetMetadataContractPath: string;
  reviewExpectationsRequiredFieldsWhenPresent: string[];
};

type RoutingSeed = {
  schemaVersion: string;
  artifactType: string;
  taskCategoryMap: Array<{
    taskCategory: string;
    defaultIntent: string;
    requiredSignals: string[];
  }>;
  routingExamples: Array<{
    taskId: string;
    taskCategory: string;
    routingInputs: Record<string, unknown>;
  }>;
  mappings: unknown[];
};

describe("task-to-context routing contract guardrails", () => {
  it("keeps routing contract artifacts present", () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(seedPath)).toBe(true);
    expect(existsSync(metadataContractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
  });

  it("keeps task categories, inputs, and priorities explicit in the contract", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8")) as RoutingContract;

    expect(contract.schemaVersion).toBe("1.0.0");
    expect(contract.artifactType).toBe("task-to-context-routing-map");
    expect(contract.canonicalHumanSpecPath).toBe("docs/context/routing/prompt-routing-contract.md");
    expect(contract.canonicalAiSpecPath).toBe("docs/context/routing/prompt-routing-contract.ai.md");
    expect(contract.routingRequestRequiredFields).toEqual(expectedRoutingRequestFields);
    expect(contract.priorityTiers).toEqual(expectedPriorityTiers);
    expect(contract.mappingRequiredFields).toContain("taskCategory");
    expect(contract.mappingRequiredFields).toContain("routingInputs");
    expect(contract.mappingRequiredFields).toContain("priorityTier");
    expect(contract.mappingOptionalFields).toContain("reviewExpectations");
    expect(contract.contextAssetMetadataContractPath).toBe("docs/context/context-asset-metadata.contract.json");
    expect(contract.reviewExpectationsRequiredFieldsWhenPresent).toEqual(["cadence"]);
    for (const field of requiredMappingMetadataFields) {
      expect(contract.mappingRequiredFields).toContain(field);
    }
    expect(contract.supportedTaskCategories.map((category) => category.id)).toEqual(expectedTaskCategories);
  });

  it("keeps seed category map aligned with contract categories", () => {
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as RoutingSeed;

    expect(seed.schemaVersion).toBe("1.0.0");
    expect(seed.artifactType).toBe("task-to-context-routing-map");
    expect(Array.isArray(seed.mappings)).toBe(true);
    expect(seed.taskCategoryMap.map((entry) => entry.taskCategory)).toEqual(expectedTaskCategories);
    expect(seed.routingExamples.length).toBeGreaterThanOrEqual(2);
    expect(seed.mappings.length).toBeGreaterThanOrEqual(1);

    for (const entry of seed.taskCategoryMap) {
      expect(entry.defaultIntent.trim().length).toBeGreaterThan(0);
      expect(entry.requiredSignals.length).toBeGreaterThan(0);
    }

    for (const example of seed.routingExamples) {
      expect(expectedTaskCategories).toContain(example.taskCategory as (typeof expectedTaskCategories)[number]);
      expect(typeof example.routingInputs.taskSummary).toBe("string");
      expect(Array.isArray(example.routingInputs.changedPaths)).toBe(true);
    }

    for (const mapping of seed.mappings as Array<Record<string, unknown>>) {
      for (const field of requiredMappingMetadataFields) {
        expect(mapping[field]).toBeDefined();
      }
    }
  });

  it("keeps routing contract docs discoverable from routing routers", () => {
    const routingReadme = readFileSync(routingReadmePath, "utf8");
    const routingAiReadme = readFileSync(routingAiReadmePath, "utf8");

    expect(routingReadme).toContain("./prompt-routing-contract.md");
    expect(routingAiReadme).toContain("./prompt-routing-contract.ai.md");
    expect(routingReadme).toContain("../context-asset-metadata.md");
    expect(routingAiReadme).toContain("../context-asset-metadata.ai.md");
  });

  it("keeps human and AI routing specs aligned to core section anchors", () => {
    const humanSpec = readFileSync(humanSpecPath, "utf8");
    const aiSpec = readFileSync(aiSpecPath, "utf8");

    for (const heading of [
      "## Routing Inputs Contract",
      "## Supported Task Categories",
      "## Pack Selection Rules",
      "## Exclusion Rules",
      "## Priority and Fallback Behavior",
      "## Mapping Authoring Rules",
    ]) {
      expect(humanSpec).toContain(heading);
      expect(aiSpec).toContain(heading);
    }

    for (const field of requiredMappingMetadataFields) {
      expect(humanSpec).toContain(field);
      expect(aiSpec).toContain(field);
    }
  });
});
