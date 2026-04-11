import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistryEntry = {
  recordId: string;
  summary: string;
  keywords?: string[];
};

type RegistrySeed = {
  entries: RegistryEntry[];
};

const highValueEntryExpectations = [
  {
    recordId: "doc-architecture-domain-and-application-core",
    summarySignals: ["feature decomposition", "coding-implementation"],
    keywordSignals: ["dependency direction", "coding implementation"],
  },
  {
    recordId: "doc-architecture-domain-taxonomy",
    summarySignals: ["architecture-review", "diagnostics", "migration-refactor"],
    keywordSignals: ["architecture review", "migration refactor"],
  },
  {
    recordId: "doc-contributors-docs-placement-guide",
    summarySignals: ["architecture/contributors/operations/context", "misplaced authority"],
    keywordSignals: ["documentation change", "md ai pairing"],
  },
  {
    recordId: "doc-operations-node-bootstrap-identity",
    summarySignals: ["identity provisioning", "startup diagnostics"],
    keywordSignals: ["node bootstrap", "trust enrollment"],
  },
  {
    recordId: "doc-adr-001-single-authoritative-control-plane",
    summarySignals: ["authoritative control plane", "policy enforcement"],
    keywordSignals: ["host composition", "decision lineage"],
  },
  {
    recordId: "doc-context-pack-repository-overview",
    summarySignals: ["repository layout", "implementation entry points"],
    keywordSignals: ["implementation onboarding", "task routing"],
  },
  {
    recordId: "doc-context-pack-architecture-core",
    summarySignals: ["layer boundaries", "before code changes"],
    keywordSignals: ["architecture core pack", "pre-implementation review"],
  },
  {
    recordId: "doc-context-pack-runtime-and-host",
    summarySignals: ["startup sequencing", "regression diagnostics"],
    keywordSignals: ["post-login lifecycle", "diagnostics triage"],
  },
  {
    recordId: "doc-context-pack-identity-and-security",
    summarySignals: ["authorization enforcement", "runtime hardening"],
    keywordSignals: ["session trust", "secret redaction"],
  },
  {
    recordId: "doc-context-pack-studio-and-system-composition",
    summarySignals: ["studio handoff contracts", "workflow ui coordination"],
    keywordSignals: ["shared model boundaries", "ui studio tasks"],
  },
  {
    recordId: "doc-context-pack-documentation-refactor",
    summarySignals: ["registry/routing updates", "md/ai parity"],
    keywordSignals: ["taxonomy alignment", "docs foundation validation"],
  },
  {
    recordId: "doc-baseline-documentation-migration-baseline",
    summarySignals: ["historical migration baseline", "documentation-refactor decisions"],
    keywordSignals: ["historical comparison", "refactor traceability"],
  },
] as const;

describe("story 6.2.5 discovery-oriented summaries and keywords guardrails", () => {
  it("keeps high-value registry entries concise, keyworded, and grounded in routing vocabulary", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entriesById = new Map(registry.entries.map((entry) => [entry.recordId, entry]));

    for (const expected of highValueEntryExpectations) {
      const entry = entriesById.get(expected.recordId);
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }

      expect(typeof entry.summary).toBe("string");
      expect(entry.summary.trim().length).toBeGreaterThan(40);
      expect(entry.summary.split(/\s+/).length).toBeGreaterThanOrEqual(8);

      const summaryLower = entry.summary.toLowerCase();
      for (const signal of expected.summarySignals) {
        expect(summaryLower).toContain(signal);
      }

      expect(Array.isArray(entry.keywords)).toBe(true);
      const keywords = (entry.keywords ?? []).map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);
      expect(keywords.length).toBeGreaterThanOrEqual(4);
      expect(keywords.length).toBeLessThanOrEqual(6);

      const uniqueKeywords = new Set(keywords.map((keyword) => keyword.toLowerCase()));
      expect(uniqueKeywords.size).toBe(keywords.length);

      const keywordHaystack = keywords.join(" ").toLowerCase();
      for (const signal of expected.keywordSignals) {
        expect(keywordHaystack).toContain(signal);
      }
    }
  });

  it("documents story 6.2.5 discovery-quality population status in human and ai registry guidance", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    expect(human).toContain("## Discovery Summaries and Keyword Quality Status (Story 6.2.5)");
    expect(ai).toContain("## Discovery Summaries and Keyword Quality Status (Story 6.2.5)");
    expect(human).toContain("docs/context/packs/repository-overview.pack.md");
    expect(ai).toContain("docs/context/packs/repository-overview.pack.md");
    expect(human).toContain("docs/node-bootstrap-identity-operations.md");
    expect(ai).toContain("docs/node-bootstrap-identity-operations.md");
    expect(human).toContain("docs/documentation-migration-baseline.md");
    expect(ai).toContain("docs/documentation-migration-baseline.md");
  });
});
