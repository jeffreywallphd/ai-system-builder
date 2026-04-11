import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const docsRoot = resolve(repoRoot, "docs");
const standardPath = resolve(repoRoot, "docs/contributors/router-overview-writing-standard.md");
const aiStandardPath = resolve(repoRoot, "docs/contributors/router-overview-writing-standard.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");

const requiredTopLevelFolders = [
  "architecture",
  "contributors",
  "operations",
  "baselines",
  "adr",
  "context",
  "prompts",
  "ui",
] as const;

function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return normalized;
  }

  const closingDelimiterIndex = normalized.indexOf("\n---\n", 4);
  if (closingDelimiterIndex === -1) {
    return normalized;
  }

  return normalized.slice(closingDelimiterIndex + 5);
}

function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .length;
}

function countMarkdownLinks(content: string): number {
  return (content.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
}

function listMarkdownFilesRecursively(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursively(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

function isTemplatesPath(path: string): boolean {
  return /[\\/]docs[\\/]context[\\/]templates[\\/]/.test(path);
}

describe("documentation router and overview writing standard guardrails", () => {
  it("keeps the writing standard docs present", () => {
    expect(existsSync(standardPath)).toBe(true);
    expect(existsSync(aiStandardPath)).toBe(true);
  });

  it("enforces required writing-standard anchors", () => {
    const humanStandard = readFileSync(standardPath, "utf8");
    const aiStandard = readFileSync(aiStandardPath, "utf8");

    const requiredAnchors = [
      "## Scope",
      "## Document Roles",
      "## Target Length",
      "## Allowed Responsibilities",
      "## Link Versus Restate",
      "## Anti-Catch-All Guardrails",
      "Router documents",
      "Overview documents",
      "Navigation docs are not reference docs.",
      "at or below 500 words",
      "at or below 900 words",
    ] as const;

    for (const anchor of requiredAnchors) {
      expect(humanStandard).toContain(anchor);
      expect(aiStandard).toContain(anchor);
    }
  });

  it("keeps contributor routers linked to the writing standard", () => {
    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./router-overview-writing-standard.md");
    expect(contributorsAiReadme).toContain("./router-overview-writing-standard.ai.md");
  });

  it("keeps router docs concise and link-first", () => {
    const routerPaths = [
      resolve(docsRoot, "README.md"),
      resolve(docsRoot, "README.ai.md"),
      ...requiredTopLevelFolders.flatMap((folder) => [
        resolve(docsRoot, folder, "README.md"),
        resolve(docsRoot, folder, "README.ai.md"),
      ]),
    ];

    for (const routerPath of routerPaths) {
      const content = stripFrontmatter(readFileSync(routerPath, "utf8"));
      const wordCount = countWords(content);
      const linkCount = countMarkdownLinks(content);

      expect(wordCount).toBeLessThanOrEqual(500);
      expect(linkCount).toBeGreaterThanOrEqual(3);
      expect(wordCount / linkCount).toBeLessThanOrEqual(35);
    }
  });

  it("keeps architecture-overview docs concise and structured", () => {
    const markdownPaths = listMarkdownFilesRecursively(docsRoot)
      .filter((path) => !isTemplatesPath(path));

    const overviewDocs = markdownPaths.filter((path) => {
      const content = readFileSync(path, "utf8");
      return /^doc_type:\s*architecture-overview\s*$/m.test(content);
    });

    expect(overviewDocs.length).toBeGreaterThanOrEqual(2);

    for (const overviewDoc of overviewDocs) {
      const body = stripFrontmatter(readFileSync(overviewDoc, "utf8"));
      const wordCount = countWords(body);
      const h2Count = (body.match(/^##\s+/gm) || []).length;

      expect(wordCount).toBeLessThanOrEqual(900);
      expect(h2Count).toBeGreaterThanOrEqual(3);
    }
  });
});
