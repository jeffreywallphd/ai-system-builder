import {
  ImageStudioFlowStepIds,
  ImageStudioFlowStepSequence,
  type ImageStudioAuthoritativeState,
  type ImageStudioDerivedStepGate,
  type ImageStudioInteractionState,
  type ImageStudioResultItem,
  type ImageStudioRunStatus,
  type ImageStudioRunSummary,
} from "./ImageStudioInteractionModel";

export type ImageStudioSurfaceStateKind = "loading" | "empty" | "error" | "ready" | "degraded";

export interface ImageStudioSurfaceStateViewModel {
  readonly kind: ImageStudioSurfaceStateKind;
  readonly title: string;
  readonly description: string;
  readonly detail?: string;
  readonly retryable?: boolean;
}

export interface ImageStudioInputOptionDto {
  readonly selectionId: string;
  readonly label: string;
  readonly sourceLabel: string;
  readonly previewUrl?: string;
  readonly capturedAtIso?: string;
}

export interface ImageStudioWorkflowOptionDto {
  readonly workflowId: string;
  readonly name: string;
  readonly supportedImageModes: ReadonlyArray<string>;
  readonly defaultSystemId?: string;
}

export interface ImageStudioSystemOptionDto {
  readonly systemId: string;
  readonly name: string;
  readonly runtimeReady?: boolean;
}

export interface ImageStudioRunMonitoringDto {
  readonly runId: string;
  readonly status: ImageStudioRunStatus;
  readonly percentComplete?: number;
  readonly statusMessage?: string;
  readonly activeNodeLabel?: string;
  readonly updatedAtIso?: string;
  readonly warnings?: ReadonlyArray<string>;
}

export interface ImageStudioResultPreviewDto {
  readonly resultId: string;
  readonly title: string;
  readonly previewUrl?: string;
  readonly mediaType?: string;
  readonly createdAtIso?: string;
}

export interface ImageStudioContinuationDto {
  readonly continuationSessionId: string;
  readonly summary: string;
  readonly resumedAtIso?: string;
}

export type ImageStudioSnapshotLoadState = "idle" | "loading" | "ready" | "error";

export interface ImageStudioSnapshotEnvelope<T> {
  readonly state: ImageStudioSnapshotLoadState;
  readonly data?: T;
  readonly errorMessage?: string;
}

export interface ImageStudioPresenterComposeInput {
  readonly interaction: ImageStudioInteractionState;
  readonly inputOptions?: ImageStudioSnapshotEnvelope<ReadonlyArray<ImageStudioInputOptionDto>>;
  readonly workflowOptions?: ImageStudioSnapshotEnvelope<ReadonlyArray<ImageStudioWorkflowOptionDto>>;
  readonly systemOptions?: ImageStudioSnapshotEnvelope<ReadonlyArray<ImageStudioSystemOptionDto>>;
  readonly runMonitoring?: ImageStudioSnapshotEnvelope<ImageStudioRunMonitoringDto>;
  readonly resultPreviews?: ImageStudioSnapshotEnvelope<ReadonlyArray<ImageStudioResultPreviewDto>>;
  readonly continuation?: ImageStudioSnapshotEnvelope<ImageStudioContinuationDto>;
}

export interface ImageStudioFlowStepViewModel {
  readonly stepId: string;
  readonly label: string;
  readonly status: "complete" | "current" | "upcoming" | "blocked";
  readonly blockers: ReadonlyArray<string>;
}

export interface ImageStudioPrimaryActionViewModel {
  readonly actionId: "pick-image" | "pick-edit" | "adjust-settings" | "check-readiness" | "start-edit" | "review-progress" | "review-results";
  readonly label: string;
  readonly disabled: boolean;
  readonly reason?: string;
}

export interface ImageStudioInputSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly selectedSelectionId?: string;
  readonly options: ReadonlyArray<ImageStudioInputOptionDto>;
}

export interface ImageStudioWorkflowSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly selectedWorkflowId?: string;
  readonly selectedSystemId?: string;
  readonly workflows: ReadonlyArray<ImageStudioWorkflowOptionDto>;
  readonly systems: ReadonlyArray<ImageStudioSystemOptionDto>;
}

export interface ImageStudioReadinessItemViewModel {
  readonly message: string;
  readonly severity: "blocking" | "advisory";
}

