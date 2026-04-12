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

  it("keeps key architecture domain overviews linked to decision records", () => {
    const domainCore = read("docs/architecture/domain-and-application-core.md");
    const domainCoreAi = read("docs/architecture/domain-and-application-core.ai.md");
    const layersBoundaries = read("docs/architecture/layers-and-boundaries.md");
    const layersBoundariesAi = read("docs/architecture/layers-and-boundaries.ai.md");
    const desktopHosts = read("docs/architecture/desktop-runtime-and-hosts.md");
    const desktopHostsAi = read("docs/architecture/desktop-runtime-and-hosts.ai.md");

    expect(domainCore).toContain("## Related ADRs");
    expect(domainCore).toContain("adr-004-studios-as-views-over-shared-system-and-asset-model.md");
    expect(domainCore).toContain("adr-006-policy-aware-scheduling-and-controlled-execution.md");
    expect(domainCoreAi).toContain("## Related ADRs");
    expect(domainCoreAi).toContain("adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md");
    expect(domainCoreAi).toContain("adr-006-policy-aware-scheduling-and-controlled-execution.ai.md");

    expect(layersBoundaries).toContain("## Related ADRs");
    expect(layersBoundaries).toContain("adr-001-single-authoritative-control-plane.md");
    expect(layersBoundaries).toContain("adr-004-studios-as-views-over-shared-system-and-asset-model.md");
    expect(layersBoundaries).toContain("adr-005-trust-identity-and-security-boundary-enforcement.md");
    expect(layersBoundariesAi).toContain("## Related ADRs");
    expect(layersBoundariesAi).toContain("adr-001-single-authoritative-control-plane.ai.md");
    expect(layersBoundariesAi).toContain("adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md");
    expect(layersBoundariesAi).toContain("adr-005-trust-identity-and-security-boundary-enforcement.ai.md");

    expect(desktopHosts).toContain("## Related ADRs");
    expect(desktopHosts).toContain("adr-001-single-authoritative-control-plane.md");
    expect(desktopHosts).toContain("adr-003-storage-as-managed-platform-resource.md");
    expect(desktopHosts).toContain("adr-005-trust-identity-and-security-boundary-enforcement.md");
    expect(desktopHostsAi).toContain("## Related ADRs");
    expect(desktopHostsAi).toContain("adr-001-single-authoritative-control-plane.ai.md");
    expect(desktopHostsAi).toContain("adr-003-storage-as-managed-platform-resource.ai.md");
    expect(desktopHostsAi).toContain("adr-005-trust-identity-and-security-boundary-enforcement.ai.md");
  });
});
