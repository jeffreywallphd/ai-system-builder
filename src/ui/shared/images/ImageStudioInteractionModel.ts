export const ImageStudioFlowStepIds = Object.freeze({
  selectImage: "select-image",
  selectWorkflow: "select-workflow",
  configureParameters: "configure-parameters",
  assessReadiness: "assess-readiness",
  launchRun: "launch-run",
  monitorRun: "monitor-run",
  reviewResults: "review-results",
});

export type ImageStudioFlowStepId = typeof ImageStudioFlowStepIds[keyof typeof ImageStudioFlowStepIds];

export const ImageStudioFlowStepSequence = Object.freeze([
  ImageStudioFlowStepIds.selectImage,
  ImageStudioFlowStepIds.selectWorkflow,
  ImageStudioFlowStepIds.configureParameters,
  ImageStudioFlowStepIds.assessReadiness,
  ImageStudioFlowStepIds.launchRun,
  ImageStudioFlowStepIds.monitorRun,
  ImageStudioFlowStepIds.reviewResults,
]);

export type ImageStudioRunStatus =
  | "queued"
  | "preparing"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ImageStudioInputSelection {
  readonly selectionId: string;
  readonly sourceKind: "dataset-item" | "asset-version" | "result-record";
  readonly assetId: string;
  readonly versionId?: string;
  readonly datasetInstanceId?: string;
  readonly recordId?: string;
  readonly previewUrl?: string;
}

export interface ImageStudioWorkflowSelection {
  readonly workflowId: string;
  readonly workflowVersionId?: string;
  readonly systemId: string;
  readonly systemVersionId?: string;
  readonly parameterDefaults: Readonly<Record<string, unknown>>;
}

export interface ImageStudioReadinessIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "blocking" | "advisory";
}

export interface ImageStudioReadinessSnapshot {
  readonly assessedAtIso: string;
  readonly ready: boolean;
  readonly issues: ReadonlyArray<ImageStudioReadinessIssue>;
}

export interface ImageStudioRunSummary {
  readonly runId: string;
  readonly status: ImageStudioRunStatus;
  readonly requestedAtIso: string;
  readonly updatedAtIso: string;
  readonly workflowId: string;
  readonly sourceSelectionId: string;
  readonly resultDatasetInstanceId?: string;
}

export interface ImageStudioResultItem {
  readonly resultId: string;
  readonly recordId: string;
  readonly imageReference: string;
  readonly previewReference?: string;
  readonly runId: string;
}

export interface ImageStudioResultCollection {
  readonly datasetInstanceId: string;
  readonly items: ReadonlyArray<ImageStudioResultItem>;
  readonly resolvedAtIso: string;
}

export interface ImageStudioAuthoritativeState {
  readonly continuationSessionId?: string;
  readonly inputSelection?: ImageStudioInputSelection;
  readonly workflowSelection?: ImageStudioWorkflowSelection;
  readonly committedParameters: Readonly<Record<string, unknown>>;
  readonly readiness?: ImageStudioReadinessSnapshot;
  readonly activeRun?: ImageStudioRunSummary;
  readonly runHistory: ReadonlyArray<ImageStudioRunSummary>;
  readonly results?: ImageStudioResultCollection;
}

export interface ImageStudioTransientUiState {
  readonly parameterDraft: Readonly<Record<string, unknown>>;
  readonly parameterDraftDirty: boolean;
  readonly focusedStepId?: ImageStudioFlowStepId;
  readonly pollingRunStatus: boolean;
  readonly pendingReadinessRequest: boolean;
  readonly pendingLaunchRequest: boolean;
  readonly selectedResultId?: string;
  readonly reusableInputResultId?: string;
}

export interface ImageStudioDerivedStepGate {
  readonly stepId: ImageStudioFlowStepId;
  readonly blockers: ReadonlyArray<string>;
}

export interface ImageStudioDerivedPresentationState {
  readonly currentStepId: ImageStudioFlowStepId;
  readonly completedStepIds: ReadonlyArray<ImageStudioFlowStepId>;
  readonly stepGates: ReadonlyArray<ImageStudioDerivedStepGate>;
  readonly canLaunchRun: boolean;
  readonly canReviewResults: boolean;
  readonly runMonitorState: "idle" | "active" | "terminal";
}

export interface ImageStudioInteractionTransition {
  readonly actionType: ImageStudioInteractionAction["type"];
  readonly atIso: string;
  readonly resolvedStepId: ImageStudioFlowStepId;
}