export interface ImageStudioReadinessSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly assessedAtIso?: string;
  readonly issues: ReadonlyArray<ImageStudioReadinessItemViewModel>;
}

export interface ImageStudioRunSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly activeRun?: ImageStudioRunSummary;
  readonly monitoring?: ImageStudioRunMonitoringDto;
  readonly recentRuns: ReadonlyArray<ImageStudioRunSummary>;
}

export interface ImageStudioResultCardViewModel {
  readonly resultId: string;
  readonly title: string;
  readonly previewUrl?: string;
  readonly selected: boolean;
  readonly reusable: boolean;
}

export interface ImageStudioResultsSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly selectedResultId?: string;
  readonly cards: ReadonlyArray<ImageStudioResultCardViewModel>;
}

export interface ImageStudioContinuationSurfaceViewModel {
  readonly state: ImageStudioSurfaceStateViewModel;
  readonly continuationSessionId?: string;
  readonly summary?: string;
}

export interface ImageStudioAdvancedDiagnosticsViewModel {
  readonly hiddenByDefault: true;
  readonly summary: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly technicalNotes: ReadonlyArray<string>;
}

export interface ImageStudioPresenterViewModel {
  readonly title: string;
  readonly subtitle: string;
  readonly flow: ReadonlyArray<ImageStudioFlowStepViewModel>;
  readonly primaryAction: ImageStudioPrimaryActionViewModel;
  readonly input: ImageStudioInputSurfaceViewModel;
  readonly workflow: ImageStudioWorkflowSurfaceViewModel;
  readonly readiness: ImageStudioReadinessSurfaceViewModel;
  readonly run: ImageStudioRunSurfaceViewModel;
  readonly results: ImageStudioResultsSurfaceViewModel;
  readonly continuation: ImageStudioContinuationSurfaceViewModel;
  readonly advanced: ImageStudioAdvancedDiagnosticsViewModel;
}

export function composeImageStudioPresenterViewModel(
  input: ImageStudioPresenterComposeInput,
): ImageStudioPresenterViewModel {
  const flow = mapFlow(input.interaction);
  const primaryAction = selectPrimaryAction(input.interaction, flow);

  const inputSurface = composeInputSurface(input);
  const workflowSurface = composeWorkflowSurface(input);
  const readinessSurface = composeReadinessSurface(input.interaction);
  const runSurface = composeRunSurface(input);
  const resultsSurface = composeResultsSurface(input);
  const continuationSurface = composeContinuationSurface(input);

  return Object.freeze({
    title: "Image Studio",
    subtitle: "Upload or choose an image, apply an edit, and review the result.",
    flow,
    primaryAction,
    input: inputSurface,
    workflow: workflowSurface,
    readiness: readinessSurface,
    run: runSurface,
    results: resultsSurface,
    continuation: continuationSurface,
    advanced: composeAdvancedDiagnostics(input),
  });
}

export function selectImageStudioSurfaceState(
  viewModel: ImageStudioPresenterViewModel,
  surface: "input" | "workflow" | "readiness" | "run" | "results" | "continuation",
): ImageStudioSurfaceStateViewModel {
  switch (surface) {
    case "input":
      return viewModel.input.state;
    case "workflow":
      return viewModel.workflow.state;
    case "readiness":
      return viewModel.readiness.state;
    case "run":
      return viewModel.run.state;
    case "results":
      return viewModel.results.state;
    case "continuation":
      return viewModel.continuation.state;
    default:
      return unreachableSurface(surface);
  }
}

export function selectImageStudioPrimaryAction(
  viewModel: ImageStudioPresenterViewModel,
): ImageStudioPrimaryActionViewModel {
  return viewModel.primaryAction;
}

function composeInputSurface(input: ImageStudioPresenterComposeInput): ImageStudioInputSurfaceViewModel {
  const envelope = input.inputOptions;
  const options = envelope?.data ?? [];
  const selectedSelectionId = input.interaction.authoritative.inputSelection?.selectionId;

  if (envelope?.state === "loading") {
    return Object.freeze({
      state: loadingState("Choose an image", "Loading your recent images and uploads."),
      selectedSelectionId,
      options,
    });
  }

  if (envelope?.state === "error") {
    return Object.freeze({
      state: errorState("Choose an image", envelope.errorMessage ?? "Image options could not be loaded."),
      selectedSelectionId,
      options,
    });
  }

  if (!selectedSelectionId && options.length === 0) {
    return Object.freeze({
      state: emptyState("Choose an image", "Upload an image or pick one from your library to begin."),
      selectedSelectionId,
      options,
    });
  }

  if (selectedSelectionId && options.length > 0 && !options.some((entry) => entry.selectionId === selectedSelectionId)) {
    return Object.freeze({
      state: degradedState(
        "Choose an image",
        "Your current image is no longer in the loaded list.",
        "Refresh image options or choose another image.",
      ),
      selectedSelectionId,
      options,
    });
  }

  return Object.freeze({
    state: readyState("Choose an image", "Your image is selected and ready."),
    selectedSelectionId,
    options,
  });
}

