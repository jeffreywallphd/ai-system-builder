import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const contractPath = resolve(repoRoot, "docs/context/documentation-metadata-header.contract.json");
const taxonomyContractPath = resolve(repoRoot, "docs/context/documentation-taxonomy.contract.json");
const docsValidationDate = new Date("2026-04-11T00:00:00.000Z");

type MetadataContract = {
  requiredFields: Record<string, { allowedValues?: string[] }>;
};

type TaxonomyContract = {
  metadataFields: {
    document_type: { allowedValues: string[] };
    status: { allowedValues: string[] };
    authoritativeness: { allowedValues: string[] };
  };
};

type ParsedFrontmatter = Record<string, string | string[]>;

const requiredFields = [
  "title",
  "doc_type",
  "status",
  "authoritativeness",
  "owned_by",
  "last_reviewed",
] as const;

const seedDocuments = [
  {
    path: "docs/architecture/README.md",
    expected: {
      doc_type: "architecture-overview",
      status: "active",
      authoritativeness: "canonical",
      owned_by: "team:platform-architecture",
    },
    pairPath: "docs/architecture/README.ai.md",
  },
  {
    path: "docs/architecture/domain-and-application-core.md",
    expected: {
      doc_type: "architecture-reference",
      status: "active",
      authoritativeness: "canonical",
      owned_by: "team:platform-architecture",
    },
    pairPath: "docs/architecture/domain-and-application-core.ai.md",
  },
  {
    path: "docs/unified-api-contributor-guide.md",
    expected: {
      doc_type: "contributor-guide",
      status: "active",
      authoritativeness: "reference",
      owned_by: "team:developer-experience",
    },
    pairPath: "docs/unified-api-contributor-guide.ai.md",
  },
  {
    path: "docs/security-policy-configuration-operations.md",
    expected: {
      doc_type: "runbook",
      status: "active",
      authoritativeness: "reference",
      owned_by: "team:operations-security",
    },
    pairPath: "docs/security-policy-configuration-operations.ai.md",
  },
  {
    path: "docs/documentation-migration-baseline.md",
    expected: {
      doc_type: "baseline",
      status: "archived",
      authoritativeness: "historical",
      owned_by: "team:developer-experience",
    },
    pairPath: "docs/documentation-migration-baseline.ai.md",
  },
  {
    path: "docs/context/documentation-taxonomy.md",
    expected: {
      doc_type: "ai-context",
      status: "active",
      authoritativeness: "canonical",
      owned_by: "team:developer-experience",
    },
    pairPath: "docs/context/documentation-taxonomy.ai.md",
  },
] as const;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalizedContent = content.replace(/\r\n/g, "\n");

  if (!normalizedContent.startsWith("---\n")) {
    throw new Error("Markdown file is missing opening frontmatter delimiter");
  }

  const closingDelimiterIndex = normalizedContent.indexOf("\n---\n", 4);
  if (closingDelimiterIndex === -1) {
    throw new Error("Markdown file is missing closing frontmatter delimiter");
  }

  const frontmatterText = normalizedContent.slice(4, closingDelimiterIndex);
  const afterFrontmatter = normalizedContent.slice(closingDelimiterIndex + 5);
  const parsed: ParsedFrontmatter = {};
  let currentArrayKey: string | null = null;

  for (const line of frontmatterText.split("\n")) {
    if (line.trim().length === 0) {
      currentArrayKey = null;
      continue;
    }

    const keyValueMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      if (value.length === 0) {
        parsed[key] = [];
        currentArrayKey = key;
      } else {
        parsed[key] = value;
        currentArrayKey = null;
      }
      continue;
    }

    const arrayValueMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayValueMatch && currentArrayKey) {
      const arrayValues = parsed[currentArrayKey];
      if (!Array.isArray(arrayValues)) {
        throw new Error(`Frontmatter key ${currentArrayKey} is not an array`);
      }
      arrayValues.push(arrayValueMatch[1]);
      continue;
    }

    throw new Error(`Unsupported frontmatter line: ${line}`);
  }

  expect(afterFrontmatter.trimStart().startsWith("# ")).toBe(true);
  return parsed;
}

