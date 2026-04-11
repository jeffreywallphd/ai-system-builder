import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const guidePath = resolve(
  repoRoot,
  "docs/contributors/architecture-domain-navigation-worked-examples.md",
);
const guideAiPath = resolve(
  repoRoot,
  "docs/contributors/architecture-domain-navigation-worked-examples.ai.md",
);
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsReadmeAiPath = resolve(repoRoot, "docs/contributors/README.ai.md");
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureReadmeAiPath = resolve(repoRoot, "docs/architecture/README.ai.md");

describe("architecture domain navigation worked examples guardrails", () => {
  it("keeps human and AI worked examples guides present and routed", () => {
    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(guideAiPath)).toBe(true);

    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsReadmeAi = readFileSync(contributorsReadmeAiPath, "utf8");
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(contributorsReadme).toContain(
      "./architecture-domain-navigation-worked-examples.md",
    );
    expect(contributorsReadmeAi).toContain(
      "./architecture-domain-navigation-worked-examples.ai.md",
    );
    expect(architectureReadme).toContain(
      "../contributors/architecture-domain-navigation-worked-examples.md",
    );
    expect(architectureReadmeAi).toContain(
      "../contributors/architecture-domain-navigation-worked-examples.ai.md",
    );
  });

  it("keeps five representative task examples that reinforce domainized routing", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");

    for (const heading of [
      "## Scope",
      "## How To Use These Worked Examples",
      "## Example 1: Architecture Review for Run Submission and Scheduling Changes",
      "## Example 2: Feature Decomposition for Asset-Backed Workflow Authoring",
      "## Example 3: Runtime Diagnostics for Desktop Host Startup and API Failures",
      "## Example 4: Security-Sensitive Change for Secret-Backed Run Submission",
      "## Example 5: Documentation Refactor from Flat Architecture Docs into Domain Folders",
      "## Fast Routing Pattern",
      "## Related Documentation",
    ] as const) {
      expect(guide).toContain(heading);
      expect(guideAi).toContain(heading);
    }

    for (const signal of [
      "overview.md",
      "references/README.md",
      "contract reference docs",
      "execution-control-plane-and-scheduling",
      "studio-and-system-composition",
      "runtime-host-surfaces",
      "identity-trust-and-security",
      "architecture-domain-taxonomy",
      "docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution",
      "docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement",
      "src/application/runs",
      "src/ui/services",
      "src/hosts",
      "linked, not duplicated",
      "Keep `.md` and `.ai.md` companion docs aligned.",
    ] as const) {
      expect(guide).toContain(signal);
      expect(guideAi).toContain(signal);
    }
  });
});
