import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const guidePath = resolve(
  repoRoot,
  "docs/contributors/adr-informed-implementation-and-review-examples.md",
);
const guideAiPath = resolve(
  repoRoot,
  "docs/contributors/adr-informed-implementation-and-review-examples.ai.md",
);
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsReadmeAiPath = resolve(repoRoot, "docs/contributors/README.ai.md");
const adrReadmePath = resolve(repoRoot, "docs/adr/README.md");
const adrReadmeAiPath = resolve(repoRoot, "docs/adr/README.ai.md");

const requiredHeadings = [
  "## Settled Decisions vs Open Implementation Details",
  "## Example 1: Implementation Prompt (Run Scheduling Change)",
  "## Example 2: Review Checklist (Storage Shortcut Proposal)",
  "## Example 3: Refactor Plan (Host Startup Simplification)",
  "## Example 4: Design Discussion (Studio-Specific Data Model Request)",
  "## Routine vs Heightened ADR Review Lanes",
  "## Quick ADR Gate Before Merge",
] as const;

describe("ADR-informed implementation and review examples guardrails", () => {
  it("keeps human and AI example guides present and routed", () => {
    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(guideAiPath)).toBe(true);

    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsReadmeAi = readFileSync(contributorsReadmeAiPath, "utf8");
    const adrReadme = readFileSync(adrReadmePath, "utf8");
    const adrReadmeAi = readFileSync(adrReadmeAiPath, "utf8");

    expect(contributorsReadme).toContain(
      "./adr-informed-implementation-and-review-examples.md",
    );
    expect(contributorsReadmeAi).toContain(
      "./adr-informed-implementation-and-review-examples.ai.md",
    );
    expect(adrReadme).toContain(
      "../contributors/adr-informed-implementation-and-review-examples.md",
    );
    expect(adrReadmeAi).toContain(
      "../contributors/adr-informed-implementation-and-review-examples.ai.md",
    );
  });

  it("keeps examples practical and explicit about settled vs open decisions", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(guide).toContain(heading);
      expect(guideAi).toContain(heading);
    }

    for (const phrase of [
      "Settled Decision",
      "Open Implementation Details",
      "Do Not Re-Decide In Story Work",
      "unless proposing a new ADR",
      "review comments distinguish settled decisions from open implementation details",
      "review_tier",
      "heightened",
      "broader architecture review",
    ]) {
      expect(guide.toLowerCase()).toContain(phrase.toLowerCase());
      expect(guideAi.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it("keeps examples grounded in core AI Loom architecture decisions and paths", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const phrase of [
      "adr-001-single-authoritative-control-plane",
      "adr-003-storage-as-managed-platform-resource",
      "adr-004-studios-as-views-over-shared-system-and-asset-model",
      "adr-006-policy-aware-scheduling-and-controlled-execution",
      "src/application/runs",
      "src/ui/services",
      "src/hosts",
      "electron/main",
      "dev/tests/HostCompositionArchitectureGuardrails.test.ts",
    ]) {
      expect(guide).toContain(phrase);
      expect(guideAi).toContain(phrase);
    }
  });
});