describe("documentation metadata seed backfill guardrails", () => {
  it("keeps seed document headers present and contract-valid", () => {
    const metadataContract = readJson<MetadataContract>(contractPath);
    const taxonomyContract = readJson<TaxonomyContract>(taxonomyContractPath);
    const docTypeValues = new Set(taxonomyContract.metadataFields.document_type.allowedValues);
    const statusValues = new Set(taxonomyContract.metadataFields.status.allowedValues);
    const authoritativenessValues = new Set(taxonomyContract.metadataFields.authoritativeness.allowedValues);

    const observedDocTypes = new Set<string>();

    for (const seed of seedDocuments) {
      const seedPath = resolve(repoRoot, seed.path);
      expect(existsSync(seedPath)).toBe(true);

      const frontmatter = parseFrontmatter(readFileSync(seedPath, "utf8"));

      for (const field of requiredFields) {
        const value = frontmatter[field];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }

      expect(frontmatter.doc_type).toBe(seed.expected.doc_type);
      expect(frontmatter.status).toBe(seed.expected.status);
      expect(frontmatter.authoritativeness).toBe(seed.expected.authoritativeness);
      expect(frontmatter.owned_by).toBe(seed.expected.owned_by);
      expect(docTypeValues.has(frontmatter.doc_type as string)).toBe(true);
      expect(statusValues.has(frontmatter.status as string)).toBe(true);
      expect(authoritativenessValues.has(frontmatter.authoritativeness as string)).toBe(true);
      expect((frontmatter.last_reviewed as string)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const reviewDate = new Date(`${frontmatter.last_reviewed as string}T00:00:00.000Z`);
      expect(reviewDate.getTime()).toBeLessThanOrEqual(docsValidationDate.getTime());

      if (frontmatter.status === "superseded") {
        expect(typeof frontmatter.superseded_by).toBe("string");
      }

      expect(frontmatter.superseded_by && frontmatter.supersedes).toBeFalsy();

      if ("related_code_paths" in frontmatter) {
        expect(Array.isArray(frontmatter.related_code_paths)).toBe(true);
        expect((frontmatter.related_code_paths as string[]).length).toBeGreaterThan(0);
      }

      observedDocTypes.add(frontmatter.doc_type as string);
    }

    expect(observedDocTypes.size).toBeGreaterThanOrEqual(5);
    expect(observedDocTypes.has("architecture-overview")).toBe(true);
    expect(observedDocTypes.has("architecture-reference")).toBe(true);
    expect(observedDocTypes.has("contributor-guide")).toBe(true);
    expect(observedDocTypes.has("runbook")).toBe(true);
    expect(observedDocTypes.has("baseline")).toBe(true);
    expect(observedDocTypes.has("ai-context")).toBe(true);

    const contractRequiredFieldIds = Object.keys(metadataContract.requiredFields);
    expect(contractRequiredFieldIds).toEqual(requiredFields);
  });

  it("keeps paired md and ai docs aligned on routing metadata", () => {
    for (const seed of seedDocuments) {
      const mdPath = resolve(repoRoot, seed.path);
      const aiPath = resolve(repoRoot, seed.pairPath);

      expect(existsSync(mdPath)).toBe(true);
      expect(existsSync(aiPath)).toBe(true);

      const mdFrontmatter = parseFrontmatter(readFileSync(mdPath, "utf8"));
      const aiFrontmatter = parseFrontmatter(readFileSync(aiPath, "utf8"));

      expect(aiFrontmatter.doc_type).toBe(mdFrontmatter.doc_type);
      expect(aiFrontmatter.status).toBe(mdFrontmatter.status);
      expect(aiFrontmatter.authoritativeness).toBe(mdFrontmatter.authoritativeness);
      expect(aiFrontmatter.owned_by).toBe(mdFrontmatter.owned_by);
      expect(aiFrontmatter.last_reviewed).toBe(mdFrontmatter.last_reviewed);
    }
  });
});
