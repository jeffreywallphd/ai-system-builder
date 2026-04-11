import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanPackPath = resolve(repoRoot, "docs/context/packs/runtime-and-host.pack.md");
const aiPackPath = resolve(repoRoot, "docs/context/packs/runtime-and-host.pack.ai.md");

const requiredHeadings = [
  "## Purpose",
  "## When To Use",
  "## When Not To Use",
  "## Invariants",
  "## Authoritative Docs",
  "## Authoritative Code Paths",
  "## Anti-Patterns",
  "## Related Packs",
] as const;

describe("runtime and host context pack guardrails", () => {
  it("keeps runtime and host pack artifacts present", () => {
    expect(existsSync(humanPackPath)).toBe(true);
    expect(existsSync(aiPackPath)).toBe(true);
  });

  it("keeps runtime and host pack aligned to contract sections and startup boundary guidance", () => {
    const humanPack = readFileSync(humanPackPath, "utf8");
    const aiPack = readFileSync(aiPackPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(humanPack).toContain(heading);
      expect(aiPack).toContain(heading);
    }

    for (const requiredPhrase of [
      "runtime",
      "host",
      "desktop",
      "startup",
      "post-login",
      "authoritative control-plane",
      "runtime-and-host",
    ]) {
      expect(humanPack).toContain(requiredPhrase);
      expect(aiPack).toContain(requiredPhrase);
    }

    for (const authoritativePath of [
      "docs/architecture/host-runtime-composition-boundaries.md",
      "docs/architecture/host-bootstrap-pipeline.md",
      "docs/architecture/desktop-post-login-runtime-lifecycle-contract.md",
      "src/hosts/bootstrap/HostBootstrapPipeline.ts",
      "src/hosts/desktop/DesktopHostCompositionRoot.ts",
      "electron/main/main.ts",
    ]) {
      expect(humanPack).toContain(authoritativePath);
    }

    for (const authoritativePath of [
      "docs/architecture/host-runtime-composition-boundaries.ai.md",
      "docs/architecture/host-bootstrap-pipeline.ai.md",
      "docs/architecture/desktop-post-login-runtime-lifecycle-contract.ai.md",
      "src/hosts/bootstrap/HostBootstrapPipeline.ts",
      "src/hosts/desktop/DesktopHostCompositionRoot.ts",
      "electron/main/main.ts",
    ]) {
      expect(aiPack).toContain(authoritativePath);
    }
  });
});