function composeWorkflowSurface(input: ImageStudioPresenterComposeInput): ImageStudioWorkflowSurfaceViewModel {
  const workflowsEnvelope = input.workflowOptions;
  const systemsEnvelope = input.systemOptions;
  const workflows = workflowsEnvelope?.data ?? [];
  const systems = systemsEnvelope?.data ?? [];
  const selectedWorkflowId = input.interaction.authoritative.workflowSelection?.workflowId;
  const selectedSystemId = input.interaction.authoritative.workflowSelection?.systemId;

  if (workflowsEnvelope?.state === "loading" || systemsEnvelope?.state === "loading") {
    return Object.freeze({
      state: loadingState("Choose an edit", "Loading edit options for your image."),
      selectedWorkflowId,
      selectedSystemId,
      workflows,
      systems,
    });
  }

  if (workflowsEnvelope?.state === "error" || systemsEnvelope?.state === "error") {
    return Object.freeze({
      state: errorState(
        "Choose an edit",
        workflowsEnvelope?.errorMessage ?? systemsEnvelope?.errorMessage ?? "Edit options are unavailable.",
      ),
      selectedWorkflowId,
      selectedSystemId,
      workflows,
      systems,
    });
  }

  if (!selectedWorkflowId || !selectedSystemId) {
    return Object.freeze({
      state: emptyState("Choose an edit", "Pick an edit style to continue."),
      selectedWorkflowId,
      selectedSystemId,
      workflows,
      systems,
    });
  }

  if (!workflows.some((entry) => entry.workflowId === selectedWorkflowId)) {
    return Object.freeze({
      state: degradedState(
        "Choose an edit",
        "The selected edit is no longer available.",
        "Choose a different edit option.",
      ),
      selectedWorkflowId,
      selectedSystemId,
      workflows,
      systems,
    });
  }

  return Object.freeze({
    state: readyState("Choose an edit", "Your edit settings are selected."),
    selectedWorkflowId,
    selectedSystemId,
    workflows,
    systems,
  });
}

function composeReadinessSurface(interaction: ImageStudioInteractionState): ImageStudioReadinessSurfaceViewModel {
  const readiness = interaction.authoritative.readiness;
  const issues = readiness?.issues.map((issue) => Object.freeze({
    message: issue.message,
    severity: issue.severity,
  })) ?? [];

  if (interaction.transient.pendingReadinessRequest) {
    return Object.freeze({
      state: loadingState("Check readiness", "Verifying that your image edit can run."),
      assessedAtIso: readiness?.assessedAtIso,
      issues,
    });
  }

  if (!readiness) {
    return Object.freeze({
      state: emptyState("Check readiness", "Run a readiness check after adjusting your settings."),
      issues,
    });
  }

  if (!readiness.ready) {
    const blockingCount = readiness.issues.filter((issue) => issue.severity === "blocking").length;
    return Object.freeze({
      state: degradedState(
        "Check readiness",
        blockingCount > 0
          ? "This edit needs attention before it can start."
          : "This edit has recommendations before launch.",
        blockingCount > 0 ? `${blockingCount} blocking issue(s).` : undefined,
      ),
      assessedAtIso: readiness.assessedAtIso,
      issues,
    });
  }

  if (readiness.issues.length > 0) {
    return Object.freeze({
      state: degradedState(
        "Check readiness",
        "Ready to run with recommendations.",
        `${readiness.issues.length} recommendation(s) available.`,
      ),
      assessedAtIso: readiness.assessedAtIso,
      issues,
    });
  }

  return Object.freeze({
    state: readyState("Check readiness", "Ready to start your edit."),
    assessedAtIso: readiness.assessedAtIso,
    issues,
  });
}

