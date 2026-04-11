import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contextRoot = resolve(repoRoot, "docs/context");

const requiredContextSubfolders = [
  "packs",
  "routing",
  "governance",
  "templates",
] as const;

const requiredContextFiles = [
  "docs/context/context-asset-metadata.md",
  "docs/context/context-asset-metadata.ai.md",
  "docs/context/context-asset-metadata.contract.json",
  "docs/context/context-map.md",
  "docs/context/context-map.ai.md",
  "docs/context/context-map.json",
  "docs/context/documentation-supersession-and-redirect-conventions.md",
  "docs/context/documentation-supersession-and-redirect-conventions.ai.md",
  "docs/context/documentation-registry.md",
  "docs/context/documentation-registry.ai.md",
  "docs/context/documentation-registry.seed.json",
  "docs/context/documentation-identity-and-reference-conventions.md",
  "docs/context/documentation-identity-and-reference-conventions.ai.md",
  "docs/context/documentation-identity-and-reference.contract.json",
  "docs/context/prompt-routing.md",
  "docs/context/prompt-routing.ai.md",
  "docs/context/packs/README.md",
  "docs/context/packs/README.ai.md",
  "docs/context/packs/context-pack.contract.json",
  "docs/context/packs/context-pack-catalog.contract.json",
  "docs/context/packs/context-pack-catalog.seed.json",
  "docs/context/packs/architecture-core.pack.md",
  "docs/context/packs/architecture-core.pack.ai.md",
  "docs/context/packs/context-system-foundations.pack.md",
  "docs/context/packs/context-system-foundations.pack.ai.md",
  "docs/context/packs/documentation-refactor.pack.md",
  "docs/context/packs/documentation-refactor.pack.ai.md",
  "docs/context/packs/repository-overview.pack.md",
  "docs/context/packs/repository-overview.pack.ai.md",
  "docs/context/packs/runtime-and-host.pack.md",
  "docs/context/packs/runtime-and-host.pack.ai.md",
  "docs/context/packs/identity-and-security.pack.md",
  "docs/context/packs/identity-and-security.pack.ai.md",
  "docs/context/packs/studio-and-system-composition.pack.md",
  "docs/context/packs/studio-and-system-composition.pack.ai.md",
  "docs/context/routing/README.md",
  "docs/context/routing/README.ai.md",
  "docs/context/routing/prompt-routing-contract.md",
  "docs/context/routing/prompt-routing-contract.ai.md",
  "docs/context/routing/task-to-context-routing.contract.json",
  "docs/context/routing/task-to-context-routing.seed.json",
  "docs/context/governance/README.md",
  "docs/context/governance/README.ai.md",
  "docs/context/governance/context-governance-policy.md",
  "docs/context/governance/context-governance-policy.ai.md",
  "docs/context/governance/context-asset-lifecycle.md",
  "docs/context/governance/context-asset-lifecycle.ai.md",
  "docs/context/governance/documentation-indexing-rollout-boundaries.md",
  "docs/context/governance/documentation-indexing-rollout-boundaries.ai.md",
  "docs/context/governance/context-system-rollout-boundaries.md",
  "docs/context/governance/context-system-rollout-boundaries.ai.md",
] as const;

