import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
const seedPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.seed.json");
const metadataContractPath = resolve(repoRoot, "docs/context/context-asset-metadata.contract.json");
const humanSpecPath = resolve(repoRoot, "docs/context/routing/prompt-routing-contract.md");
const aiSpecPath = resolve(repoRoot, "docs/context/routing/prompt-routing-contract.ai.md");
const humanRoutingGuidePath = resolve(repoRoot, "docs/context/prompt-routing.md");
const aiRoutingGuidePath = resolve(repoRoot, "docs/context/prompt-routing.ai.md");
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

const expectedCoreWorkflowTaskIds = [
  "architecture-review-host-boundaries",
  "feature-decomposition-epic-story-planning",
  "repo-implementation-core-workflows",
  "documentation-refactor-context-and-architecture",
  "runtime-host-diagnostics-triage",
  "studio-system-design-and-ux-shaping",
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
  mappings: Array<Record<string, unknown>>;
};

describe("task-to-context routing contract guardrails", () => {
  it("keeps routing contract artifacts present", () => {
    expect(existsSync(contractPath)).toBe(true);
    expect(existsSync(seedPath)).toBe(true);
    expect(existsSync(metadataContractPath)).toBe(true);
    expect(existsSync(humanSpecPath)).toBe(true);
    expect(existsSync(aiSpecPath)).toBe(true);
    expect(existsSync(humanRoutingGuidePath)).toBe(true);
    expect(existsSync(aiRoutingGuidePath)).toBe(true);
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
    expect(seed.mappings.length).toBeGreaterThanOrEqual(expectedCoreWorkflowTaskIds.length);

    for (const entry of seed.taskCategoryMap) {
      expect(entry.defaultIntent.trim().length).toBeGreaterThan(0);
      expect(entry.requiredSignals.length).toBeGreaterThan(0);
    }

    for (const example of seed.routingExamples) {
      expect(expectedTaskCategories).toContain(example.taskCategory as (typeof expectedTaskCategories)[number]);
      expect(typeof example.routingInputs.taskSummary).toBe("string");
      expect(Array.isArray(example.routingInputs.changedPaths)).toBe(true);
    }

    for (const mapping of seed.mappings) {
      for (const field of requiredMappingMetadataFields) {
        expect(mapping[field]).toBeDefined();
      }
    }
  });

  it("keeps core workflow routes explicit and grounded in repository paths", () => {
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as RoutingSeed;
    const mappingByTaskId = new Map(
      seed.mappings.map((mapping) => [mapping.taskId as string, mapping]),
    );

    for (const taskId of expectedCoreWorkflowTaskIds) {
      const mapping = mappingByTaskId.get(taskId);
      expect(mapping).toBeDefined();
      if (!mapping) {
        continue;
      }

      expect(mapping.status).toBe("active");
      expect(mapping.packIds).toEqual(["context-system-foundations"]);
      expect(Array.isArray(mapping.excludePackIds)).toBe(true);
      expect(typeof mapping.notes).toBe("string");
      expect((mapping.notes as string).trim().length).toBeGreaterThan(0);

      const routingInputs = mapping.routingInputs as Record<string, unknown>;
      expect(routingInputs).toBeDefined();
      expect(routingInputs.taskCategory).toBe(mapping.taskCategory);
      expect(Array.isArray(routingInputs.exclusions)).toBe(true);
      expect((routingInputs.exclusions as unknown[]).length).toBeGreaterThanOrEqual(1);

      const changedPaths = routingInputs.changedPaths as string[];
      expect(Array.isArray(changedPaths)).toBe(true);
      expect(changedPaths.length).toBeGreaterThanOrEqual(1);
      for (const changedPath of changedPaths) {
        expect(existsSync(resolve(repoRoot, changedPath))).toBe(true);
      }

      const relatedDocPaths = mapping.relatedDocPaths as string[];
      const relatedCodePaths = mapping.relatedCodePaths as string[];
      expect(Array.isArray(relatedDocPaths)).toBe(true);
      expect(Array.isArray(relatedCodePaths)).toBe(true);
      for (const relatedDocPath of relatedDocPaths) {
        expect(existsSync(resolve(repoRoot, relatedDocPath))).toBe(true);
      }
      for (const relatedCodePath of relatedCodePaths) {
        expect(existsSync(resolve(repoRoot, relatedCodePath))).toBe(true);
      }
    }
  });

  it("keeps routing contract docs discoverable from routing routers", () => {
    const routingReadme = readFileSync(routingReadmePath, "utf8");
    const routingAiReadme = readFileSync(routingAiReadmePath, "utf8");

    expect(routingReadme).toContain("./prompt-routing-contract.md");
    expect(routingAiReadme).toContain("./prompt-routing-contract.ai.md");
    expect(routingReadme).toContain("../prompt-routing.md");
    expect(routingAiReadme).toContain("../prompt-routing.ai.md");
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

  it("keeps human-readable prompt routing guidance aligned with routing assets", () => {
    const humanGuide = readFileSync(humanRoutingGuidePath, "utf8");
    const aiGuide = readFileSync(aiRoutingGuidePath, "utf8");

    for (const heading of [
      "## Canonical Routing Sources",
      "## Deterministic Routing Workflow",
      "## Minimum Sufficient Context Rules",
      "## Signal-to-Noise Guardrails",
      "## Explicit Exclusion Rules by Task Class",
      "## Authoritative vs Related Material Selection",
      "## Task-Type Routing Guidance (AI Loom Repository)",
      "## Ambiguous Task Handling",
      "## Concrete Repository Examples",
    ]) {
      expect(humanGuide).toContain(heading);
      expect(aiGuide).toContain(heading);
    }

    for (const category of expectedTaskCategories) {
      expect(humanGuide).toContain(`\`${category}\``);
      expect(aiGuide).toContain(`\`${category}\``);
    }

    for (const artifactPath of [
      "docs/context/routing/task-to-context-routing.contract.json",
      "docs/context/routing/task-to-context-routing.seed.json",
      "docs/context/context-map.json",
    ]) {
      expect(humanGuide).toContain(artifactPath);
      expect(aiGuide).toContain(artifactPath);
    }

    for (const exclusionPhrase of [
      "stale historical material",
      "unrelated architecture domains",
      "non-authoritative",
      "adjacent workflows",
    ]) {
      expect(humanGuide).toContain(exclusionPhrase);
      expect(aiGuide).toContain(exclusionPhrase);
    }
  });
});
