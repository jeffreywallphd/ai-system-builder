import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const requiredBaselineDirectories = [
  "docs/baselines/architecture",
  "docs/baselines/architecture/core-platform-and-composition",
  "docs/baselines/architecture/runtime-host-surfaces",
  "docs/baselines/architecture/identity-trust-and-security",
  "docs/baselines/architecture/authorization",
  "docs/baselines/architecture/deployment-policy-and-audit-governance",
  "docs/baselines/architecture/execution-control-plane-and-scheduling",
  "docs/baselines/architecture/studio-and-system-composition",
] as const;

const movedBaselinePairs = [
  {
    oldMd: "docs/architecture/authorization-feature-4-final-baseline.md",
    oldAi: "docs/architecture/authorization-feature-4-final-baseline.ai.md",
    newMd: "docs/baselines/architecture/authorization/authorization-feature-4-final-baseline.md",
    newAi: "docs/baselines/architecture/authorization/authorization-feature-4-final-baseline.ai.md",
  },
  {
    oldMd: "docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md",
    oldAi: "docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.ai.md",
    newMd: "docs/baselines/architecture/deployment-policy-and-audit-governance/deployment-profile-policy-persistence-api-integration-baseline.md",
    newAi: "docs/baselines/architecture/deployment-policy-and-audit-governance/deployment-profile-policy-persistence-api-integration-baseline.ai.md",
  },
  {
    oldMd: "docs/architecture/image-run-feature-4-final-baseline.md",
    oldAi: "docs/architecture/image-run-feature-4-final-baseline.ai.md",
    newMd: "docs/baselines/architecture/execution-control-plane-and-scheduling/image-run-feature-4-final-baseline.md",
    newAi: "docs/baselines/architecture/execution-control-plane-and-scheduling/image-run-feature-4-final-baseline.ai.md",
  },
  {
    oldMd: "docs/architecture/image-workflow-feature-2-final-baseline.md",
    oldAi: "docs/architecture/image-workflow-feature-2-final-baseline.ai.md",
    newMd: "docs/baselines/architecture/studio-and-system-composition/image-workflow-feature-2-final-baseline.md",
    newAi: "docs/baselines/architecture/studio-and-system-composition/image-workflow-feature-2-final-baseline.ai.md",
  },
  {
    oldMd: "docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md",
    oldAi: "docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.ai.md",
    newMd: "docs/baselines/architecture/studio-and-system-composition/image-manipulation-feature-8-final-vertical-slice-completion.md",
    newAi: "docs/baselines/architecture/studio-and-system-composition/image-manipulation-feature-8-final-vertical-slice-completion.ai.md",
  },
] as const;

describe("documentation baselines structure and initial destinations guardrails", () => {
  it("creates a practical architecture baseline destination structure", () => {
    for (const directory of requiredBaselineDirectories) {
      expect(existsSync(resolve(repoRoot, directory))).toBe(true);
    }
  });

  it("keeps architecture baseline routers discoverable from baselines root", () => {
    const architectureRouter = readFileSync(resolve(repoRoot, "docs/baselines/architecture/README.md"), "utf8");
    const architectureRouterAi = readFileSync(
      resolve(repoRoot, "docs/baselines/architecture/README.ai.md"),
      "utf8",
    );
    const baselinesRoot = readFileSync(resolve(repoRoot, "docs/baselines/README.md"), "utf8");
    const baselinesRootAi = readFileSync(resolve(repoRoot, "docs/baselines/README.ai.md"), "utf8");

    expect(architectureRouter).toContain("## Start Here");
    expect(architectureRouterAi).toContain("## Start Here");
    expect(baselinesRoot).toContain("./architecture/README.md");
    expect(baselinesRootAi).toContain("./architecture/README.ai.md");
  });

  it("moves initial baseline candidates into baselines destinations and keeps old architecture paths as stubs", () => {
    for (const pair of movedBaselinePairs) {
      expect(existsSync(resolve(repoRoot, pair.newMd))).toBe(true);
      expect(existsSync(resolve(repoRoot, pair.newAi))).toBe(true);
      expect(existsSync(resolve(repoRoot, pair.oldMd))).toBe(true);
      expect(existsSync(resolve(repoRoot, pair.oldAi))).toBe(true);

      const oldMd = readFileSync(resolve(repoRoot, pair.oldMd), "utf8");
      const oldAi = readFileSync(resolve(repoRoot, pair.oldAi), "utf8");

      expect(oldMd).toContain("status: superseded");
      expect(oldAi).toContain("status: superseded");
      expect(oldMd).toContain("## Supersession Notice");
      expect(oldAi).toContain("## Supersession Notice");
      expect(oldMd).toContain("migrated-link-stub");
      expect(oldAi).toContain("migrated-link-stub");
      expect(oldMd).toContain(pair.newMd);
      expect(oldAi).toContain(pair.newAi);
    }
  });
});