function composeRunSurface(input: ImageStudioPresenterComposeInput): ImageStudioRunSurfaceViewModel {
  const activeRun = input.interaction.authoritative.activeRun;
  const recentRuns = input.interaction.authoritative.runHistory;
  const envelope = input.runMonitoring;

  if (input.interaction.transient.pendingLaunchRequest) {
    return Object.freeze({
      state: loadingState("Run progress", "Starting your edit now."),
      activeRun,
      monitoring: envelope?.data,
      recentRuns,
    });
  }

  if (!activeRun) {
    return Object.freeze({
      state: recentRuns.length > 0
        ? readyState("Run progress", "No active edit. You can review recent runs.")
        : emptyState("Run progress", "Start an edit to view live progress."),
      activeRun,
      monitoring: envelope?.data,
      recentRuns,
    });
  }

  if (envelope?.state === "loading") {
    return Object.freeze({
      state: loadingState("Run progress", "Updating live progress."),
      activeRun,
      monitoring: envelope.data,
      recentRuns,
    });
  }

  if (envelope?.state === "error") {
    return Object.freeze({
      state: degradedState("Run progress", "Live updates are temporarily unavailable.", envelope.errorMessage),
      activeRun,
      monitoring: envelope.data,
      recentRuns,
    });
  }

  if (activeRun.status === "failed" || activeRun.status === "cancelled") {
    return Object.freeze({
      state: degradedState(
        "Run progress",
        activeRun.status === "failed" ? "The last edit did not finish." : "The last edit was cancelled.",
        "Review details and try again.",
      ),
      activeRun,
      monitoring: envelope?.data,
      recentRuns,
    });
  }

  return Object.freeze({
    state: readyState(
      "Run progress",
      activeRun.status === "completed" ? "Your edit is complete." : "Your edit is running.",
    ),
    activeRun,
    monitoring: envelope?.data,
    recentRuns,
  });
}

function composeResultsSurface(input: ImageStudioPresenterComposeInput): ImageStudioResultsSurfaceViewModel {
  const envelope = input.resultPreviews;
  const selectedResultId = input.interaction.transient.selectedResultId;
  const reusableResultId = input.interaction.transient.reusableInputResultId;
  const cards = mapResultCards(
    input.interaction.authoritative.results?.items ?? [],
    envelope?.data ?? [],
    selectedResultId,
    reusableResultId,
  );

  if (envelope?.state === "loading") {
    return Object.freeze({
      state: loadingState("Your results", "Loading generated previews."),
      selectedResultId,
      cards,
    });
  }

  if (envelope?.state === "error") {
    return Object.freeze({
      state: degradedState("Your results", "Results are available but previews could not be loaded.", envelope.errorMessage),
      selectedResultId,
      cards,
    });
  }

  if (cards.length === 0) {
    return Object.freeze({
      state: emptyState("Your results", "Results will appear here after your edit completes."),
      selectedResultId,
      cards,
    });
  }

  return Object.freeze({
    state: readyState("Your results", "Review outputs and reuse any image as your next input."),
    selectedResultId,
    cards,
  });
}

function composeContinuationSurface(input: ImageStudioPresenterComposeInput): ImageStudioContinuationSurfaceViewModel {
  const envelope = input.continuation;
  const continuationSessionId = input.interaction.authoritative.continuationSessionId;

  if (envelope?.state === "loading") {
    return Object.freeze({
      state: loadingState("Continue where you left off", "Looking up your previous session."),
      continuationSessionId,
    });
  }

  if (envelope?.state === "error") {
    return Object.freeze({
      state: degradedState(
        "Continue where you left off",
        "Previous sessions could not be restored right now.",
        envelope.errorMessage,
      ),
      continuationSessionId,
    });
  }

  if (envelope?.data) {
    return Object.freeze({
      state: readyState("Continue where you left off", envelope.data.summary),
      continuationSessionId: envelope.data.continuationSessionId,
      summary: envelope.data.summary,
    });
  }

  if (continuationSessionId) {
    return Object.freeze({
      state: readyState("Continue where you left off", "Session context is available for restore."),
      continuationSessionId,
      summary: "Session context is available for restore.",
    });
  }

  return Object.freeze({
    state: emptyState("Continue where you left off", "No prior session is open."),
    continuationSessionId,
  });
}

