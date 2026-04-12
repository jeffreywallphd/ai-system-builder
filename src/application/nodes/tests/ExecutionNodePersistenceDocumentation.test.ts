import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-persistence-and-status-history.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-persistence-and-status-history.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("execution node persistence documentation", () => {
  it("keeps persistence docs and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents concrete execution-node persistence structure and migration impact", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("execution_node_records");
    expect(doc).toContain("execution_node_status_history");
    expect(doc).toContain("execution_node_mutation_replays");
    expect(doc).toContain("SqliteExecutionNodeRepository.ts");
    expect(doc).toContain("schema version is `2`");
  });

  it("keeps architecture indexes discoverable for execution-node persistence docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("execution-node-persistence-and-status-history.md");
    expect(readmeAi).toContain("execution-node-persistence-and-status-history.md");
  });

  it("keeps AI companion persistence doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/execution-node-persistence-and-status-history.md");
    expect(aiDoc).toContain("SqliteExecutionNodeRepository.ts");
    expect(aiDoc).toContain("SqliteExecutionNodePersistenceMigrations.ts");
  });
});
