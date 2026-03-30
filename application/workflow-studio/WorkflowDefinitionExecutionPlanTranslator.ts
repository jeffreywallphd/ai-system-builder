import {
  normalizeWorkflowDraft,
  normalizeWorkflowDraftBuiltInStepConfig,
  validateWorkflowDraft,
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftStepKinds,
  type WorkflowDraft,
  type WorkflowDraftDelayWaitStepConfig,
  type WorkflowDraftIfThenStepConfig,
  type WorkflowDraftLoopIterationStepConfig,
  type WorkflowDraftManualApprovalStepConfig,
  type WorkflowDraftOutput,
  type WorkflowDraftStep,
} from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createDefaultWorkflowOutputTypeRegistry,
  WorkflowOutputRegistryFieldTargets,
  type WorkflowOutputTypeRegistryEntry,
} from "./WorkflowOutputTypeRegistry";
import {
  mapWorkflowDraftTriggersToExecutionTriggerPlan,
  type WorkflowExecutionTriggerPlan,
} from "./WorkflowDraftTriggerExecutionPlanner";
import {
  createTranslationFailureResult,
  createTranslationSuccessResult,
  mapValidationIssuesToExecutionTranslationIssues,
  mapWorkflowInputToExecutionBinding,
  normalizeWorkflowExecutionContext,
  normalizeWorkflowExecutionRequest,
  WorkflowExecutionValidationStages,
  type WorkflowExecutionOutputBinding,
  type WorkflowExecutionPlanTranslationRequest,
  type WorkflowExecutionPlanTranslationResult,
  type WorkflowExecutionStepSequencingMetadata,
  type WorkflowExecutionTranslationIssue,
  type WorkflowExecutionTriggerDescriptor,
  type WorkflowExecutionTriggerHandoff,
} from "./WorkflowExecutionAlignmentContracts";

export const WorkflowDraftExecutionPlanSchemaVersion = "ai-loom.workflow-draft-execution-plan.v1";

const workflowOutputTypeRegistry = createDefaultWorkflowOutputTypeRegistry();

export interface WorkflowDraftExecutionPlan {
  readonly schemaVersion: typeof WorkflowDraftExecutionPlanSchemaVersion;
  readonly executionRequest: ReturnType<typeof normalizeWorkflowExecutionRequest>;
  readonly executionContext: ReturnType<typeof normalizeWorkflowExecutionContext>;
  readonly triggerHandoff: WorkflowExecutionTriggerHandoff;
  readonly triggers: ReadonlyArray<WorkflowExecutionTriggerPlan>;
  readonly inputBindings: ReadonlyArray<ReturnType<typeof mapWorkflowInputToExecutionBinding>>;
  readonly orderedStepIds: ReadonlyArray<string>;
  readonly stepSequencing: ReadonlyArray<WorkflowExecutionStepSequencingMetadata>;
  readonly elements: ReadonlyArray<WorkflowDraftExecutionPlanElement>;
  readonly outputs: ReadonlyArray<WorkflowDraftExecutionOutputPlan>;
  readonly outputBindings: ReadonlyArray<WorkflowExecutionOutputBinding>;
}

interface WorkflowDraftExecutionPlanElementBase {
  readonly elementType: string;
  readonly stepId: string;
  readonly order: number;
  readonly title?: string;
  readonly dependsOnStepIds?: ReadonlyArray<string>;
}

export interface WorkflowDraftActionExecutionPlanElement extends WorkflowDraftExecutionPlanElementBase {
  readonly elementType: "action-step";
  readonly stepType: string;
  readonly stepKind?: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly assetRef?: WorkflowDraftStep["assetRef"];
}

export interface WorkflowDraftIfThenExecutionPlanElement extends WorkflowDraftExecutionPlanElementBase {
  readonly elementType: "built-in.if-then";
  readonly stepType: typeof WorkflowDraftBuiltInStepTypes.ifThen;
  readonly condition: WorkflowDraftIfThenStepConfig["condition"];
  readonly branches: WorkflowDraftIfThenStepConfig["branches"];
}