function composeAdvancedDiagnostics(input: ImageStudioPresenterComposeInput): ImageStudioAdvancedDiagnosticsViewModel {
  const interaction = input.interaction;
  const blockingGates = interaction.derived.stepGates.filter((gate) => gate.blockers.length > 0).length;
  const readinessIssues = interaction.authoritative.readiness?.issues.length ?? 0;
  const runWarnings = input.runMonitoring?.data?.warnings?.length ?? 0;

  const summary = Object.freeze([
    Object.freeze({ label: "Blocked stages", value: String(blockingGates) }),
    Object.freeze({ label: "Readiness issues", value: String(readinessIssues) }),
    Object.freeze({ label: "Run warnings", value: String(runWarnings) }),
    Object.freeze({ label: "Transition events", value: String(interaction.transitions.length) }),
  ]);

  const technicalNotes = Object.freeze([
    `currentStep=${interaction.derived.currentStepId}`,
    `runMonitorState=${interaction.derived.runMonitorState}`,
    `activeRun=${interaction.authoritative.activeRun?.runId ?? "none"}`,
  ]);

  return Object.freeze({
    hiddenByDefault: true,
    summary,
    technicalNotes,
  });
}

function mapFlow(interaction: ImageStudioInteractionState): ReadonlyArray<ImageStudioFlowStepViewModel> {
  const gateById = new Map(interaction.derived.stepGates.map((gate) => [gate.stepId, gate]));
  const currentStepId = interaction.derived.currentStepId;
  const currentIndex = ImageStudioFlowStepSequence.indexOf(currentStepId);

  return Object.freeze(ImageStudioFlowStepSequence.map((stepId, index) => {
    const gate = gateById.get(stepId);
    const blockers = gate?.blockers.map((code) => mapStepBlocker(code)) ?? [];
    const isComplete = interaction.derived.completedStepIds.includes(stepId);
    const status = isComplete
      ? "complete"
      : stepId === currentStepId
        ? blockers.length > 0
          ? "blocked"
          : "current"
        : index > currentIndex
          ? "upcoming"
          : blockers.length > 0
            ? "blocked"
            : "upcoming";

    return Object.freeze({
      stepId,
      label: toStepLabel(stepId),
      status,
      blockers: Object.freeze(blockers),
    });
  }));
}

function selectPrimaryAction(
  interaction: ImageStudioInteractionState,
  flow: ReadonlyArray<ImageStudioFlowStepViewModel>,
): ImageStudioPrimaryActionViewModel {
  const currentStep = flow.find((step) => step.stepId === interaction.derived.currentStepId);
  const reason = currentStep?.blockers[0];

  switch (interaction.derived.currentStepId) {
    case ImageStudioFlowStepIds.selectImage:
      return Object.freeze({
        actionId: "pick-image",
        label: "Choose image",
        disabled: false,
      });
    case ImageStudioFlowStepIds.selectWorkflow:
      return Object.freeze({
        actionId: "pick-edit",
        label: "Choose edit",
        disabled: false,
        reason,
      });
    case ImageStudioFlowStepIds.configureParameters:
      return Object.freeze({
        actionId: "adjust-settings",
        label: "Adjust settings",
        disabled: false,
        reason,
      });
    case ImageStudioFlowStepIds.assessReadiness:
      return Object.freeze({
        actionId: "check-readiness",
        label: "Run readiness check",
        disabled: interaction.transient.pendingReadinessRequest,
        reason,
      });
    case ImageStudioFlowStepIds.launchRun:
      return Object.freeze({
        actionId: "start-edit",
        label: "Start edit",
        disabled: !interaction.derived.canLaunchRun,
        reason,
      });
    case ImageStudioFlowStepIds.monitorRun:
      return Object.freeze({
        actionId: "review-progress",
        label: "Review progress",
        disabled: false,
        reason,
      });
    case ImageStudioFlowStepIds.reviewResults:
      return Object.freeze({
        actionId: "review-results",
        label: "Review results",
        disabled: !interaction.derived.canReviewResults,
        reason,
      });
    default:
      return Object.freeze({
        actionId: "pick-image",
        label: "Choose image",
        disabled: false,
      });
  }
}

