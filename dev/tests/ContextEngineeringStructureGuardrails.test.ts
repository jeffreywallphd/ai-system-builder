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
  "docs/context/packs/README.md",
  "docs/context/packs/README.ai.md",
  "docs/context/packs/context-pack-catalog.contract.json",
  "docs/context/packs/context-pack-catalog.seed.json",
  "docs/context/routing/README.md",
  "docs/context/routing/README.ai.md",
  "docs/context/routing/task-to-context-routing.contract.json",
  "docs/context/routing/task-to-context-routing.seed.json",
  "docs/context/governance/README.md",
  "docs/context/governance/README.ai.md",
  "docs/context/governance/context-governance-policy.md",
  "docs/context/governance/context-governance-policy.ai.md",
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

    expect(contextAiReadme).toContain("./packs/README.ai.md");
    expect(contextAiReadme).toContain("./routing/README.ai.md");
    expect(contextAiReadme).toContain("./governance/README.ai.md");
    expect(contextAiReadme).toContain("./templates/README.ai.md");
  });

  it("keeps routing and pack contracts parseable and structurally seeded", () => {
    const packContract = JSON.parse(
      readFileSync(resolve(contextRoot, "packs/context-pack-catalog.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const packSeed = JSON.parse(
      readFileSync(resolve(contextRoot, "packs/context-pack-catalog.seed.json"), "utf8"),
    ) as Record<string, unknown>;
    const routingContract = JSON.parse(
      readFileSync(resolve(contextRoot, "routing/task-to-context-routing.contract.json"), "utf8"),
    ) as Record<string, unknown>;
    const routingSeed = JSON.parse(
      readFileSync(resolve(contextRoot, "routing/task-to-context-routing.seed.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(packContract.schemaVersion).toBe("1.0.0");
    expect(packContract.artifactType).toBe("context-pack-catalog");
    expect(Array.isArray(packContract.entryRequiredFields)).toBe(true);

    expect(packSeed.schemaVersion).toBe("1.0.0");
    expect(packSeed.artifactType).toBe("context-pack-catalog");
    expect(Array.isArray(packSeed.packs)).toBe(true);

    expect(routingContract.schemaVersion).toBe("1.0.0");
    expect(routingContract.artifactType).toBe("task-to-context-routing-map");
    expect(Array.isArray(routingContract.mappingRequiredFields)).toBe(true);

    expect(routingSeed.schemaVersion).toBe("1.0.0");
    expect(routingSeed.artifactType).toBe("task-to-context-routing-map");
    expect(Array.isArray(routingSeed.mappings)).toBe(true);
  });
});
