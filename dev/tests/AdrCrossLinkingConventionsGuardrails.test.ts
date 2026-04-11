import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR cross-linking conventions guardrails", () => {
  it("keeps architecture routers explicit about ADR backlinks", () => {
    const architectureRouter = read("docs/architecture/README.md");
    const architectureRouterAi = read("docs/architecture/README.ai.md");

    expect(architectureRouter).toContain("## ADR Linking Expectations");
    expect(architectureRouter).toContain("## Related ADRs");
    expect(architectureRouter).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.md");

    expect(architectureRouterAi).toContain("## ADR Linking Expectations");
    expect(architectureRouterAi).toContain("## Related ADRs");
    expect(architectureRouterAi).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.ai.md");
  });

  it("keeps context pack templates and specs explicit about optional ADR citations", () => {
    const packTemplate = read("docs/context/templates/context-pack.template.md");
    const packTemplateAi = read("docs/context/templates/context-pack.template.ai.md");
    const packSpec = read("docs/context/packs/README.md");
    const packSpecAi = read("docs/context/packs/README.ai.md");

    expect(packTemplate).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.md");
    expect(packTemplateAi).toContain("docs/adr/records/adr-<NNN>-<decision-slug>.ai.md");
    expect(packSpec).toContain("## ADR Citation Conventions");
    expect(packSpecAi).toContain("## ADR Citation Conventions");
  });
});