function mapResultCards(
  resultItems: ReadonlyArray<ImageStudioResultItem>,
  previewDtos: ReadonlyArray<ImageStudioResultPreviewDto>,
  selectedResultId: string | undefined,
  reusableResultId: string | undefined,
): ReadonlyArray<ImageStudioResultCardViewModel> {
  return Object.freeze(resultItems.map((item, index) => {
    const preview = previewDtos.find((entry) => entry.resultId === item.resultId);
    return Object.freeze({
      resultId: item.resultId,
      title: preview?.title ?? `Result ${index + 1}`,
      previewUrl: preview?.previewUrl ?? item.previewReference,
      selected: selectedResultId === item.resultId,
      reusable: reusableResultId === item.resultId,
    });
  }));
}

function toStepLabel(stepId: string): string {
  switch (stepId) {
    case ImageStudioFlowStepIds.selectImage:
      return "Choose image";
    case ImageStudioFlowStepIds.selectWorkflow:
      return "Choose edit";
    case ImageStudioFlowStepIds.configureParameters:
      return "Adjust settings";
    case ImageStudioFlowStepIds.assessReadiness:
      return "Check readiness";
    case ImageStudioFlowStepIds.launchRun:
      return "Start edit";
    case ImageStudioFlowStepIds.monitorRun:
      return "Track progress";
    case ImageStudioFlowStepIds.reviewResults:
      return "Review results";
    default:
      return "Step";
  }
}

function mapStepBlocker(code: string): string {
  switch (code) {
    case "input-image-required":
      return "Choose an image to continue.";
    case "workflow-and-system-required":
    case "image-and-workflow-required":
      return "Choose an image and edit option first.";
    case "parameters-missing":
      return "Add settings before continuing.";
    case "parameter-draft-uncommitted":
      return "Save your setting changes.";
    case "readiness-not-assessed":
      return "Run readiness check.";
    case "readiness-blocked":
    case "readiness-not-ready":
      return "Resolve readiness issues before starting.";
    case "launch-in-flight":
      return "Edit launch is in progress.";
    case "run-not-started":
      return "Start an edit run first.";
    case "run-not-completed":
      return "Wait until the run finishes.";
    case "results-not-loaded":
      return "Load generated results.";
    default:
      return "Finish this step to continue.";
  }
}

function loadingState(title: string, description: string): ImageStudioSurfaceStateViewModel {
  return Object.freeze({
    kind: "loading",
    title,
    description,
  });
}

function emptyState(title: string, description: string): ImageStudioSurfaceStateViewModel {
  return Object.freeze({
    kind: "empty",
    title,
    description,
  });
}

function errorState(title: string, description: string): ImageStudioSurfaceStateViewModel {
  return Object.freeze({
    kind: "error",
    title,
    description,
    retryable: true,
  });
}

function readyState(title: string, description: string): ImageStudioSurfaceStateViewModel {
  return Object.freeze({
    kind: "ready",
    title,
    description,
  });
}

function degradedState(title: string, description: string, detail?: string): ImageStudioSurfaceStateViewModel {
  return Object.freeze({
    kind: "degraded",
    title,
    description,
    detail,
    retryable: true,
  });
}

function unreachableSurface(value: never): never {
  throw new Error(`Unsupported image studio surface: ${String(value)}`);
}

export function mapImageStudioStepGateToPresenterBlockers(
  gate: ImageStudioDerivedStepGate,
): ReadonlyArray<string> {
  return Object.freeze(gate.blockers.map((code) => mapStepBlocker(code)));
}

export function createImageStudioPresenterComposeInput(
  interaction: ImageStudioInteractionState,
): ImageStudioPresenterComposeInput {
  return Object.freeze({
    interaction,
  });
}

export function createImageStudioPresenterViewModelFromAuthoritativeState(
  authoritative: ImageStudioAuthoritativeState,
): ImageStudioPresenterViewModel {
  return composeImageStudioPresenterViewModel(Object.freeze({
    interaction: Object.freeze({
      authoritative,
      transient: Object.freeze({
        parameterDraft: Object.freeze({ ...authoritative.committedParameters }),
        parameterDraftDirty: false,
        pollingRunStatus: false,
        pendingReadinessRequest: false,
        pendingLaunchRequest: false,
      }),
      derived: Object.freeze({
        currentStepId: ImageStudioFlowStepIds.selectImage,
        completedStepIds: Object.freeze([]),
        stepGates: Object.freeze([]),
        canLaunchRun: false,
        canReviewResults: false,
        runMonitorState: "idle",
      }),
      transitions: Object.freeze([]),
    }),
  }));
}
