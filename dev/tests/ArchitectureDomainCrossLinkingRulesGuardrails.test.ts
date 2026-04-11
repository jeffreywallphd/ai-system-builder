import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanDocPath = resolve(repoRoot, "docs/architecture/architecture-domain-cross-linking-rules.md");
const aiDocPath = resolve(repoRoot, "docs/architecture/architecture-domain-cross-linking-rules.ai.md");

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("architecture domain cross-linking rules guardrails", () => {
  it("keeps cross-linking rules docs present and discoverable from architecture routers", () => {
    expect(existsSync(humanDocPath)).toBe(true);
    expect(existsSync(aiDocPath)).toBe(true);

    const architectureRouter = read("docs/architecture/README.md");
    const architectureRouterAi = read("docs/architecture/README.ai.md");
    const domainsRouter = read("docs/architecture/domains/README.md");
    const domainsRouterAi = read("docs/architecture/domains/README.ai.md");

    expect(architectureRouter).toContain("./architecture-domain-cross-linking-rules.md");
    expect(architectureRouterAi).toContain("./architecture-domain-cross-linking-rules.md");
    expect(domainsRouter).toContain("../architecture-domain-cross-linking-rules.md");
    expect(domainsRouterAi).toContain("../architecture-domain-cross-linking-rules.md");
  });

  it("keeps explicit outbound/inbound rules and anti-clutter guidance in both variants", () => {
    const humanDoc = readFileSync(humanDocPath, "utf8");
    const aiDoc = readFileSync(aiDocPath, "utf8");

    for (const heading of [
      "## Outbound Links From Architecture Domain Docs",
      "## Inbound Links From Neighbor Documentation Types",
      "## Link Budget and Placement Rules (Findability Without Clutter)",
      "## Migration Application Rules for Later Stories",
    ] as const) {
      expect(humanDoc).toContain(heading);
      expect(aiDoc).toContain(heading);
    }

    for (const signal of [
      "docs/adr/records/",
      "docs/context/packs/",
      "docs/baselines/",
      "docs/contributors/",
      "docs/operations/",
      "overview.md",
      "references/README.md",
      "three to seven links",
      "not every neighboring file",
    ] as const) {
      expect(humanDoc).toContain(signal);
      expect(aiDoc).toContain(signal);
    }
  });

  it("keeps neighboring documentation routers linked back to architecture domain cross-linking rules", () => {
    const routerPaths = [
      "docs/adr/README.md",
      "docs/adr/README.ai.md",
      "docs/contributors/README.md",
      "docs/contributors/README.ai.md",
      "docs/operations/README.md",
      "docs/operations/README.ai.md",
      "docs/baselines/README.md",
      "docs/baselines/README.ai.md",
      "docs/context/packs/README.md",
      "docs/context/packs/README.ai.md",
    ] as const;

    for (const path of routerPaths) {
      const content = read(path);
      expect(content).toContain("architecture-domain-cross-linking-rules");
    }
  });
});
