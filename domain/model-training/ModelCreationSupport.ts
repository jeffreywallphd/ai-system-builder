import type { AppRuntimeMode } from "../runtime/AppRuntimeMode";
import type { DatasetTaskType } from "../tuning-datasets/interfaces/ITuningDatasetStudio";

export const MODEL_CREATION_PATHS = Object.freeze([
  "export-preparation-only",
  "local-training",
] as const);
export type ModelCreationPath = (typeof MODEL_CREATION_PATHS)[number];

export const MODEL_CREATION_SUPPORT_STATES = Object.freeze([
  "available",
  "degraded",
  "unavailable",
] as const);
export type ModelCreationSupportState = (typeof MODEL_CREATION_SUPPORT_STATES)[number];

export const MODEL_CREATION_RUNTIME_STATUSES = Object.freeze([
  "ready",
  "degraded",
  "unavailable",
  "disabled",
] as const);
export type ModelCreationRuntimeStatus = (typeof MODEL_CREATION_RUNTIME_STATUSES)[number];

export const MODEL_CREATION_RECOMMENDED_ACTIONS = Object.freeze([
  "open-model-downloads",
  "open-datasets",
  "switch-to-desktop-app",
  "enable-python-runtime",
  "repair-desktop-bridge",
  "select-supported-dataset-version",
  "select-base-model",
  "inspect-job-output",
  "wait-for-job-completion",
] as const);
export type ModelCreationRecommendedActionId = (typeof MODEL_CREATION_RECOMMENDED_ACTIONS)[number];

export const MODEL_CREATION_BLOCKER_CODES = Object.freeze([
  "runtime-disabled",
  "runtime-unavailable",
  "browser-fallback",
  "desktop-bridge-unavailable",
  "missing-base-model",
  "missing-local-file-base-model",
  "missing-dataset-version",
  "unsupported-dataset-task-type",
  "promotion-unsupported",
  "job-not-complete",
  "missing-trained-artifact",
] as const);
export type ModelCreationBlockerCode = (typeof MODEL_CREATION_BLOCKER_CODES)[number];

export interface ModelCreationRecommendedAction {
  readonly id: ModelCreationRecommendedActionId;
  readonly label: string;
  readonly detail: string;
  readonly route?: string;
}

export interface ModelCreationBlocker {
  readonly code: ModelCreationBlockerCode;
  readonly state: ModelCreationSupportState;
  readonly path?: ModelCreationPath;
  readonly message: string;
  readonly detail?: string;
  readonly recommendedAction?: ModelCreationRecommendedAction;
}

export interface ModelCreationPathSupport {
  readonly path: ModelCreationPath;
  readonly state: ModelCreationSupportState;
  readonly title: string;
  readonly summary: string;
  readonly blockers: ReadonlyArray<ModelCreationBlocker>;
  readonly warnings: ReadonlyArray<string>;
}

export interface ModelCreationCapability {
  readonly state: ModelCreationSupportState;
  readonly headline: string;
  readonly summary: string;
  readonly paths: ReadonlyArray<ModelCreationPathSupport>;
  readonly blockers: ReadonlyArray<ModelCreationBlocker>;
  readonly warnings: ReadonlyArray<string>;
  readonly recommendedNextSteps: ReadonlyArray<ModelCreationRecommendedAction>;
}

export interface ModelCreationEnvironment {
  readonly runtimeMode: AppRuntimeMode;
  readonly runtimeStatus: ModelCreationRuntimeStatus;
  readonly runtimeDetail?: string;
  readonly runtimeDependencyStatus?: Readonly<Record<string, unknown>>;
  readonly runtimeRemediationHints?: ReadonlyArray<string>;
  readonly desktopBridgeAvailable: boolean;
  readonly desktopBridgeDetail?: string;
  readonly canAccessLocalArtifacts: boolean;
  readonly canRegisterPromotedModels: boolean;
}

export interface ModelCreationSelection {
  readonly baseModel?: {
    readonly id: string;
    readonly name: string;
    readonly accessMethod: string;
  };
  readonly datasetVersion?: {
    readonly datasetId: string;
    readonly datasetName: string;
    readonly versionId: string;
    readonly versionLabel: string;
    readonly taskType: DatasetTaskType;
  };
}