describe("context engineering structure guardrails", () => {
  it("keeps required context subfolders present", () => {
    for (const folder of requiredContextSubfolders) {
      expect(existsSync(resolve(contextRoot, folder))).toBe(true);
    }
  });

  it("keeps required context seed files present", () => {
    for (const relativePath of requiredContextFiles) {
      expect(existsSync(resolve(repoRoot, relativePath))).toBe(true);
    }
  });

  it("keeps context routers linked to packs, routing, governance, and templates", () => {
    const contextReadme = readFileSync(resolve(contextRoot, "README.md"), "utf8");
    const contextAiReadme = readFileSync(resolve(contextRoot, "README.ai.md"), "utf8");

    expect(contextReadme).toContain("./packs/README.md");
    expect(contextReadme).toContain("./routing/README.md");
    expect(contextReadme).toContain("./governance/README.md");
    expect(contextReadme).toContain("./templates/README.md");
    expect(contextReadme).toContain("./context-map.md");
    expect(contextReadme).toContain("./prompt-routing.md");
    expect(contextReadme).toContain("./context-map.json");
    expect(contextReadme).toContain("./documentation-registry.md");
    expect(contextReadme).toContain("./documentation-identity-and-reference-conventions.md");
    expect(contextReadme).toContain("./documentation-registry.seed.json");
    expect(contextReadme).toContain("./documentation-supersession-and-redirect-conventions.md");

    expect(contextAiReadme).toContain("./packs/README.ai.md");
    expect(contextAiReadme).toContain("./routing/README.ai.md");
    expect(contextAiReadme).toContain("./governance/README.ai.md");
    expect(contextAiReadme).toContain("./templates/README.ai.md");
    expect(contextAiReadme).toContain("./context-map.ai.md");
    expect(contextAiReadme).toContain("./prompt-routing.ai.md");
    expect(contextAiReadme).toContain("./context-map.json");
    expect(contextAiReadme).toContain("./documentation-registry.ai.md");
    expect(contextAiReadme).toContain("./documentation-identity-and-reference-conventions.ai.md");
    expect(contextAiReadme).toContain("./documentation-registry.seed.json");
    expect(contextAiReadme).toContain("./documentation-supersession-and-redirect-conventions.ai.md");
  });

  it("keeps routing and pack contracts parseable and structurally seeded", () => {
    const packContractSpec = JSON.parse(
      readFileSync(resolve(contextRoot, "packs/context-pack.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const packContract = JSON.parse(
      readFileSync(resolve(contextRoot, "packs/context-pack-catalog.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const packSeed = JSON.parse(
      readFileSync(resolve(contextRoot, "packs/context-pack-catalog.seed.json"), "utf8"),
    ) as Record<string, unknown>;
    const metadataContract = JSON.parse(
      readFileSync(resolve(contextRoot, "context-asset-metadata.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const routingContract = JSON.parse(
      readFileSync(resolve(contextRoot, "routing/task-to-context-routing.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const routingSeed = JSON.parse(
      readFileSync(resolve(contextRoot, "routing/task-to-context-routing.seed.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(packContractSpec.schemaVersion).toBe("1.0.0");
    expect(packContractSpec.artifactType).toBe("context-pack-contract");
    expect(Array.isArray(packContractSpec.requiredSections)).toBe(true);

    expect(packContract.schemaVersion).toBe("1.0.0");
    expect(packContract.artifactType).toBe("context-pack-catalog");
    expect(Array.isArray(packContract.entryRequiredFields)).toBe(true);

    expect(packSeed.schemaVersion).toBe("1.0.0");
    expect(packSeed.artifactType).toBe("context-pack-catalog");
    expect(Array.isArray(packSeed.packs)).toBe(true);
    expect((packSeed.packs as unknown[]).length).toBeGreaterThanOrEqual(1);

    expect(metadataContract.schemaVersion).toBe("1.0.0");
    expect(metadataContract.artifactType).toBe("context-asset-metadata-standard");
    expect(Array.isArray(metadataContract.requiredFields)).toBe(true);

    expect(routingContract.schemaVersion).toBe("1.0.0");
    expect(routingContract.artifactType).toBe("task-to-context-routing-map");
    expect(Array.isArray(routingContract.mappingRequiredFields)).toBe(true);
    expect(Array.isArray(routingContract.supportedTaskCategories)).toBe(true);

    expect(routingSeed.schemaVersion).toBe("1.0.0");
    expect(routingSeed.artifactType).toBe("task-to-context-routing-map");
    expect(Array.isArray(routingSeed.mappings)).toBe(true);
  });
});
