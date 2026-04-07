import { BuildEntryService } from "./BuildEntry";
import { BuildIntents } from "./BuildIntentModels";
import { CommandPaletteService } from "./CommandPalette";
import { ContextNavigationService } from "./ContextNavigation";
import { ContextualRecommendationService, ContextualRecommendationSurfaces } from "./ContextualRecommendations";
import { GuidedOnboardingFlow } from "./GuidedOnboardingFlow";
import { IntentNavigationShell } from "./IntentNavigationShell";
import { RecentAndFavoritesService, type RecentAndFavoritesState } from "./RecentAndFavorites";
import { ROUTE_PATHS } from "./RouteConfig";
import { RunInterfaceService } from "./RunInterface";
import { BuildEntryFeatureFlag } from "../features/BuildEntryFeatureFlag";
import { IntentNavigationFeatureFlag } from "../features/IntentNavigationFeatureFlag";
import type { OnboardingProgressStorage } from "./GuidedOnboardingFlow";

export interface UxPresentationConsistencyRule {
  readonly key: string;
  readonly description: string;
}

export interface UxConsistencyIssue {
  readonly ruleKey: string;
  readonly message: string;
}

export interface UxConsistencyAuditResult {
  readonly passed: boolean;
  readonly evaluatedRuleCount: number;
  readonly issues: ReadonlyArray<UxConsistencyIssue>;
}

const defaultRules: ReadonlyArray<UxPresentationConsistencyRule> = Object.freeze([
  Object.freeze({ key: "primary-shell-labels", description: "Primary shell labels stay Build / Explore / Run in all intent-first navigation surfaces." }),
  Object.freeze({ key: "taxonomy-suppression", description: "Taxonomy wording is not exposed as primary intent UX labels in shell and command surfaces." }),
  Object.freeze({ key: "route-continuity", description: "Build-to-Run and Explore-to-Build/Run transitions preserve context and return links." }),
  Object.freeze({ key: "onboarding-language", description: "Onboarding language matches Build / Explore / Run vocabulary." }),
  Object.freeze({ key: "recommendation-language", description: "Recommendation labels use intent-first language and avoid studio-first wording." }),
]);

function createIssue(ruleKey: string, message: string): UxConsistencyIssue {
  return Object.freeze({ ruleKey, message });
}

export class UxConsistencyPolicy {
  private readonly buildEntryService: BuildEntryService;
  private readonly shell: IntentNavigationShell;
  private readonly commandPalette = new CommandPaletteService();
  private readonly contextNavigation = new ContextNavigationService();
  private readonly onboarding: GuidedOnboardingFlow;
  private readonly recommendations = new ContextualRecommendationService();
  private readonly runInterface = new RunInterfaceService();

  constructor(private readonly rules: ReadonlyArray<UxPresentationConsistencyRule> = defaultRules) {
    const buildFeatureFlag = new BuildEntryFeatureFlag({ env: { VITE_FEATURE_BUILD_ENTRY: "true" } });
    const intentFeatureFlag = new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true", VITE_FEATURE_BUILD_ENTRY: "true" } });
    this.buildEntryService = new BuildEntryService(buildFeatureFlag);
    this.shell = new IntentNavigationShell(intentFeatureFlag);
    const onboardingStore: OnboardingProgressStorage = {
      load: () => Object.freeze({ isCompleted: false, isDismissed: false }),
      save: () => undefined,
    };
    this.onboarding = new GuidedOnboardingFlow(undefined, onboardingStore);
  }

