import { describe, expect, it } from "bun:test";
import { IntentNavigationFeatureFlag } from "../../features/IntentNavigationFeatureFlag";
import { IntentNavigationShell, ShellRouteResolver } from "../IntentNavigationShell";
import { ROUTE_PATHS } from "../RouteConfig";

describe("Intent navigation shell", () => {
  it("renders Build / Explore / Run as primary navigation when intent navigation rollout is enabled", () => {
    const shell = new IntentNavigationShell(new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true", VITE_FEATURE_BUILD_ENTRY: "true" } }));

    const model = shell.resolvePrimaryNavigation({ pathname: ROUTE_PATHS.build });

    expect(model.isIntentNavigationEnabled).toBeTrue();
    expect(model.items.map((item) => item.title)).toEqual(["Build", "Explore", "Run"]);
    expect(model.items.every((item) => item.isIntentPrimary)).toBeTrue();
  });

  it("preserves bounded legacy coexistence when rollout is disabled", () => {
    const shell = new IntentNavigationShell(new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "false", VITE_FEATURE_BUILD_ENTRY: "false" } }));

    const model = shell.resolvePrimaryNavigation({ pathname: ROUTE_PATHS.workflows });

    expect(model.isIntentNavigationEnabled).toBeFalse();
    expect(model.items.some((item) => item.key === "workflows")).toBeTrue();
    expect(model.items.some((item) => item.key === "build")).toBeFalse();
  });


  it("resolves shell-level routes into Build / Explore / Run sections", () => {
    const resolver = new ShellRouteResolver();

    expect(resolver.resolve(ROUTE_PATHS.workflowStudio)?.shellKey).toBe("build");
    expect(resolver.resolve(ROUTE_PATHS.registry)?.shellKey).toBe("explore");
    expect(resolver.resolve(ROUTE_PATHS.tools)?.shellKey).toBe("run");
  });
});
