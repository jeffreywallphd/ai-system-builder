import {
  UxTaxonomyPresentationModes,
  UxTaxonomySuppressionPolicy,
  UxTaxonomyVisibilityRules,
} from "../taxonomy/UxTaxonomySuppression";
import type { StudioEntryContext } from "../../application/studio-entry/StudioEntryContracts";
import { BuildEntryFeatureFlag } from "../features/BuildEntryFeatureFlag";
import { ROUTE_PATHS } from "./RouteConfig";
import {
  type BuildIntentSelection,
  type BuildLandingPageModel,
  BuildIntentOptions,
} from "./BuildIntentModels";
import { BuildFlowContextService, BuildFlowStateStore, type BuildFlowSession } from "./BuildFlowState";
import { BuildIntentLaunchResolver, type BuildIntentRouteDecision } from "./BuildIntentRouting";

export { BuildIntents, type BuildIntent, type BuildIntentOption, type BuildIntentSelection, type BuildLandingPageModel } from "./BuildIntentModels";

export interface BuildIntentLaunchContext {
  readonly selection: BuildIntentSelection;
  readonly routeDecision: BuildIntentRouteDecision;
  readonly flowSession: BuildFlowSession;
  readonly launchPath: string;
}

export interface BuildEntryLaunchRequest {
  readonly selection: BuildIntentSelection;
  readonly entryContext?: StudioEntryContext;
  readonly prefill?: Readonly<Record<string, unknown>>;
}

function appendFlowSession(launchPath: string, flowSession: BuildFlowSession): string {
  const [path, search] = launchPath.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("buildFlowSessionId", flowSession.sessionId);
  params.set("buildFlowProgress", flowSession.current.progress);
  return `${path}?${params.toString()}`;
}

export class BuildEntryService {
  private readonly featureFlag: BuildEntryFeatureFlag;
  private readonly launchResolver = new BuildIntentLaunchResolver();
  private readonly flowContextService: BuildFlowContextService;

  constructor(featureFlag = new BuildEntryFeatureFlag(), flowStateStore = new BuildFlowStateStore()) {
    this.featureFlag = featureFlag;
    this.flowContextService = new BuildFlowContextService(flowStateStore);
  }

  public isBuildEntryEnabled(): boolean {
    return this.featureFlag.isEnabled();
  }

  public resolveBuildEntryRoute(): string {
    return this.isBuildEntryEnabled() ? ROUTE_PATHS.build : ROUTE_PATHS.workflows;
  }

  public getLandingModel(): BuildLandingPageModel {
    return Object.freeze({
      title: "Build",
      subtitle: "Start from your goal, then let AI Loom Studio open the right build flow.",
      prompt: "What do you want to build?",
      options: BuildIntentOptions,
    });
  }

  public resolveIntentLaunchContext(request: BuildEntryLaunchRequest): BuildIntentLaunchContext {
    const routeDecision = this.launchResolver.resolve({
      selection: request.selection,
      entryContext: request.entryContext,
      prefill: request.prefill,
    });

    const flowSession = this.flowContextService.startSessionFromRouteDecision(request.selection, routeDecision);

    return Object.freeze({
      selection: request.selection,
      routeDecision,
      flowSession,
      launchPath: appendFlowSession(routeDecision.launchPath, flowSession),
    });
  }

  public getFlowSession(sessionId: string): BuildFlowSession | undefined {
    return this.flowContextService.getSession(sessionId);
  }

  public shouldSuppressTaxonomyPrimaryLabeling(): boolean {
    const mode = new UxTaxonomySuppressionPolicy().resolvePresentationMode(UxTaxonomyVisibilityRules.primaryNavigation);
    return mode === UxTaxonomyPresentationModes.intentPrimary;
  }
}