export interface ModelCreationInventory {
  readonly installedBaseModelCount: number;
  readonly localBaseModelCount: number;
  readonly datasetVersionCount: number;
  readonly supportedDatasetVersionCount: number;
}

export interface EvaluateModelCreationCapabilityInput {
  readonly environment: ModelCreationEnvironment;
  readonly selection?: ModelCreationSelection;
  readonly inventory: ModelCreationInventory;
}

const SUPPORTED_LOCAL_TRAINING_TASK_TYPES = new Set<DatasetTaskType>([
  "question_answering",
  "chat_completion",
]);

export class ModelCreationCapabilityPolicy {
  public evaluate(input: EvaluateModelCreationCapabilityInput): ModelCreationCapability {
    const exportBlockers: ModelCreationBlocker[] = [];
    const localTrainingBlockers: ModelCreationBlocker[] = [];
    const warnings: string[] = [];
    const recommendedNextSteps: ModelCreationRecommendedAction[] = [];

    if (input.environment.runtimeStatus === "disabled") {
      const blocker = createBlocker({
        code: "runtime-disabled",
        state: "unavailable",
        message: "Model creation is turned off in this runtime configuration.",
        detail: input.environment.runtimeDetail ?? "Enable the Python runtime to prepare bundles or run local training jobs.",
        recommendedAction: {
          id: "enable-python-runtime",
          label: "Enable the Python runtime",
          detail: "Turn the runtime back on in Settings, then return here.",
          route: "/settings",
        },
      });
      exportBlockers.push(blocker);
      localTrainingBlockers.push(blocker);
      recommendedNextSteps.push(blocker.recommendedAction!);
    }

    if (input.environment.runtimeStatus === "unavailable" || input.environment.runtimeStatus === "degraded") {
      const blocker = createBlocker({
        code: "runtime-unavailable",
        state: input.environment.runtimeStatus === "degraded" ? "degraded" : "unavailable",
        message: input.environment.runtimeStatus === "degraded"
          ? "The Python runtime is reachable but not healthy enough for reliable model creation."
          : "The Python runtime is not reachable right now.",
        detail: input.environment.runtimeDetail ?? "Start or repair the runtime before creating model jobs.",
        recommendedAction: {
          id: "enable-python-runtime",
          label: "Check runtime health",
          detail: "Review runtime settings and restart the local runtime if needed.",
          route: "/settings",
        },
      });
      exportBlockers.push(blocker);
      localTrainingBlockers.push(blocker);
      pushIfMissing(recommendedNextSteps, blocker.recommendedAction!);
    }

    if (input.environment.runtimeMode === "browser-development") {
      const blocker = createBlocker({
        code: "browser-fallback",
        state: input.environment.runtimeStatus === "ready" ? "degraded" : "unavailable",
        path: "local-training",
        message: "Local training needs the desktop app because browser fallback mode cannot guarantee direct access to local model files.",
        detail: "You can still prepare an export bundle when the runtime is healthy, but full local training and catalog promotion stay disabled in browser-only mode.",
        recommendedAction: {
          id: "switch-to-desktop-app",
          label: "Open the desktop app",
          detail: "Use desktop mode for local file access, runtime supervision, and model promotion.",
        },
      });
      localTrainingBlockers.push(blocker);
      warnings.push("Browser fallback mode is limited to guided preparation. It cannot truthfully claim full local training support.");
      pushIfMissing(recommendedNextSteps, blocker.recommendedAction!);
    }

    if (!input.environment.desktopBridgeAvailable || !input.environment.canAccessLocalArtifacts) {
      const blocker = createBlocker({
        code: "desktop-bridge-unavailable",
        state: input.environment.runtimeMode === "browser-development" ? "degraded" : "unavailable",
        path: "local-training",
        message: "Local training needs the desktop model-file bridge to access the base model and training outputs.",
        detail: input.environment.desktopBridgeDetail ?? "The desktop bridge is unavailable in this mode.",
        recommendedAction: {
          id: "repair-desktop-bridge",
          label: "Restore desktop file access",
          detail: "Restart the desktop app or switch into a desktop runtime mode with model-file access.",
        },
      });
      localTrainingBlockers.push(blocker);
      pushIfMissing(recommendedNextSteps, blocker.recommendedAction!);
    }

    if (input.inventory.installedBaseModelCount === 0) {
      const blocker = createBlocker({
        code: "missing-base-model",
        state: "unavailable",
        path: "export-preparation-only",
        message: "Install a compatible base model before creating a model job.",
        detail: "The Create Models workspace only works from models that already exist in your installed library.",
        recommendedAction: {
          id: "open-model-downloads",
          label: "Install a base model",
          detail: "Download or register a local base model first.",
          route: "/models",
        },
      });
      exportBlockers.push(blocker);
      localTrainingBlockers.push({ ...blocker, path: "local-training" });
      pushIfMissing(recommendedNextSteps, blocker.recommendedAction!);
    }

    if (!input.selection?.baseModel && input.inventory.installedBaseModelCount > 0) {
      const blocker = createBlocker({
        code: "missing-base-model",
        state: "unavailable",
        message: "Choose a base model to continue.",
        recommendedAction: {
          id: "select-base-model",
          label: "Choose a base model",
          detail: "Pick one installed base model to unlock the available creation paths.",
        },
      });
      exportBlockers.push({ ...blocker, path: "export-preparation-only" });
      localTrainingBlockers.push({ ...blocker, path: "local-training" });
    }

    if (input.selection?.baseModel && input.selection.baseModel.accessMethod !== "local-file") {
      localTrainingBlockers.push(createBlocker({
        code: "missing-local-file-base-model",
        state: "unavailable",
        path: "local-training",
        message: "This base model is installed, but local training needs a model file on disk.",
        detail: "Choose a base model whose main artifact uses the local-file path, or install a local copy first.",
        recommendedAction: {
          id: "open-model-downloads",
          label: "Install a local-file base model",
          detail: "Select a model that records an on-disk file location.",
          route: "/models",
        },
      }));
    }

    if (input.inventory.datasetVersionCount === 0) {
      const blocker = createBlocker({
        code: "missing-dataset-version",
        state: "unavailable",
        path: "export-preparation-only",
        message: "Create or release a dataset version before starting a model job.",
        detail: "Model creation uses versioned datasets, not in-progress edits alone.",
        recommendedAction: {
          id: "open-datasets",
          label: "Open dataset studio",
          detail: "Create a dataset version, review it, and come back here.",
          route: "/context?tab=fine-tuning-dataset",
        },
      });
      exportBlockers.push(blocker);
      localTrainingBlockers.push({ ...blocker, path: "local-training" });
      pushIfMissing(recommendedNextSteps, blocker.recommendedAction!);
    }

    if (!input.selection?.datasetVersion && input.inventory.datasetVersionCount > 0) {
      const blocker = createBlocker({
        code: "missing-dataset-version",
        state: "unavailable",
        message: "Choose a dataset version to continue.",
        recommendedAction: {
          id: "select-supported-dataset-version",
          label: "Choose a dataset version",
          detail: "Pick one versioned dataset to validate the available creation paths.",
        },
      });
      exportBlockers.push({ ...blocker, path: "export-preparation-only" });
      localTrainingBlockers.push({ ...blocker, path: "local-training" });
    }

    if (input.selection?.datasetVersion && !SUPPORTED_LOCAL_TRAINING_TASK_TYPES.has(input.selection.datasetVersion.taskType)) {
      localTrainingBlockers.push(createBlocker({
        code: "unsupported-dataset-task-type",
        state: "unavailable",
        path: "local-training",
        message: `Local training currently supports chat completion and question answering datasets, not ${formatTaskType(input.selection.datasetVersion.taskType)}.`,
        detail: "You can still prepare an export bundle for this dataset version, but a real local training run is intentionally disabled.",
        recommendedAction: {
          id: "select-supported-dataset-version",
          label: "Choose a supported dataset",
          detail: "Pick a chat-completion or question-answering dataset version for local training.",
          route: "/context?tab=fine-tuning-dataset",
        },
      }));
    }

    const exportSupport = createPathSupport({
      path: "export-preparation-only",
      title: "Export / preparation only",
      summary: "Validate the inputs and write a durable manifest or bundle without claiming that the model was trained.",
      blockers: exportBlockers,
      warnings,
    });
    const localTrainingSupport = createPathSupport({
      path: "local-training",
      title: "Real local training",
      summary: "Run the actual local Python training backend against a supported base model and dataset version.",
      blockers: localTrainingBlockers,
      warnings,
    });

    const paths = Object.freeze([exportSupport, localTrainingSupport]);
    const blockers = Object.freeze([...exportBlockers, ...localTrainingBlockers]);
    const state = deriveOverallState(paths);

    return Object.freeze({
      state,
      headline: buildHeadline(state, paths),
      summary: buildSummary(state, input.environment.runtimeMode),
      paths,
      blockers,
      warnings: Object.freeze([...new Set(warnings)]),
      recommendedNextSteps: Object.freeze(dedupeActions(recommendedNextSteps)),
    });
  }
}

