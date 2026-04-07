import { StudioEntryModes, type StudioEntryContext, type StudioEntryRequest, type StudioEntryResolution } from "../../application/studio-entry/StudioEntryContracts";
import type { TaxonomySemanticRole } from "../../src/domain/taxonomy/CompositionTaxonomy";
import { StudioEntryResolver, StudioEntryService } from "./StudioRouteMapping";
import type { BuildIntent, BuildIntentSelection } from "./BuildIntentModels";

export const BuildIntentFlowTargets = Object.freeze({
  workflowAutomation: "workflow-automation",
  assistantAuthoring: "assistant-authoring",
  modelTraining: "model-training",
  dataPreparation: "data-preparation",
  compositionBlankCanvas: "composition-blank-canvas",
});

export type BuildIntentFlowTarget = typeof BuildIntentFlowTargets[keyof typeof BuildIntentFlowTargets];

export const BuildIntentRoutingReasons = Object.freeze({
  intentAlignedWorkflowFlow: "intent-aligned-workflow-flow",
  intentAlignedAssistantFlow: "intent-aligned-assistant-flow",
  intentAlignedTrainingFlow: "intent-aligned-training-flow",
  intentAlignedDataFlow: "intent-aligned-data-flow",
  intentSafeBlankCompositionFlow: "intent-safe-blank-composition-flow",
});

export type BuildIntentRoutingReason = typeof BuildIntentRoutingReasons[keyof typeof BuildIntentRoutingReasons];

export interface BuildIntentRouteContext {
  readonly selection: BuildIntentSelection;
  readonly entryContext?: StudioEntryContext;
  readonly prefill?: Readonly<Record<string, unknown>>;
}

export interface BuildIntentRouteDecision {
  readonly intent: BuildIntent;
  readonly target: BuildIntentFlowTarget;
  readonly routingReason: BuildIntentRoutingReason;
  readonly studioEntryRequest: StudioEntryRequest;
  readonly studioEntry: StudioEntryResolution;
  readonly launchPath: string;
  readonly launchCategory: "blank" | "asset" | "composition";
}

interface IntentRouteDefinition {
  readonly target: BuildIntentFlowTarget;
  readonly routingReason: BuildIntentRoutingReason;
  readonly launchCategory: BuildIntentRouteDecision["launchCategory"];
  readonly requestedRole?: TaxonomySemanticRole;
  readonly requestedStudioType?: string;
  readonly intentLabel: string;
}

const intentRouteDefinitions: Readonly<Record<BuildIntent, IntentRouteDefinition>> = Object.freeze({
  "automate-task": Object.freeze({
    target: BuildIntentFlowTargets.workflowAutomation,
    routingReason: BuildIntentRoutingReasons.intentAlignedWorkflowFlow,
    launchCategory: "composition",
    requestedRole: "workflow",
    intentLabel: "Automate a task",
  }),
  "create-ai-assistant": Object.freeze({
    target: BuildIntentFlowTargets.assistantAuthoring,
    routingReason: BuildIntentRoutingReasons.intentAlignedAssistantFlow,
    launchCategory: "composition",
    requestedRole: "agent",
    intentLabel: "Create an AI assistant",
  }),
  "train-model": Object.freeze({
    target: BuildIntentFlowTargets.modelTraining,
    routingReason: BuildIntentRoutingReasons.intentAlignedTrainingFlow,
    launchCategory: "composition",
    requestedRole: "training-recipe",
    intentLabel: "Train a model",
  }),
  "work-with-data": Object.freeze({
    target: BuildIntentFlowTargets.dataPreparation,
    routingReason: BuildIntentRoutingReasons.intentAlignedDataFlow,
    launchCategory: "composition",
    requestedRole: "dataset-pipeline",
    intentLabel: "Work with data",
  }),
  "start-from-scratch": Object.freeze({
    target: BuildIntentFlowTargets.compositionBlankCanvas,
    routingReason: BuildIntentRoutingReasons.intentSafeBlankCompositionFlow,
    launchCategory: "blank",
    requestedStudioType: "system-studio",
    intentLabel: "Start from scratch",
  }),
});

function appendIntentSelection(launchPath: string, selection: BuildIntentSelection): string {
  const [path, search] = launchPath.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set("buildIntent", selection.intent);
  params.set("buildIntentSelectedAt", selection.selectedAtIso);
  return `${path}?${params.toString()}`;
}

export class BuildIntentRoutingService {
  private readonly studioEntryResolver = new StudioEntryResolver();
  private readonly studioEntryService = new StudioEntryService();

  public decideRoute(context: BuildIntentRouteContext): BuildIntentRouteDecision {
    const definition = intentRouteDefinitions[context.selection.intent];
    if (!definition) {
      throw new Error(`Build intent ${context.selection.intent} is not supported by the routing engine.`);
    }

    const studioEntryRequest: StudioEntryRequest = {
      requestedRole: definition.requestedRole,
      requestedStudioType: definition.requestedStudioType,
      mode: StudioEntryModes.intent,
      entryContext: context.entryContext ?? { source: "intent" },
      intent: {
        key: context.selection.intent,
        label: definition.intentLabel,
      },
      prefill: context.prefill ? { values: context.prefill } : undefined,
    };

    const studioEntry = this.studioEntryResolver.resolve(studioEntryRequest);
    if (!studioEntry) {
      throw new Error(`Build intent ${context.selection.intent} could not be resolved to a studio entry.`);
    }

    const launchPath = this.studioEntryService.buildStudioRoute(studioEntryRequest);
    if (!launchPath) {
      throw new Error(`Build intent ${context.selection.intent} could not be resolved to a launch route.`);
    }

    return Object.freeze({
      intent: context.selection.intent,
      target: definition.target,
      routingReason: definition.routingReason,
      studioEntryRequest,
      studioEntry,
      launchPath: appendIntentSelection(launchPath, context.selection),
      launchCategory: definition.launchCategory,
    });
  }
}

export class BuildIntentLaunchResolver {
  private readonly routingService = new BuildIntentRoutingService();

  public resolve(context: BuildIntentRouteContext): BuildIntentRouteDecision {
    return this.routingService.decideRoute(context);
  }
}
