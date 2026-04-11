import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const sequenceMdPath = resolve(repoRoot, "docs/architecture/architecture-migration-sequence-and-priority.md");
const sequenceAiMdPath = resolve(repoRoot, "docs/architecture/architecture-migration-sequence-and-priority.ai.md");
const sequenceJsonPath = resolve(
  repoRoot,
  "docs/architecture/architecture-migration-sequence-and-priority.sequence.json",
);
const inventoryJsonPath = resolve(
  repoRoot,
  "docs/architecture/architecture-domain-migration-inventory.inventory.json",
);
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");

const requiredDomains = [
  "core-platform-and-composition",
  "runtime-host-surfaces",
  "identity-trust-and-security",
  "workspace-storage-and-assets",
  "execution-control-plane-and-scheduling",
  "studio-and-system-composition",
  "api-and-transport-surfaces",
  "deployment-policy-and-audit-governance",
] as const;

describe("architecture migration sequence guardrails", () => {
  it("keeps migration sequence docs and artifact present and discoverable", () => {
    expect(existsSync(sequenceMdPath)).toBe(true);
    expect(existsSync(sequenceAiMdPath)).toBe(true);
    expect(existsSync(sequenceJsonPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");

    expect(architectureReadme).toContain("./architecture-migration-sequence-and-priority.md");
    expect(architectureAiReadme).toContain("./architecture-migration-sequence-and-priority.md");
  });

  it("keeps required sequencing, dependency, and coexistence guidance in human and AI variants", () => {
    const humanDoc = readFileSync(sequenceMdPath, "utf8");
    const aiDoc = readFileSync(sequenceAiMdPath, "utf8");

    for (const heading of [
      "## Sequencing Goals",
      "## Priority Waves",
      "## Dependency Rules and Gating Criteria",
      "## Temporary Coexistence Strategy (Old and New Docs)",
      "## Contributor Execution Checklist per Wave",
    ] as const) {
      expect(humanDoc).toContain(heading);
      expect(aiDoc).toContain(heading);
    }

    for (const signal of [
      "map-002",
      "map-011",
      "map-016",
      "map-020",
      "legacy-authority",
      "migration-in-progress",
      "migrated-link-stub",
      "historical-baseline",
      "one canonical",
    ] as const) {
      expect(humanDoc).toContain(signal);
      expect(aiDoc).toContain(signal);
    }
  });

  it("keeps machine-readable sequence aligned to migration inventory mappings and domain coverage", () => {
    const sequence = JSON.parse(readFileSync(sequenceJsonPath, "utf8"));
    const inventory = JSON.parse(readFileSync(inventoryJsonPath, "utf8"));

    expect(sequence.story).toBe("4.4.1");
    expect(Array.isArray(sequence.sequence)).toBe(true);
    expect(sequence.sequence.length).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(sequence.coexistencePolicy.allowedLegacyStates)).toBe(true);
    expect(Array.isArray(sequence.coexistencePolicy.rules)).toBe(true);

    const inventoryMappingIds = new Set(
      inventory.mappings.map((mapping: { id: string }) => mapping.id),
    );
    const seenWaveIds = new Set<string>();
    const coveredDomains = new Set<string>();
    const seenMappingIds = new Set<string>();

    for (const wave of sequence.sequence) {
      expect(typeof wave.waveId).toBe("string");
      expect(typeof wave.priority).toBe("number");
      expect(Array.isArray(wave.targetDomains)).toBe(true);
      expect(Array.isArray(wave.mappingIds)).toBe(true);
      expect(Array.isArray(wave.dependsOnWaves)).toBe(true);
      expect(Array.isArray(wave.exitCriteria)).toBe(true);
      expect(wave.mappingIds.length).toBeGreaterThan(0);

      seenWaveIds.add(wave.waveId);
      for (const domainId of wave.targetDomains) {
        coveredDomains.add(domainId);
      }

      for (const mappingId of wave.mappingIds) {
        expect(inventoryMappingIds.has(mappingId)).toBe(true);
        seenMappingIds.add(mappingId);
      }
    }

    for (const wave of sequence.sequence) {
      for (const dependency of wave.dependsOnWaves) {
        expect(seenWaveIds.has(dependency)).toBe(true);
      }
    }

    for (const domainId of requiredDomains) {
      expect(coveredDomains.has(domainId)).toBe(true);
    }

    for (const mappingId of inventoryMappingIds) {
      expect(seenMappingIds.has(mappingId)).toBe(true);
    }

    const coexistenceStates = new Set(sequence.coexistencePolicy.allowedLegacyStates);
    for (const requiredState of [
      "legacy-authority",
      "migration-in-progress",
      "migrated-link-stub",
      "historical-baseline",
    ] as const) {
      expect(coexistenceStates.has(requiredState)).toBe(true);
    }
  });
});
