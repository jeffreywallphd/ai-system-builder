import { WorkflowDraftStepKinds, WorkflowDraftStepTypes, type WorkflowDraftStepAssetReference } from "../../domain/workflow-studio/WorkflowStudioDomain";
import type {
  WorkflowExecutionAssetStepBinding,
  WorkflowExecutionContext,
  WorkflowExecutionStepSequencingMetadata,
  WorkflowExecutionTranslationIssue,
} from "./WorkflowExecutionAlignmentContracts";
import { WorkflowExecutionAssetInvocationKinds, WorkflowExecutionValidationStages } from "./WorkflowExecutionAlignmentContracts";
import type { WorkflowDraftActionExecutionPlanElement } from "./WorkflowDefinitionExecutionPlanTranslator";

export interface BuildWorkflowAssetStepExecutionBindingsRequest {
  readonly actionElements: ReadonlyArray<WorkflowDraftActionExecutionPlanElement>;
  readonly stepSequencing: ReadonlyArray<WorkflowExecutionStepSequencingMetadata>;
  readonly executionContext: WorkflowExecutionContext;
}

export interface BuildWorkflowAssetStepExecutionBindingsResult {
  readonly bindings: ReadonlyArray<WorkflowExecutionAssetStepBinding>;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
}

function toIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly stepId: string;
  readonly path: string;
}): WorkflowExecutionTranslationIssue {
  return Object.freeze({
    code: input.code,
    stage: WorkflowExecutionValidationStages.preExecution,
    severity: "error",
    message: input.message,
    path: input.path,
  });
}

function resolveInvocationKind(
  stepId: string,
  assetRef: WorkflowDraftStepAssetReference,
): {
  readonly invocationKind?: WorkflowExecutionAssetStepBinding["invocationKind"];
  readonly issue?: WorkflowExecutionTranslationIssue;
} {
  if (assetRef.assetKind === WorkflowDraftStepTypes.agentAssistant) {
    return Object.freeze({
      invocationKind: WorkflowExecutionAssetInvocationKinds.agentAssistant,
    });
  }

  return Object.freeze({
    issue: toIssue({
      code: "asset-step-asset-kind-unsupported",
      stepId,
      message: `Asset-backed step '${stepId}' uses unsupported assetKind '${assetRef.assetKind}'.`,
      path: `draft.steps.${stepId}.assetRef.assetKind`,
    }),
  });
}

function buildBinding(input: {
  readonly element: WorkflowDraftActionExecutionPlanElement;
  readonly sequencing: WorkflowExecutionStepSequencingMetadata;
  readonly executionContext: WorkflowExecutionContext;
}): {
  readonly binding?: WorkflowExecutionAssetStepBinding;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
} {
  const issues: WorkflowExecutionTranslationIssue[] = [];
  if (input.element.stepKind !== WorkflowDraftStepKinds.assetBacked) {
    return Object.freeze({
      issues: Object.freeze([]),
    });
  }

  const assetRef = input.element.assetRef;
  if (!assetRef) {
    issues.push(toIssue({
      code: "asset-step-reference-missing",
      stepId: input.element.stepId,
      message: `Asset-backed step '${input.element.stepId}' is missing assetRef.`,
      path: `draft.steps.${input.element.stepId}.assetRef`,
    }));
    return Object.freeze({
      issues: Object.freeze(issues),
    });
  }

  const invocation = resolveInvocationKind(input.element.stepId, assetRef);
  if (!invocation.invocationKind) {
    issues.push(
      invocation.issue
        ?? toIssue({
          code: "asset-step-binding-failed",
          stepId: input.element.stepId,
          message: `Asset-backed step '${input.element.stepId}' invocation binding failed.`,
          path: `draft.steps.${input.element.stepId}`,
        }),
    );
    return Object.freeze({
      issues: Object.freeze(issues),
    });
  }

  const binding: WorkflowExecutionAssetStepBinding = Object.freeze({
    bindingId: `asset-step:${input.element.stepId}`,
    stepId: input.element.stepId,
    stepType: input.element.stepType,
    stepKind: input.element.stepKind,
    order: input.element.order,
    dependsOnStepIds: Object.freeze([...(input.sequencing.dependsOnStepIds ?? [])]),
    invocationKind: invocation.invocationKind,
    asset: Object.freeze({
      assetKind: assetRef.assetKind,
      assetId: assetRef.asset.assetId,
      versionId: assetRef.asset.versionId,
    }),
    inputBinding: Object.freeze({
      config: input.element.config ? Object.freeze({ ...input.element.config }) : undefined,
      resolvedInputValues: Object.freeze({ ...input.executionContext.resolvedInputValues }),
      resolvedInputBindings: Object.freeze({ ...input.executionContext.resolvedInputBindings }),
      resolvedRuntimeInputs: Object.freeze({ ...input.executionContext.resolvedRuntimeInputs }),
      triggerPayload: input.executionContext.triggerPayload
        ? Object.freeze({ ...input.executionContext.triggerPayload })
        : undefined,
      triggerActivation: input.executionContext.triggerActivation
        ? Object.freeze({
          ...input.executionContext.triggerActivation,
          payload: input.executionContext.triggerActivation.payload
            ? Object.freeze({ ...input.executionContext.triggerActivation.payload })
            : undefined,
        })
        : undefined,
      sessionContext: input.executionContext.sessionContext
        ? Object.freeze({ ...input.executionContext.sessionContext })
        : undefined,
      metadata: input.executionContext.metadata
        ? Object.freeze({ ...input.executionContext.metadata })
        : undefined,
    }),
  });

  return Object.freeze({
    binding,
    issues: Object.freeze([]),
  });
}

export function buildWorkflowAssetStepExecutionBindings(
  request: BuildWorkflowAssetStepExecutionBindingsRequest,
): BuildWorkflowAssetStepExecutionBindingsResult {
  const issues: WorkflowExecutionTranslationIssue[] = [];
  const bindings: WorkflowExecutionAssetStepBinding[] = [];
  const sequencingByStepId = new Map(request.stepSequencing.map((entry) => [entry.stepId, entry] as const));

  for (const element of request.actionElements) {
    const sequencing = sequencingByStepId.get(element.stepId);
    if (!sequencing) {
      issues.push(toIssue({
        code: "asset-step-sequencing-missing",
        stepId: element.stepId,
        message: `Execution sequencing metadata is missing for step '${element.stepId}'.`,
        path: `draft.steps.${element.stepId}`,
      }));
      continue;
    }

    const result = buildBinding({
      element,
      sequencing,
      executionContext: request.executionContext,
    });
    issues.push(...result.issues);
    if (result.binding) {
      bindings.push(result.binding);
    }
  }

  return Object.freeze({
    bindings: Object.freeze(bindings),
    issues: Object.freeze(issues),
  });
}