export interface ImageStudioInteractionState {
  readonly authoritative: ImageStudioAuthoritativeState;
  readonly transient: ImageStudioTransientUiState;
  readonly derived: ImageStudioDerivedPresentationState;
  readonly transitions: ReadonlyArray<ImageStudioInteractionTransition>;
}

export interface ImageStudioAuthoritativeApiContract {
  readonly ingestReferenceImageUpload: () => Promise<unknown>;
  readonly listReferenceImageDatasetItems: () => Promise<unknown>;
  readonly listImageWorkflowDefinitions: () => Promise<unknown>;
  readonly listImageSystemDefinitions: () => Promise<unknown>;
  readonly assessWorkflowExecutionReadiness: () => Promise<unknown>;
  readonly runWorkflowDraft: () => Promise<unknown>;
  readonly listReferenceImageRunHistory: () => Promise<unknown>;
  readonly listReferenceImageOutputs: () => Promise<unknown>;
  readonly chainReferenceImageDatasetItemToInput: () => Promise<unknown>;
}

export type ImageStudioInteractionAction =
  | { readonly type: "hydrate-authoritative"; readonly authoritative: Partial<ImageStudioAuthoritativeState> }
  | { readonly type: "resume-session"; readonly continuationSessionId: string; readonly runId?: string }
  | { readonly type: "select-input-image"; readonly selection: ImageStudioInputSelection }
  | { readonly type: "clear-input-image" }
  | { readonly type: "select-workflow-system"; readonly selection: ImageStudioWorkflowSelection }
  | { readonly type: "set-parameter-draft"; readonly values: Readonly<Record<string, unknown>> }
  | { readonly type: "commit-parameter-draft" }
  | { readonly type: "readiness-requested" }
  | { readonly type: "readiness-resolved"; readonly readiness: ImageStudioReadinessSnapshot }
  | { readonly type: "run-launch-requested" }
  | { readonly type: "run-launch-accepted"; readonly run: ImageStudioRunSummary }
  | { readonly type: "run-status-updated"; readonly runId: string; readonly status: ImageStudioRunStatus; readonly updatedAtIso: string }
  | { readonly type: "run-history-synchronized"; readonly runs: ReadonlyArray<ImageStudioRunSummary> }
  | { readonly type: "results-synchronized"; readonly results: ImageStudioResultCollection }
  | { readonly type: "focus-step"; readonly stepId?: ImageStudioFlowStepId }
  | { readonly type: "select-result"; readonly resultId?: string }
  | { readonly type: "mark-result-reusable"; readonly resultId?: string };

export function createInitialImageStudioInteractionState(
  seed?: Partial<ImageStudioInteractionState>,
): ImageStudioInteractionState {
  const authoritative = freezeAuthoritativeState(seed?.authoritative);
  const transient = freezeTransientState(seed?.transient, authoritative);
  const derived = deriveImageStudioPresentationState(authoritative, transient);
  return Object.freeze({
    authoritative,
    transient,
    derived,
    transitions: Object.freeze([...(seed?.transitions ?? [])]),
  });
}

