import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("high-value mixed document split guardrails", () => {
  it("keeps historical baseline artifacts present for the highest-value mixed docs", () => {
    const expectedBaselineArtifacts = [
      "docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.md",
      "docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md",
      "docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md",
      "docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.ai.md",
      "docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md",
      "docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.ai.md",
    ] as const;

    for (const path of expectedBaselineArtifacts) {
      expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }
  });

  it("keeps active docs focused on authority and linked to isolated history", () => {
    const activeDomain = read("docs/architecture/domain-and-application-core.md");
    const activeDomainAi = read("docs/architecture/domain-and-application-core.ai.md");
    const activeRuntime = read("docs/architecture/desktop-runtime-and-hosts.md");
    const activeRuntimeAi = read("docs/architecture/desktop-runtime-and-hosts.ai.md");
    const activeOffline = read("docs/architecture/offline-local-mode-authority-boundaries.md");
    const activeOfflineAi = read("docs/architecture/offline-local-mode-authority-boundaries.ai.md");

    for (const doc of [activeDomain, activeDomainAi]) {
      expect(doc).toContain("## Active Authority Scope");
      expect(doc).toContain("## Historical Material");
      expect(doc).toContain(
        "docs/baselines/architecture/core-platform-and-composition/domain-and-application-core-historical-evolution",
      );
      expect(doc).not.toContain("## Direction 3 update");
    }

    for (const doc of [activeRuntime, activeRuntimeAi]) {
      expect(doc).toContain("## Active Authority Scope");
      expect(doc).toContain("## Historical Material");
      expect(doc).toContain(
        "docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution",
      );
      expect(doc).not.toContain("## AI Loom image manipulation update:");
    }

    for (const doc of [activeOffline, activeOfflineAi]) {
      expect(doc).toContain("## Active Authority Scope");
      expect(doc).toContain("## Historical Material");
      expect(doc).toContain(
        "docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution",
      );
      expect(doc).not.toContain("## Desktop cache and controlled resynchronization workflow map");
    }
  });

  it("keeps baseline routers linking to the newly isolated high-value history docs", () => {
    const architectureBaselines = read("docs/baselines/architecture/README.md");
    const architectureBaselinesAi = read("docs/baselines/architecture/README.ai.md");
    const baselinesRoot = read("docs/baselines/README.md");
    const baselinesRootAi = read("docs/baselines/README.ai.md");

    for (const doc of [architectureBaselines, baselinesRoot]) {
      expect(doc).toContain(
        "core-platform-and-composition/domain-and-application-core-historical-evolution.md",
      );
      expect(doc).toContain(
        "runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md",
      );
      expect(doc).toContain(
        "identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md",
      );
    }

    for (const doc of [architectureBaselinesAi, baselinesRootAi]) {
      expect(doc).toContain(
        "core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md",
      );
      expect(doc).toContain(
        "runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.ai.md",
      );
      expect(doc).toContain(
        "identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.ai.md",
      );
    }
  });
});
