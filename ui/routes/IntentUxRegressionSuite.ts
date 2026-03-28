import { BuildEntryService } from "./BuildEntry";
import { BuildIntents } from "./BuildIntentModels";
import { CommandPaletteService } from "./CommandPalette";
import { ContextNavigationService } from "./ContextNavigation";
import { ContextualRecommendationService, ContextualRecommendationSurfaces } from "./ContextualRecommendations";
import { AssetActionExecutionService, AssetIntentActionResolver, AssetIntentActionTypes, type AssetActionContext } from "./AssetIntentActions";
import { ROUTE_PATHS } from "./RouteConfig";
import { RunInterfaceService } from "./RunInterface";

export interface IntentUxScenarioFixture {
  readonly key: string;
  readonly description: string;
}

export interface IntentUxScenarioResult {
  readonly key: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface IntentUxRegressionResult {
  readonly passed: boolean;
  readonly scenarios: ReadonlyArray<IntentUxScenarioResult>;
}

const defaultFixtures: ReadonlyArray<IntentUxScenarioFixture> = Object.freeze([
  Object.freeze({ key: "build-inline-run", description: "Build selection keeps flow context and inline run origin context." }),
  Object.freeze({ key: "explore-detail-actions", description: "Explore detail actions route coherently into Build and Run." }),
  Object.freeze({ key: "command-palette-language", description: "Command palette stays intent-first and free of architecture-first labels." }),
  Object.freeze({ key: "shell-adjacent-surfaces", description: "Onboarding/recommendations/context navigation stay aligned with shell language." }),
]);

export class IntentUxRegressionSuite {
  private readonly buildEntry = new BuildEntryService();
  private readonly runInterface = new RunInterfaceService();
  private readonly commandPalette = new CommandPaletteService();
  private readonly contextNavigation = new ContextNavigationService();
  private readonly recommendations = new ContextualRecommendationService();
  private readonly assetActionResolver = new AssetIntentActionResolver();
  private readonly assetActionExecution = new AssetActionExecutionService();

  constructor(private readonly fixtures: ReadonlyArray<IntentUxScenarioFixture> = defaultFixtures) {}

  public run(): IntentUxRegressionResult {
    const scenarios: IntentUxScenarioResult[] = [];

    const buildLaunch = this.buildEntry.resolveIntentLaunchContext({
      selection: { intent: BuildIntents.automateTask, selectedAtIso: new Date().toISOString() },
      entryContext: { source: "intent" },
    });
    const runLaunch = this.runInterface.resolveLaunchPath({ contextKind: "general", source: "build", actionKind: "run", originPath: ROUTE_PATHS.build, originLabel: "Build" });
    const runParams = new URLSearchParams(runLaunch.split("?")[1] ?? "");
    scenarios.push(Object.freeze({
      key: "build-inline-run",
      passed: buildLaunch.launchPath.includes("buildFlowSessionId=") && runParams.get("originPath") === ROUTE_PATHS.build,
      details: `buildLaunch=${buildLaunch.launchPath}; runLaunch=${runLaunch}`,
    }));

    const assetContext: AssetActionContext = Object.freeze({
      source: "detail",
      asset: Object.freeze({
        assetId: "asset:dataset:1",
        versionId: "v1",
        taxonomy: Object.freeze({ structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" }),
      }),
      currentPathname: "/studio-shell/registry/assets/asset%3Adataset%3A1",
    });
    const actions = this.assetActionResolver.resolveActions(assetContext);
    const openAndModifyPath = this.assetActionExecution.execute(AssetIntentActionTypes.openAndModify, assetContext)?.launchPath;
    const runHerePath = this.assetActionExecution.execute(AssetIntentActionTypes.runHere, assetContext)?.launchPath;
    scenarios.push(Object.freeze({
      key: "explore-detail-actions",
      passed: actions.some((entry) => entry.type === AssetIntentActionTypes.openAndModify) && Boolean(openAndModifyPath) && Boolean(runHerePath),
      details: `openAndModify=${openAndModifyPath ?? "none"}; runHere=${runHerePath ?? "none"}`,
    }));

    const palette = this.commandPalette.resolveDefaultModel({ pathname: ROUTE_PATHS.build, search: "" });
    const paletteText = palette.entries.map((entry) => `${entry.label} ${entry.description}`).join(" ").toLowerCase();
    scenarios.push(Object.freeze({
      key: "command-palette-language",
      passed: !paletteText.includes("taxonomy") && !paletteText.includes("studio shell") && palette.entries.some((entry) => entry.label === "Go to Explore"),
      details: `entryCount=${palette.entries.length}`,
    }));

    const context = this.contextNavigation.resolve({ pathname: ROUTE_PATHS.run, search: "" });
    const recommendationLabels = this.recommendations.resolve({ surface: ContextualRecommendationSurfaces.run }).map((entry) => entry.label.toLowerCase());
    scenarios.push(Object.freeze({
      key: "shell-adjacent-surfaces",
      passed: context.breadcrumbs[0]?.label === "Run" && recommendationLabels.some((label) => label.includes("build")) && recommendationLabels.some((label) => label.includes("assets")),
      details: `breadcrumbs=${context.breadcrumbs.map((crumb) => crumb.label).join(" > ")}`,
    }));

    return Object.freeze({
      passed: scenarios.every((scenario) => scenario.passed),
      scenarios: Object.freeze(scenarios),
    });
  }
}
