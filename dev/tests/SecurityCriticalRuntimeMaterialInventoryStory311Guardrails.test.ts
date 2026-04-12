import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const inventoryDocPath = path.resolve(
  repoRoot,
  "docs",
  "architecture",
  "security-critical-runtime-material-inventory.md",
);
const inventoryAiDocPath = path.resolve(
  repoRoot,
  "docs",
  "architecture",
  "security-critical-runtime-material-inventory.ai.md",
);
const architectureReadmePath = path.resolve(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.resolve(repoRoot, "docs", "architecture", "README.ai.md");

describe("story 3.1.1 security-critical runtime material inventory guardrails", () => {
  it("keeps canonical and ai inventory docs checked in", () => {
    expect(existsSync(inventoryDocPath)).toBeTrue();
    expect(existsSync(inventoryAiDocPath)).toBeTrue();
  });

  it("covers core server, workspace, and user scoped security material with fallback behavior", () => {
    const doc = readFileSync(inventoryDocPath, "utf8");

    expect(doc).toContain("| Material | Scope | Resolution Source |");
    expect(doc).toContain("server");
    expect(doc).toContain("workspace");
    expect(doc).toContain("user");

    expect(doc).toContain("AI_LOOM_SECRET_MASTER_KEY_ID");
    expect(doc).toContain("AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET");
    expect(doc).toContain("AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY");
    expect(doc).toContain("AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET");
    expect(doc).toContain("AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET");
    expect(doc).toContain("AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET");
    expect(doc).toContain("AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED");
    expect(doc).toContain("AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY");
    expect(doc).toContain("OPENAI_API_KEY");
    expect(doc).toContain("HUGGINGFACE_API_TOKEN");
    expect(doc).toContain("AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY");

    expect(doc).toContain("randomUUID()");
    expect(doc).toContain("non-durable");
    expect(doc).toContain("Ambiguous and Duplicated Resolution Paths");
    expect(doc).toContain("Host vs Infrastructure Resolution Boundaries");
  });

  it("keeps architecture routers discoverable for the inventory document", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const aiReadme = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("security-critical-runtime-material-inventory.md");
    expect(aiReadme).toContain("security-critical-runtime-material-inventory.md");
  });

  it("keeps ai companion inventory aligned to canonical doc and ambiguity callouts", () => {
    const aiDoc = readFileSync(inventoryAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/security-critical-runtime-material-inventory.md");
    expect(aiDoc).toContain("AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET");
    expect(aiDoc).toContain("AI_LOOM_SECRET_MASTER_KEY");
    expect(aiDoc).toContain("Ambiguity and Duplication Callouts");
  });
});