export interface WorkflowDraftLoopExecutionPlanElement extends WorkflowDraftExecutionPlanElementBase {
  readonly elementType: "built-in.loop-iteration";
  readonly stepType: typeof WorkflowDraftBuiltInStepTypes.loopIteration;
  readonly mode: WorkflowDraftLoopIterationStepConfig["mode"];
  readonly fixedCount?: WorkflowDraftLoopIterationStepConfig["fixedCount"];
  readonly collection?: WorkflowDraftLoopIterationStepConfig["collection"];
  readonly range?: WorkflowDraftLoopIterationStepConfig["range"];
  readonly exitCondition?: WorkflowDraftLoopIterationStepConfig["exitCondition"];
  readonly loopLabel?: string;
  readonly bodyStepIds?: ReadonlyArray<string>;
  readonly maxIterations?: number;
}

export interface WorkflowDraftDelayExecutionPlanElement extends WorkflowDraftExecutionPlanElementBase {
  readonly elementType: "built-in.delay-wait";
  readonly stepType: typeof WorkflowDraftBuiltInStepTypes.delayWait;
  readonly mode: WorkflowDraftDelayWaitStepConfig["mode"];
  readonly duration?: WorkflowDraftDelayWaitStepConfig["duration"];
  readonly until?: WorkflowDraftDelayWaitStepConfig["until"];
  readonly note?: string;
}

export interface WorkflowDraftManualExecutionPlanElement extends WorkflowDraftExecutionPlanElementBase {
  readonly elementType: "built-in.manual-approval";
  readonly stepType: typeof WorkflowDraftBuiltInStepTypes.manualApproval;
  readonly prompt: string;
  readonly interactionMode: WorkflowDraftManualApprovalStepConfig["interactionMode"];
  readonly outcomes: WorkflowDraftManualApprovalStepConfig["outcomes"];
  readonly requiredApproverRoles?: ReadonlyArray<string>;
  readonly timeoutSeconds?: number;
  readonly onTimeout?: WorkflowDraftManualApprovalStepConfig["onTimeout"];
  readonly allowSelfApproval?: boolean;
}

export type WorkflowDraftExecutionPlanElement =
  | WorkflowDraftActionExecutionPlanElement
  | WorkflowDraftIfThenExecutionPlanElement
  | WorkflowDraftLoopExecutionPlanElement
  | WorkflowDraftDelayExecutionPlanElement
  | WorkflowDraftManualExecutionPlanElement;

export interface WorkflowDraftExecutionOutputPlan {
  readonly outputId: string;
  readonly order: number;
  readonly outputType: WorkflowDraftOutput["outputType"];
  readonly format: WorkflowDraftOutput["format"];
  readonly sourceStepId?: string;
  readonly destination: Readonly<{
    readonly type: WorkflowDraftOutput["destination"]["type"];
    readonly target: string;
    readonly options?: Readonly<Record<string, unknown>>;
  }>;
  readonly configuration?: Readonly<Record<string, unknown>>;
  readonly runtime: Readonly<{
    readonly outputHandlerType: WorkflowDraftOutput["destination"]["type"];
    readonly configSchemaId: string;
    readonly supportsConversationalOutput: boolean;
    readonly conversational?: Readonly<{
      readonly mode: "prompt-response";
      readonly supportsContinuation: boolean;
      readonly promptInputLinkKey: string;
      readonly responseFieldKey: string;
      readonly scopeFieldKey: string;
    }>;
  }>;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function summarizeIssues(issues: ReadonlyArray<WorkflowExecutionTranslationIssue>): string {
  const errorCodes = issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.code);
  if (errorCodes.length === 0) {
    return "translation-failed";
  }
  return errorCodes.slice(0, 5).join(", ");
}