export function reduceImageStudioInteractionState(
  state: ImageStudioInteractionState,
  action: ImageStudioInteractionAction,
  atIso = new Date().toISOString(),
): ImageStudioInteractionState {
  let authoritative = state.authoritative;
  let transient = state.transient;

  switch (action.type) {
    case "hydrate-authoritative": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        ...action.authoritative,
      });
      transient = freezeTransientState({
        ...state.transient,
        parameterDraft: action.authoritative.committedParameters ?? state.transient.parameterDraft,
        parameterDraftDirty: false,
      }, authoritative);
      break;
    }
    case "resume-session": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        continuationSessionId: action.continuationSessionId,
        activeRun: action.runId
          ? state.authoritative.runHistory.find((run) => run.runId === action.runId) ?? state.authoritative.activeRun
          : state.authoritative.activeRun,
      });
      transient = freezeTransientState({
        ...state.transient,
        pollingRunStatus: true,
      }, authoritative);
      break;
    }
    case "select-input-image": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        inputSelection: action.selection,
        readiness: undefined,
        activeRun: undefined,
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        selectedResultId: undefined,
        reusableInputResultId: undefined,
        pendingLaunchRequest: false,
        pollingRunStatus: false,
      }, authoritative);
      break;
    }
    case "clear-input-image": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        inputSelection: undefined,
        workflowSelection: undefined,
        committedParameters: {},
        readiness: undefined,
        activeRun: undefined,
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        parameterDraft: {},
        parameterDraftDirty: false,
        selectedResultId: undefined,
        reusableInputResultId: undefined,
        pendingLaunchRequest: false,
        pollingRunStatus: false,
      }, authoritative);
      break;
    }
    case "select-workflow-system": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        workflowSelection: action.selection,
        committedParameters: action.selection.parameterDefaults,
        readiness: undefined,
        activeRun: undefined,
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        parameterDraft: action.selection.parameterDefaults,
        parameterDraftDirty: false,
        selectedResultId: undefined,
        reusableInputResultId: undefined,
        pendingLaunchRequest: false,
        pollingRunStatus: false,
      }, authoritative);
      break;
    }
    case "set-parameter-draft": {
      const changed = !areRecordsEqual(action.values, state.authoritative.committedParameters);
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        readiness: undefined,
        activeRun: undefined,
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        parameterDraft: action.values,
        parameterDraftDirty: changed,
        pendingLaunchRequest: false,
        pollingRunStatus: false,
      }, authoritative);
      break;
    }
    case "commit-parameter-draft": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        committedParameters: state.transient.parameterDraft,
        readiness: undefined,
        activeRun: undefined,
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        parameterDraft: state.transient.parameterDraft,
        parameterDraftDirty: false,
        pendingLaunchRequest: false,
        pollingRunStatus: false,
      }, authoritative);
      break;
    }
    case "readiness-requested": {
      transient = freezeTransientState({
        ...state.transient,
        pendingReadinessRequest: true,
      }, authoritative);
      break;
    }
    case "readiness-resolved": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        readiness: action.readiness,
      });
      transient = freezeTransientState({
        ...state.transient,
        pendingReadinessRequest: false,
      }, authoritative);
      break;
    }
    case "run-launch-requested": {
      transient = freezeTransientState({
        ...state.transient,
        pendingLaunchRequest: true,
      }, authoritative);
      break;
    }
    case "run-launch-accepted": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        activeRun: action.run,
        runHistory: upsertRun(state.authoritative.runHistory, action.run),
        results: undefined,
      });
      transient = freezeTransientState({
        ...state.transient,
        pendingLaunchRequest: false,
        pollingRunStatus: true,
        selectedResultId: undefined,
        reusableInputResultId: undefined,
      }, authoritative);
      break;
    }
    case "run-status-updated": {
      const baselineRun = state.authoritative.activeRun;
      const nextRun = baselineRun?.runId === action.runId
        ? Object.freeze({
          ...baselineRun,
          status: action.status,
          updatedAtIso: action.updatedAtIso,
        })
        : baselineRun;
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        activeRun: nextRun,
        runHistory: state.authoritative.runHistory.map((run) => run.runId === action.runId
          ? Object.freeze({ ...run, status: action.status, updatedAtIso: action.updatedAtIso })
          : run),
      });
      transient = freezeTransientState({
        ...state.transient,
        pollingRunStatus: nextRun ? !isTerminalRunStatus(nextRun.status) : state.transient.pollingRunStatus,
      }, authoritative);
      break;
    }
    case "run-history-synchronized": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        runHistory: action.runs,
      });
      transient = freezeTransientState(state.transient, authoritative);
      break;
    }
    case "results-synchronized": {
      authoritative = freezeAuthoritativeState({
        ...state.authoritative,
        results: action.results,
      });
      transient = freezeTransientState({
        ...state.transient,
        selectedResultId: action.results.items[0]?.resultId,
      }, authoritative);
      break;
    }
    case "focus-step": {
      transient = freezeTransientState({
        ...state.transient,
        focusedStepId: action.stepId,
      }, authoritative);
      break;
    }
    case "select-result": {
      transient = freezeTransientState({
        ...state.transient,
        selectedResultId: action.resultId,
      }, authoritative);
      break;
    }
    case "mark-result-reusable": {
      transient = freezeTransientState({
        ...state.transient,
        reusableInputResultId: action.resultId,
      }, authoritative);
      break;
    }
    default:
      break;
  }

  const derived = deriveImageStudioPresentationState(authoritative, transient);
  const transitions = Object.freeze([
    ...state.transitions,
    Object.freeze({
      actionType: action.type,
      atIso,
      resolvedStepId: derived.currentStepId,
    }),
  ]);

  return Object.freeze({
    authoritative,
    transient,
    derived,
    transitions,
  });
}

