import { describe, expect, it } from "bun:test";
import { ROUTE_PATHS } from "../RouteConfig";
import { RunContextKinds, RunInterfaceService } from "../RunInterface";

describe("RunInterfaceService", () => {
  const service = new RunInterfaceService();

  it("resolves Run launch paths with bounded context query parameters", () => {
    const launchPath = service.resolveLaunchPath({
      contextKind: RunContextKinds.asset,
      assetId: "asset:workflow:1",
      versionId: "asset:workflow:1:v1",
      source: "explore",
      runIntentLabel: "Run here",
      actionKind: "run",
      originPath: "/explore",
      originLabel: "Explore",
    });

    expect(launchPath).toContain(`${ROUTE_PATHS.run}?`);
    expect(launchPath).toContain("context=asset");
    expect(launchPath).toContain("assetId=asset%3Aworkflow%3A1");
    expect(launchPath).toContain("source=explore");
    expect(launchPath).toContain("action=run");
    expect(launchPath).toContain("originPath=%2Fexplore");
  });

  it("projects UX-facing system presentation without MCP/runtime labels", () => {
    const presentation = service.resolvePresentation("?context=system&assetId=asset%3Asystem%3A1");

    expect(presentation.shellTitle).toBe("Run");
    expect(presentation.surface.title).toBe("Run a system");
    expect(presentation.surface.primaryActionPath).toBe(ROUTE_PATHS.systemStudio);
    expect(presentation.surface.subtitle.toLowerCase()).not.toContain("mcp");
    expect(presentation.surface.subtitle.toLowerCase()).not.toContain("runtime");
  });

  it("labels test-focused launch surfaces distinctly", () => {
    const presentation = service.resolvePresentation("?context=asset&action=test&intent=Test+here");
    expect(presentation.surface.title).toBe("Test from context");
  });
});
