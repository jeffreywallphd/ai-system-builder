import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const handoffMdPath = resolve(repoRoot, "docs/baselines/feature-1-documentation-foundation-handoff.md");
const handoffAiPath = resolve(repoRoot, "docs/baselines/feature-1-documentation-foundation-handoff.ai.md");
const baselinesReadmePath = resolve(repoRoot, "docs/baselines/README.md");
const baselinesAiReadmePath = resolve(repoRoot, "docs/baselines/README.ai.md");

describe("documentation foundation completion handoff guardrails", () => {
  it("keeps feature 1 handoff docs present and routed from baselines", () => {
    expect(existsSync(handoffMdPath)).toBe(true);
    expect(existsSync(handoffAiPath)).toBe(true);

    const baselinesReadme = readFileSync(baselinesReadmePath, "utf8");
    const baselinesAiReadme = readFileSync(baselinesAiReadmePath, "utf8");

    expect(baselinesReadme).toContain("./feature-1-documentation-foundation-handoff.md");
    expect(baselinesAiReadme).toContain("./feature-1-documentation-foundation-handoff.ai.md");
  });

  it("documents implemented baseline guarantees and deferred next-phase work", () => {
    const handoff = readFileSync(handoffMdPath, "utf8");
    const handoffAi = readFileSync(handoffAiPath, "utf8");

    const requiredMdAnchors = [
      "## What Feature 1 Now Guarantees",
      "## Seed Documents and Foundation Artifacts Updated",
      "## Validation and Guardrails in Force",
      "## Deferred for Later Features",
      "## Next-Phase Build Assumptions",
    ] as const;

    for (const anchor of requiredMdAnchors) {
      expect(handoff).toContain(anchor);
    }

    const requiredDeferredTopics = [
      "Context routing",
      "ADR population",
      "Architecture domainization",
      "Findability indexing",
      "Stronger linting",
    ] as const;

    for (const topic of requiredDeferredTopics) {
      expect(handoff).toContain(topic);
      expect(handoffAi).toContain(topic);
    }

    expect(handoff).toContain("npm run docs:validate:foundation");
    expect(handoff).toContain("dev/scripts/validate-docs-foundation.cjs");
    expect(handoff).toContain("docs/context/documentation-taxonomy.contract.json");
    expect(handoff).toContain("docs/context/documentation-metadata-header.contract.json");
    expect(handoff).toContain("docs/documentation-migration-baseline.inventory.json");
  });
});