export function deriveImageStudioPresentationState(
  authoritative: ImageStudioAuthoritativeState,
  transient: ImageStudioTransientUiState,
): ImageStudioDerivedPresentationState {
  const stepGates = ImageStudioFlowStepSequence.map((stepId) => Object.freeze({
    stepId,
    blockers: Object.freeze(resolveStepBlockers(stepId, authoritative, transient)),
  }));
  const gateById = new Map(stepGates.map((gate) => [gate.stepId, gate]));

  const currentStepId = resolveCurrentStep(authoritative, transient, gateById);
  const completedStepIds = Object.freeze(ImageStudioFlowStepSequence.filter((stepId) => {
    if (stepId === currentStepId) {
      return false;
    }

    const stepIndex = ImageStudioFlowStepSequence.indexOf(stepId);
    const currentIndex = ImageStudioFlowStepSequence.indexOf(currentStepId);
    if (stepIndex > currentIndex) {
      return false;
    }

    return (gateById.get(stepId)?.blockers.length ?? 0) === 0;
  }));

  const activeRun = authoritative.activeRun;
  const runMonitorState = !activeRun
    ? "idle"
    : isTerminalRunStatus(activeRun.status)
      ? "terminal"
      : "active";
  const canReviewResults = currentStepId === ImageStudioFlowStepIds.reviewResults
    && (gateById.get(ImageStudioFlowStepIds.reviewResults)?.blockers.length ?? 0) === 0;
  const canLaunchRun = (gateById.get(ImageStudioFlowStepIds.launchRun)?.blockers.length ?? 1) === 0;

  return Object.freeze({
    currentStepId,
    completedStepIds,
    stepGates: Object.freeze(stepGates),
    canLaunchRun,
    canReviewResults,
    runMonitorState,
  });
}

function resolveCurrentStep(
  authoritative: ImageStudioAuthoritativeState,
  transient: ImageStudioTransientUiState,
  gates: Map<ImageStudioFlowStepId, ImageStudioDerivedStepGate>,
): ImageStudioFlowStepId {
  if (transient.focusedStepId && (gates.get(transient.focusedStepId)?.blockers.length ?? 1) === 0) {
    return transient.focusedStepId;
  }

  if ((gates.get(ImageStudioFlowStepIds.selectImage)?.blockers.length ?? 0) > 0) {
    return ImageStudioFlowStepIds.selectImage;
  }
  if ((gates.get(ImageStudioFlowStepIds.selectWorkflow)?.blockers.length ?? 0) > 0) {
    return ImageStudioFlowStepIds.selectWorkflow;
  }
  if ((gates.get(ImageStudioFlowStepIds.configureParameters)?.blockers.length ?? 0) > 0) {
    return ImageStudioFlowStepIds.configureParameters;
  }
  if ((gates.get(ImageStudioFlowStepIds.assessReadiness)?.blockers.length ?? 0) > 0) {
    return ImageStudioFlowStepIds.assessReadiness;
  }
  if ((gates.get(ImageStudioFlowStepIds.launchRun)?.blockers.length ?? 0) > 0) {
    return ImageStudioFlowStepIds.launchRun;
  }

  if (!authoritative.activeRun) {
    return ImageStudioFlowStepIds.launchRun;
  }

  if (authoritative.activeRun?.status === "completed" && (gates.get(ImageStudioFlowStepIds.reviewResults)?.blockers.length ?? 0) === 0) {
    return ImageStudioFlowStepIds.reviewResults;
  }
  return ImageStudioFlowStepIds.monitorRun;
}

