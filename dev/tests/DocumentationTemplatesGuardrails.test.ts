import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const templatesDir = resolve(repoRoot, "docs/context/templates");
const templatesReadmePath = resolve(templatesDir, "README.md");
const templatesAiReadmePath = resolve(templatesDir, "README.ai.md");
const contextReadmePath = resolve(repoRoot, "docs/context/README.md");
const contextAiReadmePath = resolve(repoRoot, "docs/context/README.ai.md");
const placementGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const routingReadmePath = resolve(repoRoot, "docs/context/routing/README.md");
const routingAiReadmePath = resolve(repoRoot, "docs/context/routing/README.ai.md");
const routingContractPath = resolve(repoRoot, "docs/context/routing/task-to-context-routing.contract.json");
const routingEntryTemplatePath = resolve(templatesDir, "task-to-context-routing-entry.template.json");

const requiredFrontmatterFields = [
  "title",
  "doc_type",
  "status",
  "authoritativeness",
  "owned_by",
  "last_reviewed",
] as const;

const requiredTemplates = [
  {
    fileName: "architecture-overview.template.md",
    docType: "architecture-overview",
    requiredSections: [
      "## Scope and System Boundary",
      "## Canonical Components and Responsibilities",
      "## Cross-Cutting Invariants",
    ],
  },
  {
    fileName: "architecture-reference.template.md",
    docType: "architecture-reference",
    requiredSections: [
      "## Context and Scope",
      "## Contracts and Interfaces",
      "## Extension Guardrails",
    ],
  },
  {
    fileName: "contributor-guide.template.md",
    docType: "contributor-guide",
    requiredSections: [
      "## Purpose and Audience",
      "## Implementation Workflow",
      "## Validation and Tests",
    ],
  },
  {
    fileName: "runbook.template.md",
    docType: "runbook",
    requiredSections: [
      "## Purpose and Operational Scope",
      "## Procedure",
      "## Rollback and Recovery",
    ],
  },
  {
    fileName: "baseline.template.md",
    docType: "baseline",
    requiredSections: [
      "## Snapshot Scope and Date",
      "## Included Artifacts",
      "## Successor or Follow-Up Links",
    ],
  },
  {
    fileName: "adr.template.md",
    docType: "adr",
    requiredSections: [
      "## Required Sections",
      "## Optional Sections",
      "## Status",
      "## Decision Date",
      "## Decision Statement",
      "## Context and Problem Statement",
      "## Decision Drivers",
      "## Considered Options",
      "## Chosen Approach",
      "## Consequences",
      "## Related Documentation",
      "## Related Code Paths",
    ],
  },
  {
    fileName: "ai-context.template.md",
    docType: "ai-context",
    requiredSections: [
      "## Purpose and Audience",
      "## Canonical Vocabulary",
      "## Retrieval and Routing Guidance",
    ],
  },
  {
    fileName: "context-pack.template.md",
    docType: "ai-context",
    requiredSections: [
      "## Purpose",
      "## When To Use",
      "## Authoritative Docs",
    ],
  },
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("documentation templates guardrails", () => {
  it("keeps template router docs present", () => {
    expect(existsSync(templatesReadmePath)).toBe(true);
    expect(existsSync(templatesAiReadmePath)).toBe(true);
  });

  it("enforces required templates for each core document type", () => {
    for (const template of requiredTemplates) {
      const path = resolve(templatesDir, template.fileName);
      const aiPath = path.replace(/\.md$/, ".ai.md");
      expect(existsSync(path)).toBe(true);
      expect(existsSync(aiPath)).toBe(true);
    }

    expect(existsSync(routingEntryTemplatePath)).toBe(true);
  });

  it("requires metadata header anchors and section guidance in every template", () => {
    for (const template of requiredTemplates) {
      const content = read(resolve(templatesDir, template.fileName));

      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toContain(`doc_type: ${template.docType}`);

      for (const field of requiredFrontmatterFields) {
        expect(content).toMatch(new RegExp(`^${field}:\\s+.+$`, "m"));
      }

      for (const section of template.requiredSections) {
        expect(content).toContain(section);
      }
    }
  });

  it("keeps ADR template metadata and supersession guidance explicit", () => {
    const adrTemplate = read(resolve(templatesDir, "adr.template.md"));
    const adrTemplateAi = read(resolve(templatesDir, "adr.template.ai.md"));

    for (const content of [adrTemplate, adrTemplateAi]) {
      expect(content).toMatch(/^decision_date:\s+<YYYY-MM-DD>$/m);
      expect(content).toContain("## Supersession");
      expect(content).toContain("Superseded By");
      expect(content).toContain("## Follow-Up Actions");
    }
  });

  it("keeps template location discoverable from context and placement docs", () => {
    const templatesReadme = read(templatesReadmePath);
    const templatesAiReadme = read(templatesAiReadmePath);
    const contextReadme = read(contextReadmePath);
    const contextAiReadme = read(contextAiReadmePath);
    const placementGuide = read(placementGuidePath);
    const routingReadme = read(routingReadmePath);
    const routingAiReadme = read(routingAiReadmePath);

    expect(contextReadme).toContain("./templates/README.md");
    expect(contextAiReadme).toContain("./templates/README.ai.md");
    expect(placementGuide).toContain("docs/context/templates/README.md");
    expect(routingReadme).toContain("../templates/task-to-context-routing-entry.template.json");
    expect(routingAiReadme).toContain("../templates/task-to-context-routing-entry.template.json");

    for (const template of requiredTemplates) {
      expect(templatesReadme).toContain(template.fileName);
      expect(templatesAiReadme).toContain(template.fileName);
    }

    expect(templatesReadme).toContain("task-to-context-routing-entry.template.json");
    expect(templatesAiReadme).toContain("task-to-context-routing-entry.template.json");
  });

  it("keeps routing entry template parseable and aligned to contract-required fields", () => {
    const routingTemplate = JSON.parse(read(routingEntryTemplatePath)) as Record<string, unknown>;
    const routingContract = JSON.parse(read(routingContractPath)) as {
      mappingRequiredFields: string[];
      routingRequestRequiredFields: string[];
    };

    for (const field of routingContract.mappingRequiredFields) {
      expect(routingTemplate[field]).toBeDefined();
    }

    const routingInputs = routingTemplate.routingInputs as Record<string, unknown>;
    for (const field of routingContract.routingRequestRequiredFields) {
      expect(routingInputs[field]).toBeDefined();
    }
  });
});
