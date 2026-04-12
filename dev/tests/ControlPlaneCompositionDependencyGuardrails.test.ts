import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const moduleMapDocPath = resolve(
  repoRoot,
  "docs/architecture/control-plane-composition-refactor-target-module-map.md",
);
const moduleMapAiDocPath = resolve(
  repoRoot,
  "docs/architecture/control-plane-composition-refactor-target-module-map.ai.md",
);
const architectureRouterPath = resolve(repoRoot, "docs/architecture/README.md");
const architectureRouterAiPath = resolve(repoRoot, "docs/architecture/README.ai.md");
const compositionReadmePath = resolve(repoRoot, "src/hosts/server/composition/README.md");

describe("control-plane composition dependency guardrails", () => {
  it("keeps composition dependency docs present for human and AI readers", () => {
    expect(existsSync(moduleMapDocPath)).toBeTrue();
    expect(existsSync(moduleMapAiDocPath)).toBeTrue();
  });

  it("documents allowed/disallowed dependencies and anti-recentralization guidance", () => {
    const humanDoc = readFileSync(moduleMapDocPath, "utf8");
    const aiDoc = readFileSync(moduleMapAiDocPath, "utf8");

    for (const requiredToken of [
      "## Final Implemented Composition Model (Dev Branch)",
      "## Bootstrap Stages, Readiness, and Lifecycle Rules",
      "## Composition Dependency Rules (Story 2.1.4)",
      "### Allowed dependencies for composition modules",
      "### Disallowed dependencies for composition modules",
      "### Explicit allowed module dependency map",
      "## Naming And Placement Conventions (Story 2.1.4)",
      "## Contributor Extension Workflow",
      "## Re-Centralization Prevention Checklist",
      "must not absorb business logic",
      "must not absorb route logic",
      "must not become ad hoc helper buckets",
      "AuthoritativeServerCompositionModuleMap",
      "AuthoritativeServerBootstrapOrchestrator.ts",
    ]) {
      expect(humanDoc).toContain(requiredToken);
      expect(aiDoc).toContain(requiredToken);
    }

    expect(humanDoc).not.toContain("This scaffold intentionally does not move runtime behavior yet.");
    expect(aiDoc).not.toContain("This scaffold intentionally does not move runtime behavior yet.");
  });

  it("keeps control-plane composition guidance discoverable from architecture routers", () => {
    const router = readFileSync(architectureRouterPath, "utf8");
    const routerAi = readFileSync(architectureRouterAiPath, "utf8");

    expect(router).toContain("control-plane-composition-refactor-target-module-map.md");
    expect(routerAi).toContain("control-plane-composition-refactor-target-module-map.md");
  });

  it("keeps local server composition README aligned with dependency and naming guardrails", () => {
    const compositionReadme = readFileSync(compositionReadmePath, "utf8");

    for (const requiredToken of [
      "## Dependency Guardrails",
      "must not absorb business logic",
      "must not absorb route logic",
      "AuthoritativeServerCompositionModuleMap.ts",
      "## Naming And Placement Guidance",
      "Server<Capability>CompositionModule",
      "Server<Capability>CompositionModuleContract",
      "AuthoritativeServerCompositionRoot.ts",
      "## Startup Extension Workflow",
      "AuthoritativeServerBootstrapOrchestrator.ts",
    ]) {
      expect(compositionReadme).toContain(requiredToken);
    }
  });
});