function resolveStepBlockers(
  stepId: ImageStudioFlowStepId,
  authoritative: ImageStudioAuthoritativeState,
  transient: ImageStudioTransientUiState,
): ReadonlyArray<string> {
  const blockers: string[] = [];
  const hasInput = Boolean(authoritative.inputSelection);
  const hasWorkflow = Boolean(authoritative.workflowSelection);
  const hasCommittedParameters = Object.keys(authoritative.committedParameters).length > 0 || hasWorkflow;
  const readiness = authoritative.readiness;
  const hasReadyReadiness = Boolean(readiness && readiness.ready);
  const activeRun = authoritative.activeRun;
  const hasResults = Boolean((authoritative.results?.items.length ?? 0) > 0);

  switch (stepId) {
    case ImageStudioFlowStepIds.selectImage: {
      if (!hasInput) {
        blockers.push("input-image-required");
      }
      break;
    }
    case ImageStudioFlowStepIds.selectWorkflow: {
      if (!hasInput) {
        blockers.push("input-image-required");
      }
      if (!hasWorkflow) {
        blockers.push("workflow-and-system-required");
      }
      break;
    }
    case ImageStudioFlowStepIds.configureParameters: {
      if (!hasInput || !hasWorkflow) {
        blockers.push("image-and-workflow-required");
      }
      if (!hasCommittedParameters) {
        blockers.push("parameters-missing");
      }
      if (transient.parameterDraftDirty) {
        blockers.push("parameter-draft-uncommitted");
      }
      break;
    }
    case ImageStudioFlowStepIds.assessReadiness: {
      if (!hasInput || !hasWorkflow) {
        blockers.push("image-and-workflow-required");
      }
      if (transient.parameterDraftDirty) {
        blockers.push("parameter-draft-uncommitted");
      }
      if (!readiness) {
        blockers.push("readiness-not-assessed");
      } else if (!readiness.ready) {
        blockers.push("readiness-blocked");
      }
      break;
    }
    case ImageStudioFlowStepIds.launchRun: {
      if (!hasInput || !hasWorkflow) {
        blockers.push("image-and-workflow-required");
      }
      if (transient.parameterDraftDirty) {
        blockers.push("parameter-draft-uncommitted");
      }
      if (!hasReadyReadiness) {
        blockers.push("readiness-not-ready");
      }
      if (transient.pendingLaunchRequest) {
        blockers.push("launch-in-flight");
      }
      break;
    }
    case ImageStudioFlowStepIds.monitorRun: {
      if (!activeRun) {
        blockers.push("run-not-started");
      }
      break;
    }
    case ImageStudioFlowStepIds.reviewResults: {
      if (!activeRun) {
        blockers.push("run-not-started");
      } else if (activeRun.status !== "completed") {
        blockers.push("run-not-completed");
      }
      if (!hasResults) {
        blockers.push("results-not-loaded");
      }
      break;
    }
    default:
      break;
  }

  return blockers;
}

function freezeAuthoritativeState(
  state?: Partial<ImageStudioAuthoritativeState>,
): ImageStudioAuthoritativeState {
  return Object.freeze({
    continuationSessionId: state?.continuationSessionId,
    inputSelection: state?.inputSelection ? Object.freeze({ ...state.inputSelection }) : undefined,
    workflowSelection: state?.workflowSelection
      ? Object.freeze({
        ...state.workflowSelection,
        parameterDefaults: Object.freeze({ ...state.workflowSelection.parameterDefaults }),
      })
      : undefined,
    committedParameters: Object.freeze({ ...(state?.committedParameters ?? {}) }),
    readiness: state?.readiness
      ? Object.freeze({
        ...state.readiness,
        issues: Object.freeze(state.readiness.issues.map((issue) => Object.freeze({ ...issue }))),
      })
      : undefined,
    activeRun: state?.activeRun ? Object.freeze({ ...state.activeRun }) : undefined,
    runHistory: Object.freeze((state?.runHistory ?? []).map((run) => Object.freeze({ ...run }))),
    results: state?.results
      ? Object.freeze({
        ...state.results,
        items: Object.freeze(state.results.items.map((item) => Object.freeze({ ...item }))),
      })
      : undefined,
  });
}

function freezeTransientState(
  state: Partial<ImageStudioTransientUiState> | undefined,
  authoritative: ImageStudioAuthoritativeState,
): ImageStudioTransientUiState {
  const parameterDraft = state?.parameterDraft ?? authoritative.committedParameters;
  return Object.freeze({
    parameterDraft: Object.freeze({ ...parameterDraft }),
    parameterDraftDirty: state?.parameterDraftDirty ?? false,
    focusedStepId: state?.focusedStepId,
    pollingRunStatus: state?.pollingRunStatus ?? false,
    pendingReadinessRequest: state?.pendingReadinessRequest ?? false,
    pendingLaunchRequest: state?.pendingLaunchRequest ?? false,
    selectedResultId: state?.selectedResultId,
    reusableInputResultId: state?.reusableInputResultId,
  });
}

function upsertRun(
  runs: ReadonlyArray<ImageStudioRunSummary>,
  run: ImageStudioRunSummary,
): ReadonlyArray<ImageStudioRunSummary> {
  const existingIndex = runs.findIndex((entry) => entry.runId === run.runId);
  if (existingIndex < 0) {
    return Object.freeze([...runs, run].map((entry) => Object.freeze({ ...entry })));
  }
  return Object.freeze(runs.map((entry, index) => index === existingIndex ? Object.freeze({ ...run }) : Object.freeze({ ...entry })));
}

function isTerminalRunStatus(status: ImageStudioRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function areRecordsEqual(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}
