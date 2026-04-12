import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function parseFrontmatter(content: string): Record<string, string> {
  const normalized = content.replace(/\r\n/g, "\n");
  const start = normalized.indexOf("---\n");
  const end = normalized.indexOf("\n---\n", 4);
  expect(start).toBe(0);
  expect(end).toBeGreaterThan(0);

  const block = normalized.slice(4, end);
  const result: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const match = line.match(/^([a-z_]+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }

  return result;
}

const governanceMdPath = "docs/architecture/architecture-supersession-and-retirement-governance.md";
const governanceAiPath = "docs/architecture/architecture-supersession-and-retirement-governance.ai.md";
const registryPath = "docs/architecture/architecture-supersession-registry.json";
const readmeMdPath = "docs/architecture/README.md";
const readmeAiPath = "docs/architecture/README.ai.md";
const migrationMdPath = "docs/architecture/architecture-migration-sequence-and-priority.md";
const migrationAiPath = "docs/architecture/architecture-migration-sequence-and-priority.ai.md";

const supersededStubDocs = [
  {
    md: "docs/architecture/presentation-and-state.md",
    ai: "docs/architecture/presentation-and-state.ai.md",
  },
  {
    md: "docs/architecture/workflow-execution-and-tools.md",
    ai: "docs/architecture/workflow-execution-and-tools.ai.md",
  },
  {
    md: "docs/architecture/shared-asset-contracts.md",
    ai: "docs/architecture/shared-asset-contracts.ai.md",
  },
] as const;

describe("architecture supersession governance guardrails", () => {
  it("keeps supersession governance docs and registry present and linked from architecture routers", () => {
    for (const path of [governanceMdPath, governanceAiPath, registryPath]) {
      expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }

    const readme = read(readmeMdPath);
    const readmeAi = read(readmeAiPath);
    const migration = read(migrationMdPath);
    const migrationAi = read(migrationAiPath);

    for (const doc of [readme, readmeAi, migration, migrationAi]) {
      expect(doc).toContain("architecture-supersession-and-retirement-governance.md");
      expect(doc).toContain("architecture-supersession-registry.json");
    }
  });

  it("keeps required governance policy sections in both human and AI variants", () => {
    const governance = read(governanceMdPath);
    const governanceAi = read(governanceAiPath);

    for (const heading of [
      "## Legacy State Model",
      "## Required Supersession Notice for Link Stubs",
      "## Safe Redirect and Retirement Rules",
      "## Registry Contract",
    ] as const) {
      expect(governance).toContain(heading);
      expect(governanceAi).toContain(heading);
    }

    for (const state of [
      "legacy-authority",
      "migration-in-progress",
      "migrated-link-stub",
      "historical-baseline",
    ] as const) {
      expect(governance).toContain(state);
      expect(governanceAi).toContain(state);
    }
  });

  it("keeps machine-readable supersession registry coverage for superseded and legacy-authority docs", () => {
    const registry = JSON.parse(read(registryPath));

    expect(registry.story).toBe("4.4.2");
    expect(Array.isArray(registry.states)).toBe(true);
    expect(Array.isArray(registry.supersededDocuments)).toBe(true);
    expect(Array.isArray(registry.legacyAuthorityDocuments)).toBe(true);

    for (const state of [
      "legacy-authority",
      "migration-in-progress",
      "migrated-link-stub",
      "historical-baseline",
    ] as const) {
      expect(registry.states.includes(state)).toBe(true);
    }

    const supersededSources = new Set(
      registry.supersededDocuments.map((entry: { sourcePath: string }) => entry.sourcePath),
    );
    const legacySources = new Set(
      registry.legacyAuthorityDocuments.map((entry: { sourcePath: string }) => entry.sourcePath),
    );

    for (const path of [
      "docs/architecture/presentation-and-state.md",
      "docs/architecture/workflow-execution-and-tools.md",
      "docs/architecture/shared-asset-contracts.md",
    ] as const) {
      expect(supersededSources.has(path)).toBe(true);
    }

    for (const path of [
      "docs/architecture/multi-surface-ui-composition-foundation.md",
      "docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md",
      "docs/architecture/unified-api-endpoint-reference.md",
    ] as const) {
      expect(legacySources.has(path)).toBe(true);
    }
  });

  it("marks migrated split docs as explicit superseded link stubs in md and ai variants", () => {
    for (const pair of supersededStubDocs) {
      const md = read(pair.md);
      const ai = read(pair.ai);
      const mdFrontmatter = parseFrontmatter(md);
      const aiFrontmatter = parseFrontmatter(ai);

      expect(md).toContain("## Supersession Notice");
      expect(ai).toContain("## Supersession Notice");
      expect(md).toContain("## Redirect");
      expect(ai).toContain("## Redirect");
      expect(md).toContain("Effective date:");
      expect(ai).toContain("Effective date:");
      expect(md).toContain("Retention/removal trigger:");
      expect(ai).toContain("Retention/removal trigger:");
      expect(md).toContain("migrated-link-stub");
      expect(ai).toContain("migrated-link-stub");
      expect(md).not.toContain("## Split Routing for Previously Mixed Content");
      expect(ai).not.toContain("## Split Routing for Previously Mixed Content");

      expect(mdFrontmatter.status).toBe("superseded");
      expect(aiFrontmatter.status).toBe("superseded");
      expect(mdFrontmatter.authoritativeness).toBe("historical");
      expect(aiFrontmatter.authoritativeness).toBe("historical");
      expect(typeof mdFrontmatter.superseded_by).toBe("string");
      expect(typeof aiFrontmatter.superseded_by).toBe("string");
    }
  });
});
