import type { TaxonomySemanticRole } from "@domain/taxonomy/CompositionTaxonomy";
import {
  createStudioLaunchHandoffContract,
  type StudioLaunchHandoffContract,
} from "../../routes/StudioHandoffContract";

export interface WorkflowStudioSelectorTarget {
  readonly selectorSessionId: string;
  readonly assetType: TaxonomySemanticRole;
  readonly originatingField?: string;
  readonly usageContext?: string;
  readonly selectorTargetId?: string;
}

export interface WorkflowStudioDraftLaunchReference {
  readonly studioId: string;
  readonly draftId?: string;
  readonly sessionId?: string;
  readonly assetId?: string;
  readonly versionId?: string;
}

export interface WorkflowStudioOriginLaunchContext {
  readonly handoffId: string;
  readonly routePath: string;
  readonly routeSearch?: string;
  readonly routeHash?: string;
  readonly returnRoutePath: string;
  readonly selectorTarget: WorkflowStudioSelectorTarget;
  readonly workflow: {
    readonly studioId: string;
    readonly modeId?: string;
    readonly wizardPageId?: string;
    readonly draftReference?: WorkflowStudioDraftLaunchReference;
    readonly draftState?: string;
  };
}

export function createWorkflowStudioOriginLaunchContext(
  input: WorkflowStudioOriginLaunchContext,
): StudioLaunchHandoffContract {
  return createStudioLaunchHandoffContract({
    handoffId: input.handoffId,
    launchSource: "workflow-studio",
    origin: {
      studioType: "workflow-studio",
      studioId: input.workflow.studioId,
      route: {
        path: input.routePath,
        search: input.routeSearch,
        hash: input.routeHash,
      },
      workflowAuthoring: {
        modeId: input.workflow.modeId,
        wizardPageId: input.workflow.wizardPageId,
        draftReference: input.workflow.draftReference,
        draftState: input.workflow.draftState,
      },
    },
    target: {
      selectorSessionId: input.selectorTarget.selectorSessionId,
      assetType: input.selectorTarget.assetType,
      originatingField: input.selectorTarget.originatingField,
      usageContext: input.selectorTarget.usageContext,
      selectorTargetId: input.selectorTarget.selectorTargetId,
    },
    returnTarget: {
      routePath: input.returnRoutePath,
      contextId: input.selectorTarget.selectorSessionId,
    },
  });
}