function assertOutputPlanSupported(
  output: WorkflowDraftOutput,
): WorkflowOutputTypeRegistryEntry {
  const registryEntry = workflowOutputTypeRegistry.get(output.destination.type);
  if (!registryEntry) {
    throw new Error(`output-plan-unsupported-type:${output.id}:${output.destination.type}`);
  }

  if (registryEntry.outputType !== output.outputType) {
    throw new Error(`output-plan-output-type-mismatch:${output.id}:${output.outputType}:${registryEntry.outputType}`);
  }

  if (!registryEntry.supportedFormats.includes(output.format)) {
    throw new Error(`output-plan-format-unsupported:${output.id}:${output.format}`);
  }

  const configuration = output.configuration ?? output.destination.options ?? {};
  for (const field of registryEntry.configurationFields) {
    if (!field.required) {
      continue;
    }

    if (field.target === WorkflowOutputRegistryFieldTargets.format) {
      if (!readOptionalString(output.format)) {
        throw new Error(`output-plan-required-field-missing:${output.id}:format`);
      }
      continue;
    }

    if (field.target === WorkflowOutputRegistryFieldTargets.title) {
      if (!readOptionalString(output.title)) {
        throw new Error(`output-plan-required-field-missing:${output.id}:title`);
      }
      continue;
    }

    if (!readOptionalString(configuration[field.key])) {
      throw new Error(`output-plan-required-field-missing:${output.id}:${field.key}`);
    }
  }

  return registryEntry;
}

function toExecutionOutputPlan(
  output: WorkflowDraftOutput,
): WorkflowDraftExecutionOutputPlan {
  const registryEntry = assertOutputPlanSupported(output);
  const configuration = Object.freeze({
    ...(output.configuration ?? output.destination.options ?? {}),
  });
  const destinationOptions = Object.keys(configuration).length > 0 ? configuration : undefined;

  return Object.freeze({
    outputId: output.id,
    order: output.order ?? 1,
    outputType: output.outputType,
    format: output.format,
    sourceStepId: output.sourceStepId,
    destination: Object.freeze({
      type: output.destination.type,
      target: output.destination.target,
      options: destinationOptions,
    }),
    configuration: destinationOptions,
    runtime: Object.freeze({
      outputHandlerType: output.destination.type,
      configSchemaId: registryEntry.configSchemaId,
      supportsConversationalOutput: Boolean(registryEntry.conversational),
      conversational: registryEntry.conversational
        ? Object.freeze({
          mode: registryEntry.conversational.mode,
          supportsContinuation: registryEntry.conversational.supportsContinuation,
          promptInputLinkKey: registryEntry.conversational.promptInputLinkKey,
          responseFieldKey: registryEntry.conversational.responseFieldKey,
          scopeFieldKey: registryEntry.conversational.scopeFieldKey,
        })
        : undefined,
    }),
  });
}

function toOutputBinding(output: WorkflowDraftOutput): WorkflowExecutionOutputBinding {
  return Object.freeze({
    outputId: output.id,
    outputType: output.outputType,
    format: output.format,
    sourceStepId: output.sourceStepId,
    destinationType: output.destination.type,
    target: output.destination.target,
    options: output.configuration ?? output.destination.options,
  });
}