  public evaluate(): UxConsistencyAuditResult {
    const issues: UxConsistencyIssue[] = [];

    const navModel = this.shell.resolvePrimaryNavigation({ pathname: ROUTE_PATHS.build });
    const navTitles = navModel.items.map((item) => item.title);
    if (JSON.stringify(navTitles) !== JSON.stringify(["Build", "Explore", "Run"])) {
      issues.push(createIssue("primary-shell-labels", `Expected Build/Explore/Run primary labels but found: ${navTitles.join(", ") || "none"}.`));
    }

    const commandModel = this.commandPalette.resolveDefaultModel({ pathname: ROUTE_PATHS.build, search: "" });
    const paletteLabelText = commandModel.entries.map((entry) => `${entry.label} ${entry.description}`).join(" ").toLowerCase();
    if (paletteLabelText.includes("taxonomy") || paletteLabelText.includes("semantic role") || paletteLabelText.includes("behavior kind")) {
      issues.push(createIssue("taxonomy-suppression", "Command palette surfaced taxonomy-first terminology."));
    }

    const launchContext = this.buildEntryService.resolveIntentLaunchContext({
      selection: { intent: this.buildEntryService.getLandingModel().options[0]?.intent ?? BuildIntents.automateTask, selectedAtIso: new Date().toISOString() },
      entryContext: { source: "intent" },
    });
    const runFromBuild = this.runInterface.resolveLaunchPath({ contextKind: "general", source: "build", originPath: ROUTE_PATHS.build, originLabel: "Build" });
    const runParams = new URLSearchParams(runFromBuild.split("?")[1] ?? "");
    if (!launchContext.launchPath.includes("buildFlowSessionId=") || runParams.get("originPath") !== ROUTE_PATHS.build) {
      issues.push(createIssue("route-continuity", "Build flow session or Build-origin run context was not preserved."));
    }

    const exploreContext = this.contextNavigation.resolve({ pathname: "/studio-shell/registry/assets/asset-1", search: "?assetId=asset-1&registryContext=q%3Ddemo" });
    if (exploreContext.returnPath !== "/explore?q=demo") {
      issues.push(createIssue("route-continuity", `Expected Explore return path '/explore?q=demo' but received '${exploreContext.returnPath ?? "none"}'.`));
    }

    const onboardingState = this.onboarding.resolveState({ pathname: ROUTE_PATHS.build });
    const onboardingText = onboardingState.steps.map((step) => `${step.title} ${step.description}`).join(" ").toLowerCase();
    if (onboardingText.includes("registry") || onboardingText.includes("studio shell")) {
      issues.push(createIssue("onboarding-language", "Onboarding surfaced legacy registry/studio-shell wording in primary steps."));
    }

    const recommendationText = this.recommendations
      .resolve({ surface: ContextualRecommendationSurfaces.build })
      .map((entry) => `${entry.label} ${entry.description}`)
      .join(" ")
      .toLowerCase();
    if (recommendationText.includes("studio shell") || recommendationText.includes("taxonomy")) {
      issues.push(createIssue("recommendation-language", "Contextual recommendations surfaced architecture-first wording."));
    }

    return Object.freeze({
      passed: issues.length === 0,
      evaluatedRuleCount: this.rules.length,
      issues: Object.freeze(issues),
    });
  }
}

class InMemoryRecentAndFavoritesStore {
  private state: RecentAndFavoritesState = Object.freeze({ recents: Object.freeze([]), favorites: Object.freeze([]) });

  public load(): RecentAndFavoritesState {
    return this.state;
  }

  public save(state: RecentAndFavoritesState): void {
    this.state = state;
  }
}

export class UxConsistencyRecentStateProbe {
  constructor(private readonly service: RecentAndFavoritesService = new RecentAndFavoritesService(new InMemoryRecentAndFavoritesStore())) {}

  public recordRepresentativeState(): RecentAndFavoritesState {
    this.service.recordRecentBuildFlow({ intent: BuildIntents.createAiAssistant, launchPath: ROUTE_PATHS.build });
    this.service.recordRecentAsset({ assetId: "asset:demo:1", title: "Demo asset", launchPath: "/studio-shell/registry/assets/asset%3Ademo%3A1" });
    this.service.recordRecentRunContext({ request: { contextKind: "general", source: "direct", runIntentLabel: "Run and test" }, launchPath: ROUTE_PATHS.run });
    return this.service.listState();
  }
}
