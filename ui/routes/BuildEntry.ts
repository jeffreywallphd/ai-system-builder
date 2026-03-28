import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import {
  UxTaxonomyPresentationModes,
  UxTaxonomySuppressionPolicy,
  UxTaxonomyVisibilityRules,
} from "../taxonomy/UxTaxonomySuppression";
import { StudioEntryModes, type StudioEntryContext, type StudioEntryRequest } from "../../application/studio-entry/StudioEntryContracts";
import { BuildEntryFeatureFlag } from "../features/BuildEntryFeatureFlag";
import { ROUTE_PATHS } from "./RouteConfig";
import { StudioEntryService } from "./StudioRouteMapping";

export const BuildIntents = Object.freeze({
  automateTask: "automate-task",
  createAssistant: "create-ai-assistant",
  trainModel: "train-model",
  workWithData: "work-with-data",
  startFromScratch: "start-from-scratch",
});

export type BuildIntent = typeof BuildIntents[keyof typeof BuildIntents];

export interface BuildIntentOption {
  readonly intent: BuildIntent;
  readonly label: string;
  readonly description: string;
  readonly callToAction: string;
}

export interface BuildIntentSelection {
  readonly intent: BuildIntent;
  readonly selectedAtIso: string;
}

export interface BuildLandingPageModel {
  readonly title: string;
  readonly subtitle: string;
  readonly prompt: string;
  readonly options: ReadonlyArray<BuildIntentOption>;
}

export interface BuildIntentLaunchContext {
  readonly selection: BuildIntentSelection;
  readonly launchPath: string;
}

export interface BuildEntryLaunchRequest {
  readonly selection: BuildIntentSelection;
  readonly entryContext?: StudioEntryContext;
  readonly prefill?: Readonly<Record<string, unknown>>;
}

interface IntentResolution {
  readonly requestedRole?: TaxonomySemanticRole;
  readonly requestedStudioType?: string;
  readonly label: string;
}

const intentOptions: ReadonlyArray<BuildIntentOption> = Object.freeze([
  Object.freeze({
    intent: BuildIntents.automateTask,
    label: "Automate a task",
    description: "Set up a repeatable AI flow for a business process.",
    callToAction: "Start automation",
  }),
  Object.freeze({
    intent: BuildIntents.createAssistant,
    label: "Create an AI assistant",
    description: "Design an assistant that can reason with your tools and context.",
    callToAction: "Start assistant",
  }),
  Object.freeze({
    intent: BuildIntents.trainModel,
    label: "Train a model",
    description: "Prepare and launch a model training path with guided defaults.",
    callToAction: "Start training",
  }),
  Object.freeze({
    intent: BuildIntents.workWithData,
    label: "Work with data",
    description: "Shape and prepare datasets for analytics, AI, and downstream tasks.",
    callToAction: "Start data flow",
  }),
  Object.freeze({
    intent: BuildIntents.startFromScratch,
    label: "Start from scratch",
    description: "Open a blank build workspace and decide the details as you go.",
    callToAction: "Open blank workspace",
  }),
]);

function resolveIntent(intent: BuildIntent): IntentResolution {
  switch (intent) {
    case BuildIntents.automateTask:
      return Object.freeze({ requestedRole: "workflow", label: "Automate a task" });
    case BuildIntents.createAssistant:
      return Object.freeze({ requestedRole: "agent", label: "Create an AI assistant" });
    case BuildIntents.trainModel:
      return Object.freeze({ requestedRole: "training-recipe", label: "Train a model" });
    case BuildIntents.workWithData:
      return Object.freeze({ requestedRole: "dataset-pipeline", label: "Work with data" });
    case BuildIntents.startFromScratch:
      return Object.freeze({ requestedStudioType: "workflow-studio", label: "Start from scratch" });
    default:
      return Object.freeze({ requestedStudioType: "workflow-studio", label: "Start from scratch" });
  }
}

function appendIntentSelection(launchPath: string, selection: BuildIntentSelection): string {
  const [path, search] = launchPath.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("buildIntent", selection.intent);
  params.set("buildIntentSelectedAt", selection.selectedAtIso);
  return `${path}?${params.toString()}`;
}

export class BuildEntryService {
  private readonly studioEntryService = new StudioEntryService();
  private readonly featureFlag: BuildEntryFeatureFlag;

  constructor(featureFlag = new BuildEntryFeatureFlag()) {
    this.featureFlag = featureFlag;
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
      options: intentOptions,
    });
  }

  public resolveIntentLaunchContext(request: BuildEntryLaunchRequest): BuildIntentLaunchContext {
    const intentResolution = resolveIntent(request.selection.intent);
    const entryRequest: StudioEntryRequest = {
      requestedRole: intentResolution.requestedRole,
      requestedStudioType: intentResolution.requestedStudioType,
      mode: StudioEntryModes.intent,
      entryContext: request.entryContext ?? { source: "intent" },
      intent: {
        key: request.selection.intent,
        label: intentResolution.label,
      },
      prefill: request.prefill ? { values: request.prefill } : undefined,
    };

    const launchPath = this.studioEntryService.buildStudioRoute(entryRequest);
    if (!launchPath) {
      throw new Error(`Build intent ${request.selection.intent} could not be resolved to a launch route.`);
    }

    return Object.freeze({
      selection: request.selection,
      launchPath: appendIntentSelection(launchPath, request.selection),
    });
  }

  public shouldSuppressTaxonomyPrimaryLabeling(): boolean {
    const mode = new UxTaxonomySuppressionPolicy().resolvePresentationMode(UxTaxonomyVisibilityRules.primaryNavigation);
    return mode === UxTaxonomyPresentationModes.intentPrimary;
  }
}

