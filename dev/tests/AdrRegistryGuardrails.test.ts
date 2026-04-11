import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const registryPath = resolve(repoRoot, "docs/adr/records/adr-registry.json");
const recordsReadmePath = resolve(repoRoot, "docs/adr/records/README.md");
const recordsReadmeAiPath = resolve(repoRoot, "docs/adr/records/README.ai.md");
const adrRouterPath = resolve(repoRoot, "docs/adr/README.md");
const adrRouterAiPath = resolve(repoRoot, "docs/adr/README.ai.md");

type DecisionStatus = "proposed" | "accepted" | "superseded" | "deprecated";

type AdrRegistryRecord = {
  identifier: string;
  adrNumber: string;
  title: string;
  decisionStatus: DecisionStatus;
  decisionDate: string;
  summary: string;
  relatedDomains: string[];
  humanDocPath: string;
  aiDocPath: string;
};

type AdrRegistry = {
  schemaVersion: string;
  artifactType: string;
  status: string;
  description: string;
  records: AdrRegistryRecord[];
  discoveryIndex: {
    byDecisionStatus: Record<DecisionStatus, string[]>;
    byDomain: Record<string, string[]>;
  };
};

type Frontmatter = {
  title: string;
  adr_number: string;
  decision_status: DecisionStatus;
  decision_date: string;
};

const allowedDecisionStatuses: DecisionStatus[] = [
  "proposed",
  "accepted",
  "superseded",
  "deprecated",
];

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function parseFrontmatter(markdownContent: string): Frontmatter {
  const normalized = markdownContent.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match).toBeTruthy();
  const frontmatterText = match ? match[1] : "";
  const result = {} as Record<string, string>;

  for (const line of frontmatterText.split("\n")) {
    const keyValueMatch = line.match(/^([a-z_]+):\s*(.+)$/);
    if (keyValueMatch) {
      result[keyValueMatch[1]] = keyValueMatch[2];
    }
  }

  return {
    title: result.title,
    adr_number: result.adr_number,
    decision_status: result.decision_status as DecisionStatus,
    decision_date: result.decision_date,
  };
}

describe("ADR registry guardrails", () => {
  it("keeps ADR registry artifact and router links present", () => {
    expect(existsSync(registryPath)).toBe(true);
    expect(readFileSync(recordsReadmePath, "utf8")).toContain("adr-registry.json");
    expect(readFileSync(recordsReadmeAiPath, "utf8")).toContain("adr-registry.json");
    expect(readFileSync(adrRouterPath, "utf8")).toContain("adr-registry.json");
    expect(readFileSync(adrRouterAiPath, "utf8")).toContain("adr-registry.json");
  });

  it("keeps registry parseable with stable discovery shape", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as AdrRegistry;

    expect(registry.schemaVersion).toBe("1.0.0");
    expect(registry.artifactType).toBe("adr-registry");
    expect(registry.status).toBe("active");
    expect(registry.description.trim().length).toBeGreaterThan(0);
    expect(registry.records.length).toBeGreaterThan(0);

    for (const status of allowedDecisionStatuses) {
      expect(Array.isArray(registry.discoveryIndex.byDecisionStatus[status])).toBe(true);
    }
  });

  it("keeps registry records unique, sorted, and synchronized to ADR metadata", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as AdrRegistry;
    const numbers = registry.records.map((record) => Number(record.adrNumber));
    const sorted = [...numbers].sort((left, right) => left - right);
    expect(numbers).toEqual(sorted);

    const identifiers = new Set<string>();
    const adrNumbers = new Set<string>();
    const allDiscoveryIdentifiers = new Set<string>();

    for (const ids of Object.values(registry.discoveryIndex.byDecisionStatus)) {
      for (const identifier of ids) {
        allDiscoveryIdentifiers.add(identifier);
      }
    }
    for (const ids of Object.values(registry.discoveryIndex.byDomain)) {
      for (const identifier of ids) {
        allDiscoveryIdentifiers.add(identifier);
      }
    }

    for (const record of registry.records) {
      expect(record.identifier).toBe(`ADR-${record.adrNumber}`);
      expect(record.adrNumber).toMatch(/^\d{3}$/);
      expect(record.title.trim().length).toBeGreaterThan(0);
      expect(record.summary.trim().length).toBeGreaterThan(0);
      expect(record.summary.length).toBeLessThanOrEqual(260);
      expect(record.relatedDomains.length).toBeGreaterThan(0);
      expect(allowedDecisionStatuses).toContain(record.decisionStatus);
      expect(record.decisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.humanDocPath.endsWith(".md")).toBe(true);
      expect(record.aiDocPath.endsWith(".ai.md")).toBe(true);
      expect(existsSync(resolve(repoRoot, record.humanDocPath))).toBe(true);
      expect(existsSync(resolve(repoRoot, record.aiDocPath))).toBe(true);
      expect(identifiers.has(record.identifier)).toBe(false);
      expect(adrNumbers.has(record.adrNumber)).toBe(false);
      identifiers.add(record.identifier);
      adrNumbers.add(record.adrNumber);

      const humanFrontmatter = parseFrontmatter(read(record.humanDocPath));
      const aiFrontmatter = parseFrontmatter(read(record.aiDocPath));

      const expectedTitle = `ADR-${record.adrNumber} ${record.title}`;

      expect(humanFrontmatter.title).toBe(expectedTitle);
      expect(aiFrontmatter.title).toBe(expectedTitle);
      expect(humanFrontmatter.adr_number).toBe(record.adrNumber);
      expect(aiFrontmatter.adr_number).toBe(record.adrNumber);
      expect(humanFrontmatter.decision_status).toBe(record.decisionStatus);
      expect(aiFrontmatter.decision_status).toBe(record.decisionStatus);
      expect(humanFrontmatter.decision_date).toBe(record.decisionDate);
      expect(aiFrontmatter.decision_date).toBe(record.decisionDate);
      expect(allDiscoveryIdentifiers.has(record.identifier)).toBe(true);
    }
  });

  it("keeps decision-status and domain index references aligned with record identifiers", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as AdrRegistry;
    const validIds = new Set(registry.records.map((record) => record.identifier));
    const expectedByStatus = new Map<DecisionStatus, string[]>();
    for (const status of allowedDecisionStatuses) {
      expectedByStatus.set(
        status,
        registry.records
          .filter((record) => record.decisionStatus === status)
          .map((record) => record.identifier),
      );
    }

    for (const [status, ids] of Object.entries(registry.discoveryIndex.byDecisionStatus)) {
      expect(allowedDecisionStatuses).toContain(status as DecisionStatus);
      for (const id of ids) {
        expect(validIds.has(id)).toBe(true);
      }
      expect(ids).toEqual(expectedByStatus.get(status as DecisionStatus));
    }

    for (const [domain, ids] of Object.entries(registry.discoveryIndex.byDomain)) {
      expect(domain.trim().length).toBeGreaterThan(0);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(validIds.has(id)).toBe(true);
      }
    }
  });
});
