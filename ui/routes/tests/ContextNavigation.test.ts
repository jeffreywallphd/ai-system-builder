import { describe, expect, it } from "bun:test";
import { BuildIntents } from "../BuildIntentModels";
import { ContextNavigationService } from "../ContextNavigation";
import { ROUTE_PATHS } from "../RouteConfig";

describe("Context navigation service", () => {
  const service = new ContextNavigationService();

  it("derives Build flow breadcrumbs for intent-routed studio mode", () => {
    const model = service.resolve({
      pathname: ROUTE_PATHS.workflowStudio,
      search: `?buildIntent=${BuildIntents.automateTask}&buildFlowSessionId=build-flow-1`,
    });

    expect(model.route.shellSection).toBe("build");
    expect(model.breadcrumbs.map((item) => item.label)).toContain("Automate a task");
    expect(model.breadcrumbs.map((item) => item.label)).toContain("Studio mode");
    expect(model.returnPath).toContain("buildFlowSessionId=build-flow-1");
  });

  it("derives Explore list/detail breadcrumb context and return-to-origin path", () => {
    const model = service.resolve({
      pathname: "/studio-shell/registry/assets/asset-1",
      search: "?assetId=asset-1&registryContext=q%3Ddemo",
    });

    expect(model.route.shellSection).toBe("explore");
    expect(model.breadcrumbs.map((item) => item.label)).toEqual(["Explore", "Library", "Asset asset-1"]);
    expect(model.returnPath).toBe("/explore?q=demo");
  });

  it("keeps run context lightweight and intent-friendly", () => {
    const model = service.resolve({
      pathname: ROUTE_PATHS.run,
      search: "",
    });

    expect(model.route.shellSection).toBe("run");
    expect(model.breadcrumbs.map((item) => item.label)).toEqual(["Run", "Execution center"]);
  });
});
