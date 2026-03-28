import { describe, expect, it } from "bun:test";
import { BuildEntryFeatureFlag } from "../../features/BuildEntryFeatureFlag";
import { BuildEntryService, BuildIntents } from "../BuildEntry";
import { ROUTE_PATHS } from "../RouteConfig";

describe("Build entry and intent landing seams", () => {
  it("enables and disables Build through feature flags", () => {
    const enabled = new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "true" } });
    const disabled = new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "false" } });

    expect(enabled.isEnabled()).toBeTrue();
    expect(disabled.isEnabled()).toBeFalse();
  });

  it("resolves canonical Build entry path instead of taxonomy-first navigation when enabled", () => {
    const service = new BuildEntryService(new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "true" } }));
    expect(service.resolveBuildEntryRoute()).toBe(ROUTE_PATHS.build);
  });

  it("captures intent selections in structured launch context through shared studio-entry initialization", () => {
    const service = new BuildEntryService(new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "true" } }));
    const launch = service.resolveIntentLaunchContext({
      selection: {
        intent: BuildIntents.automateTask,
        selectedAtIso: "2026-03-28T00:00:00.000Z",
      },
      entryContext: { source: "intent" },
    });

    const query = new URLSearchParams(launch.launchPath.split("?")[1] ?? "");
    expect(launch.launchPath).toContain(ROUTE_PATHS.workflowStudio);
    expect(query.get("entryMode")).toBe("intent");
    expect(query.get("initSource")).toBe("intent");
    expect(query.get("buildIntent")).toBe(BuildIntents.automateTask);
    expect(query.get("buildIntentSelectedAt")).toBe("2026-03-28T00:00:00.000Z");
  });

  it("exposes intent-first landing options and keeps taxonomy suppression in intent-primary mode", () => {
    const service = new BuildEntryService(new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "true" } }));
    const model = service.getLandingModel();
    const labels = model.options.map((option) => option.label);

    expect(model.prompt).toBe("What do you want to build?");
    expect(labels).toEqual([
      "Automate a task",
      "Create an AI assistant",
      "Train a model",
      "Work with data",
      "Start from scratch",
    ]);
    expect(service.shouldSuppressTaxonomyPrimaryLabeling()).toBeTrue();
  });

  it("preserves temporary legacy fallback route when Build rollout is disabled", () => {
    const service = new BuildEntryService(new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "false" } }));
    expect(service.resolveBuildEntryRoute()).toBe(ROUTE_PATHS.workflows);
  });
});

