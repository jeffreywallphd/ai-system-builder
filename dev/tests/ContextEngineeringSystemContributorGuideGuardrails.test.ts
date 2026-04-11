import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const guidePath = resolve(repoRoot, "docs/contributors/context-engineering-system-guide.md");
const guideAiPath = resolve(repoRoot, "docs/contributors/context-engineering-system-guide.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");
const routingReadmePath = resolve(repoRoot, "docs/context/routing/README.md");
const routingAiReadmePath = resolve(repoRoot, "docs/context/routing/README.ai.md");

const requiredHeadings = [
  "## Canonical Sources",
  "## Routing Workflow",
  "## When To Use Context Packs",
  "## How To Avoid Over-Contexting",
  "## Task Playbooks",
  "## Example Prompt Assembly Workflows",
  "## Extending the System Responsibly",
  "## Validation Checklist Before Merge",
] as const;

const requiredTaskPlaybookLabels = [
  "### Prompt Preparation",
  "### Feature Decomposition",
  "### Implementation Tasks",
  "### Reviews (Code or Design)",
] as const;

const requiredExampleWorkflowLabels = [
  "### Workflow 1: Feature Decomposition Prompt",
  "### Workflow 2: Implementation Prompt",
  "### Workflow 3: Architecture Review Prompt",
  "### Workflow 4: Documentation Refactor Prompt",
] as const;

const requiredExampleWorkflowTaskIds = [
  "feature-decomposition-epic-story-planning",
  "runtime-host-coding-implementation",
  "architecture-review-host-boundaries",
  "documentation-refactor-context-and-architecture",
] as const;

const requiredRoutingFields = [
  "taskSummary",
  "taskCategory",
  "requestedOutcomes",
  "changedPaths",
  "constraints",
] as const;

const requiredTaskCategories = [
  "architecture-review",
  "feature-decomposition",
  "coding-implementation",
  "migration-refactor",
  "diagnostics",
  "ui-studio",
  "runtime-security",
  "documentation-change",
] as const;

const requiredPackContractHeadings = [
  "## Purpose",
  "## When To Use",
  "## When Not To Use",
  "## Invariants",
  "## Authoritative Docs",
  "## Authoritative Code Paths",
  "## Anti-Patterns",
  "## Related Packs",
] as const;

describe("context engineering system contributor guide guardrails", () => {
  it("keeps contributor guidance docs present and discoverable from routers", () => {
    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(guideAiPath)).toBe(true);

    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");
    const routingReadme = readFileSync(routingReadmePath, "utf8");
    const routingAiReadme = readFileSync(routingAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./context-engineering-system-guide.md");
    expect(contributorsAiReadme).toContain("./context-engineering-system-guide.ai.md");
    expect(routingReadme).toContain("../../contributors/context-engineering-system-guide.md");
    expect(routingAiReadme).toContain("../../contributors/context-engineering-system-guide.ai.md");
  });

  it("keeps guidance practical for prompts, decomposition, implementation, and reviews", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(guide).toContain(heading);
      expect(guideAi).toContain(heading);
    }

    for (const label of requiredTaskPlaybookLabels) {
      expect(guide).toContain(label);
      expect(guideAi).toContain(label);
    }

    for (const label of requiredExampleWorkflowLabels) {
      expect(guide).toContain(label);
      expect(guideAi).toContain(label);
    }
  });

  it("keeps example workflows aligned with routing IDs and context principles", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const taskId of requiredExampleWorkflowTaskIds) {
      expect(guide).toContain(`\`taskId\`: \`${taskId}\``);
      expect(guideAi).toContain(`\`taskId\`: \`${taskId}\``);
    }

    for (const packId of [
      "repository-overview",
      "architecture-core",
      "context-system-foundations",
      "runtime-and-host",
      "documentation-refactor",
    ]) {
      expect(guide).toContain(`\`${packId}\``);
      expect(guideAi).toContain(`\`${packId}\``);
    }

    for (const phrase of [
      "Minimum sufficient context",
      "Authoritative docs",
      "Prompt scaffold",
    ]) {
      expect(guide).toContain(phrase);
      expect(guideAi).toContain(phrase);
    }
  });

  it("keeps routing and pack-contract alignment explicit", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const field of requiredRoutingFields) {
      expect(guide).toContain(field);
      expect(guideAi).toContain(field);
    }

    for (const category of requiredTaskCategories) {
      expect(guide).toContain(`\`${category}\``);
      expect(guideAi).toContain(`\`${category}\``);
    }

    for (const heading of requiredPackContractHeadings) {
      expect(guide).toContain(heading);
      expect(guideAi).toContain(heading);
    }

    for (const path of [
      "docs/context/routing/task-to-context-routing.contract.json",
      "docs/context/routing/task-to-context-routing.seed.json",
      "docs/context/context-map.json",
      "docs/context/packs/context-pack.contract.json",
      "docs/context/packs/context-pack-catalog.seed.json",
      "npm run docs:validate:foundation",
    ]) {
      expect(guide).toContain(path);
      expect(guideAi).toContain(path);
    }
  });
});
