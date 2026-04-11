import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const migratedStoryPairs = [
  {
    oldMd: "docs/architecture/entrypoint-host-composition-migration-12.4.1.md",
    oldAi: "docs/architecture/entrypoint-host-composition-migration-12.4.1.ai.md",
    newMd: "docs/baselines/architecture/runtime-host-surfaces/entrypoint-host-composition-migration-12.4.1.md",
    newAi: "docs/baselines/architecture/runtime-host-surfaces/entrypoint-host-composition-migration-12.4.1.ai.md",
  },
  {
    oldMd: "docs/architecture/development-host-startup-model-12.4.2.md",
    oldAi: "docs/architecture/development-host-startup-model-12.4.2.ai.md",
    newMd: "docs/baselines/architecture/runtime-host-surfaces/development-host-startup-model-12.4.2.md",
    newAi: "docs/baselines/architecture/runtime-host-surfaces/development-host-startup-model-12.4.2.ai.md",
  },
  {
    oldMd: "docs/architecture/host-composition-extension-guardrails-12.4.3.md",
    oldAi: "docs/architecture/host-composition-extension-guardrails-12.4.3.ai.md",
    newMd: "docs/baselines/architecture/runtime-host-surfaces/host-composition-extension-guardrails-12.4.3.md",
    newAi: "docs/baselines/architecture/runtime-host-surfaces/host-composition-extension-guardrails-12.4.3.ai.md",
  },
] as const;

describe("story 5.2.4 superseded redirect guardrails", () => {
  it("moves high-value runtime-host migration docs to baselines and keeps old paths as superseded stubs", () => {
    for (const pair of migratedStoryPairs) {
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
      expect(oldMd).toContain("## Redirect");
      expect(oldAi).toContain("## Redirect");
      expect(oldMd).toContain("migrated-link-stub");
      expect(oldAi).toContain("migrated-link-stub");
      expect(oldMd).toContain("Effective date:");
      expect(oldAi).toContain("Effective date:");
      expect(oldMd).toContain("Retention/removal trigger:");
      expect(oldAi).toContain("Retention/removal trigger:");
      expect(oldMd).toContain(pair.newMd);
      expect(oldAi).toContain(pair.newAi);
    }
  });

  it("keeps runtime-host migration baselines discoverable from baseline routers", () => {
    const baselinesRoot = readFileSync(resolve(repoRoot, "docs/baselines/README.md"), "utf8");
    const baselinesRootAi = readFileSync(resolve(repoRoot, "docs/baselines/README.ai.md"), "utf8");
    const architectureBaselines = readFileSync(
      resolve(repoRoot, "docs/baselines/architecture/README.md"),
      "utf8",
    );
    const architectureBaselinesAi = readFileSync(
      resolve(repoRoot, "docs/baselines/architecture/README.ai.md"),
      "utf8",
    );

    for (const pair of migratedStoryPairs) {
      expect(baselinesRoot).toContain(pair.newMd.replace("docs/baselines/", "./"));
      expect(baselinesRootAi).toContain(pair.newAi.replace("docs/baselines/", "./"));
      expect(architectureBaselines).toContain(pair.newMd.replace("docs/baselines/architecture/", "./"));
      expect(architectureBaselinesAi).toContain(
        pair.newAi.replace("docs/baselines/architecture/", "./"),
      );
    }
  });

  it("adds story 5.2.4 legacy stub coverage to architecture supersession registry", () => {
    const registry = JSON.parse(
      readFileSync(resolve(repoRoot, "docs/architecture/architecture-supersession-registry.json"), "utf8"),
    );
    const supersededSources = new Set(
      registry.supersededDocuments.map((entry: { sourcePath: string }) => entry.sourcePath),
    );

    for (const sourcePath of [
      "docs/architecture/entrypoint-host-composition-migration-12.4.1.md",
      "docs/architecture/development-host-startup-model-12.4.2.md",
      "docs/architecture/host-composition-extension-guardrails-12.4.3.md",
    ] as const) {
      expect(supersededSources.has(sourcePath)).toBe(true);
    }
  });
});