function createPathSupport(params: {
  readonly path: ModelCreationPath;
  readonly title: string;
  readonly summary: string;
  readonly blockers: ReadonlyArray<ModelCreationBlocker>;
  readonly warnings: ReadonlyArray<string>;
}): ModelCreationPathSupport {
  const blockerStates = params.blockers.map((entry) => entry.state);
  const state: ModelCreationSupportState = blockerStates.includes("unavailable")
    ? "unavailable"
    : blockerStates.includes("degraded")
      ? "degraded"
      : "available";

  return Object.freeze({
    path: params.path,
    state,
    title: params.title,
    summary: params.summary,
    blockers: Object.freeze([...params.blockers]),
    warnings: Object.freeze([...params.warnings]),
  });
}

function buildHeadline(state: ModelCreationSupportState, paths: ReadonlyArray<ModelCreationPathSupport>): string {
  if (state === "available") {
    return "Everything required for model creation is ready.";
  }
  if (paths.some((entry) => entry.state === "available")) {
    return "Only part of model creation is available in this mode.";
  }
  if (state === "degraded") {
    return "Model creation is partially blocked by the current mode or runtime health.";
  }
  return "Model creation is unavailable until the current blockers are resolved.";
}

function buildSummary(state: ModelCreationSupportState, runtimeMode: AppRuntimeMode): string {
  if (runtimeMode === "browser-development") {
    return state === "unavailable"
      ? "Browser fallback mode can guide you, but it cannot expose unsupported local training actions."
      : "Browser fallback mode keeps only the truthful actions that can run without direct desktop file access.";
  }

  if (state === "available") {
    return "The current runtime mode supports the truthful model-creation paths that are implemented today.";
  }

  if (state === "degraded") {
    return "Some model-creation paths remain available, while others are hidden or downgraded until prerequisites are restored.";
  }

  return "The studio is showing a guided fallback because the current runtime mode cannot safely run the requested work.";
}

function deriveOverallState(paths: ReadonlyArray<ModelCreationPathSupport>): ModelCreationSupportState {
  if (paths.every((entry) => entry.state === "available")) {
    return "available";
  }
  if (paths.some((entry) => entry.state === "available" || entry.state === "degraded")) {
    return "degraded";
  }
  return "unavailable";
}

function createBlocker(blocker: ModelCreationBlocker): ModelCreationBlocker {
  return Object.freeze(blocker);
}

function formatTaskType(taskType: DatasetTaskType): string {
  return taskType.replace(/_/g, " ");
}

function pushIfMissing(target: ModelCreationRecommendedAction[], candidate: ModelCreationRecommendedAction): void {
  if (!target.some((entry) => entry.id === candidate.id)) {
    target.push(candidate);
  }
}

function dedupeActions(actions: ReadonlyArray<ModelCreationRecommendedAction>): ReadonlyArray<ModelCreationRecommendedAction> {
  const seen = new Set<ModelCreationRecommendedActionId>();
  return actions.filter((action) => {
    if (seen.has(action.id)) {
      return false;
    }
    seen.add(action.id);
    return true;
  });
}