function toStepSequencing(step: WorkflowDraftStep): WorkflowExecutionStepSequencingMetadata {
  const base: Omit<WorkflowExecutionStepSequencingMetadata, "controlFlow"> = Object.freeze({
    stepId: step.id,
    stepType: step.type,
    stepKind: step.kind,
    order: step.order,
    dependsOnStepIds: Object.freeze([...(step.dependsOnStepIds ?? [])]),
  });

  if (step.kind !== WorkflowDraftStepKinds.controlFlow) {
    return base;
  }

  if (!step.config) {
    return base;
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.ifThen) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.ifThen,
      step.config as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftIfThenStepConfig;
    return Object.freeze({
      ...base,
      controlFlow: Object.freeze({
        branchStepIds: Object.freeze({
          then: Object.freeze([...(config.branches.then.stepIds ?? [])]),
          else: Object.freeze([...(config.branches.else?.stepIds ?? [])]),
        }),
      }),
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.loopIteration) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.loopIteration,
      step.config as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftLoopIterationStepConfig;
    return Object.freeze({
      ...base,
      controlFlow: Object.freeze({
        loopBodyStepIds: Object.freeze([...(config.bodyStepIds ?? [])]),
      }),
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.manualApproval) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.manualApproval,
      step.config as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftManualApprovalStepConfig;
    return Object.freeze({
      ...base,
      controlFlow: Object.freeze({
        manualOutcomeStepIds: Object.freeze({
          continue: Object.freeze([...(config.outcomes.continue?.stepIds ?? [])]),
          approve: Object.freeze([...(config.outcomes.approve?.stepIds ?? [])]),
          reject: Object.freeze([...(config.outcomes.reject?.stepIds ?? [])]),
        }),
      }),
    });
  }

  return base;
}

function toPlanElement(step: WorkflowDraftStep): WorkflowDraftExecutionPlanElement {
  const base = Object.freeze({
    stepId: step.id,
    order: step.order,
    title: step.title,
    dependsOnStepIds: step.dependsOnStepIds,
  });

  if (step.kind !== WorkflowDraftStepKinds.controlFlow) {
    return Object.freeze({
      ...base,
      elementType: "action-step" as const,
      stepType: step.type,
      stepKind: step.kind,
      config: step.config,
      assetRef: step.assetRef,
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.ifThen) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.ifThen,
      (step.config ?? {}) as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftIfThenStepConfig;
    return Object.freeze({
      ...base,
      elementType: "built-in.if-then" as const,
      stepType: WorkflowDraftBuiltInStepTypes.ifThen,
      condition: config.condition,
      branches: config.branches,
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.loopIteration) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.loopIteration,
      (step.config ?? {}) as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftLoopIterationStepConfig;
    return Object.freeze({
      ...base,
      elementType: "built-in.loop-iteration" as const,
      stepType: WorkflowDraftBuiltInStepTypes.loopIteration,
      mode: config.mode,
      fixedCount: config.fixedCount,
      collection: config.collection,
      range: config.range,
      exitCondition: config.exitCondition,
      loopLabel: config.loopLabel,
      bodyStepIds: config.bodyStepIds,
      maxIterations: config.maxIterations,
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.delayWait) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.delayWait,
      (step.config ?? {}) as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftDelayWaitStepConfig;
    return Object.freeze({
      ...base,
      elementType: "built-in.delay-wait" as const,
      stepType: WorkflowDraftBuiltInStepTypes.delayWait,
      mode: config.mode,
      duration: config.duration,
      until: config.until,
      note: config.note,
    });
  }

  if (step.type === WorkflowDraftBuiltInStepTypes.manualApproval) {
    const config = normalizeWorkflowDraftBuiltInStepConfig(
      WorkflowDraftBuiltInStepTypes.manualApproval,
      (step.config ?? {}) as Readonly<Record<string, unknown>>,
    ) as WorkflowDraftManualApprovalStepConfig;
    return Object.freeze({
      ...base,
      elementType: "built-in.manual-approval" as const,
      stepType: WorkflowDraftBuiltInStepTypes.manualApproval,
      prompt: config.prompt,
      interactionMode: config.interactionMode,
      outcomes: config.outcomes,
      requiredApproverRoles: config.requiredApproverRoles,
      timeoutSeconds: config.timeoutSeconds,
      onTimeout: config.onTimeout,
      allowSelfApproval: config.allowSelfApproval,
    });
  }

  return Object.freeze({
    ...base,
    elementType: "action-step" as const,
    stepType: step.type,
    stepKind: step.kind,
    config: step.config,
    assetRef: step.assetRef,
  });
}

function toTriggerDescriptor(trigger: WorkflowExecutionTriggerPlan): WorkflowExecutionTriggerDescriptor {
  return Object.freeze({
    triggerId: trigger.triggerId,
    runtimeKind: trigger.runtimeKind,
    triggerKind: trigger.triggerKind,
    triggerType: trigger.triggerType,
  });
}

function buildTriggerHandoff(input: {
  readonly triggers: ReadonlyArray<WorkflowExecutionTriggerPlan>;
  readonly activation?: ReturnType<typeof normalizeWorkflowExecutionContext>["triggerActivation"];
}): WorkflowExecutionTriggerHandoff {
  return Object.freeze({
    handoffMode: input.activation ? "activated" : "await-trigger",
    availableTriggers: Object.freeze(input.triggers.map((trigger) => toTriggerDescriptor(trigger))),
    activation: input.activation,
  });
}

export function translateWorkflowDefinitionToExecutionPlan(
  request: WorkflowExecutionPlanTranslationRequest,
): WorkflowExecutionPlanTranslationResult<WorkflowDraftExecutionPlan> {
  const normalizedDraft = normalizeWorkflowDraft(request.draft);
  const normalizedRequest = normalizeWorkflowExecutionRequest(request.request);
  const normalizedContext = normalizeWorkflowExecutionContext(request.context);

  const validation = validateWorkflowDraft(normalizedDraft);
  if (!validation.valid) {
    return createTranslationFailureResult({
      issues: mapValidationIssuesToExecutionTranslationIssues(validation.issues),
      stage: WorkflowExecutionValidationStages.preTranslation,
    });
  }

  const orderedSteps = [...normalizedDraft.steps].sort((left, right) => left.order - right.order);
  const orderedOutputs = [...normalizedDraft.outputs].sort((left, right) => left.order - right.order);

  try {
    const triggerPlans = mapWorkflowDraftTriggersToExecutionTriggerPlan(normalizedDraft);
    const inputBindings = Object.freeze(normalizedDraft.inputs.map((input) => mapWorkflowInputToExecutionBinding(input)));
    const stepSequencing = Object.freeze(orderedSteps.map((step) => toStepSequencing(step)));
    const outputBindings = Object.freeze(orderedOutputs.map((output) => toOutputBinding(output)));

    const plan: WorkflowDraftExecutionPlan = Object.freeze({
      schemaVersion: WorkflowDraftExecutionPlanSchemaVersion,
      executionRequest: normalizedRequest,
      executionContext: normalizedContext,
      triggerHandoff: buildTriggerHandoff({
        triggers: triggerPlans,
        activation: normalizedContext.triggerActivation,
      }),
      triggers: triggerPlans,
      inputBindings,
      orderedStepIds: Object.freeze(orderedSteps.map((step) => step.id)),
      stepSequencing,
      elements: Object.freeze(orderedSteps.map((step) => toPlanElement(step))),
      outputs: Object.freeze(orderedOutputs.map((output) => toExecutionOutputPlan(output))),
      outputBindings,
    });

    return createTranslationSuccessResult(plan);
  } catch (error) {
    return createTranslationFailureResult({
      issues: Object.freeze([Object.freeze({
        code: error instanceof Error ? error.message.split(":")[0] : "workflow-definition-translation-failed",
        stage: WorkflowExecutionValidationStages.preTranslation,
        severity: "error",
        message: error instanceof Error ? error.message : "Workflow definition translation failed.",
      })]),
      stage: WorkflowExecutionValidationStages.preTranslation,
    });
  }
}

export function mapWorkflowDraftToExecutionPlan(
  draft: WorkflowDraft,
): WorkflowDraftExecutionPlan {
  const translation = translateWorkflowDefinitionToExecutionPlan({ draft });
  if (!translation.success || !translation.plan) {
    throw new Error(
      `Workflow draft execution planning requires a valid canonical draft: ${summarizeIssues(translation.issues)}.`,
    );
  }
  return translation.plan;
}

