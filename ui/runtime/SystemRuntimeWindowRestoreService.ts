import {
  createSystemRuntimeWindowLaunchContract,
  type LaunchSystemRuntimeWindowRequest,
  type SystemRuntimeWindowLaunchContract,
} from "../../application/system-runtime/SystemRuntimeWindowLaunchContract";
import {
  type RuntimeWindowSessionScope,
  type RuntimeWindowSessionState,
  SystemRuntimeWindowSessionPersistenceService,
} from "./SystemRuntimeWindowSessionPersistenceService";
import {
  type RuntimeHydrationIssue,
  SystemRuntimeWindowHydrationService,
  type SystemRuntimeHydratedState,
} from "./SystemRuntimeWindowHydrationService";
import type { StudioShellSnapshotReadModel } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";

export type RuntimeWindowRestoreIssueSeverity = "warning" | "error";
export type RuntimeWindowRestoreIssueSource = "launch" | "hydration" | "session-restore";

export interface RuntimeWindowRestoreIssue {
  readonly code: string;
  readonly source: RuntimeWindowRestoreIssueSource;
  readonly severity: RuntimeWindowRestoreIssueSeverity;
  readonly message: string;
  readonly path?: string;
}

export interface SystemRuntimeWindowRestoreResult {
  readonly ok: boolean;
  readonly launchContract?: SystemRuntimeWindowLaunchContract;
  readonly state?: SystemRuntimeHydratedState;
  readonly sessionScope?: RuntimeWindowSessionScope;
  readonly persistedSession?: RuntimeWindowSessionState;
  readonly issues: ReadonlyArray<RuntimeWindowRestoreIssue>;
}

function toRestoreIssue(
  source: RuntimeWindowRestoreIssueSource,
  issue: RuntimeHydrationIssue | Omit<RuntimeWindowRestoreIssue, "source">,
): RuntimeWindowRestoreIssue {
  return Object.freeze({
    source,
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    path: issue.path,
  });
}

function mergeRuntimeStateWithSession(
  runtimeState: Readonly<Record<string, unknown>> | undefined,
  session: RuntimeWindowSessionState | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!session) {
    return runtimeState;
  }
  return Object.freeze({
    ...(runtimeState ?? {}),
    property: Object.freeze({
      presetId: session.property.presetId,
      config: session.property.config,
    }),
    selection: session.selection,
    panelState: session.panelState,
    restore: Object.freeze({
      source: "persisted-runtime-session",
      restoredFromLaunchId: session.launch.launchId,
      runtimeSessionId: session.launch.runtimeSessionId,
      updatedAt: session.updatedAt,
    }),
  });
}

function mergeHydrationStateWithSession(
  hydratedState: SystemRuntimeHydratedState,
  session: RuntimeWindowSessionState | undefined,
): SystemRuntimeHydratedState {
  if (!session) {
    return hydratedState;
  }
  return Object.freeze({
    ...hydratedState,
    propertySchema: Object.freeze({
      ...hydratedState.propertySchema,
      presetId: session.property.presetId,
      defaults: session.property.config,
    }),
    initialSelection: Object.freeze({
      selectedDatasetBindingId: session.selection.selectedDatasetBindingId
        ?? hydratedState.initialSelection.selectedDatasetBindingId,
      activePreviewRole: session.selection.activePreviewRole,
      selectedRecordIds: Object.freeze({
        ...hydratedState.initialSelection.selectedRecordIds,
        ...session.selection.selectedRecordIds,
      }),
      gallerySelectionRecordIds: session.selection.gallerySelectionRecordIds.length > 0
        ? session.selection.gallerySelectionRecordIds
        : hydratedState.initialSelection.gallerySelectionRecordIds,
    }),
    runtimeState: mergeRuntimeStateWithSession(hydratedState.runtimeState, session),
  });
}

export class SystemRuntimeWindowRestoreService {
  public constructor(
    private readonly hydrationService = new SystemRuntimeWindowHydrationService(),
    private readonly sessionPersistence = new SystemRuntimeWindowSessionPersistenceService(),
  ) {}

  public restore(input: {
    readonly launchContract?: SystemRuntimeWindowLaunchContract;
    readonly snapshot?: StudioShellSnapshotReadModel;
  }): SystemRuntimeWindowRestoreResult {
    if (!input.launchContract) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([toRestoreIssue("launch", {
          code: "runtime-window.launch-contract.missing",
          severity: "error",
          message: "Runtime launch contract is missing or invalid.",
          path: "launchContract",
        })]),
      });
    }

    const hydration = this.hydrationService.hydrate({
      launchContract: input.launchContract,
      snapshot: input.snapshot,
    });
    const issues: RuntimeWindowRestoreIssue[] = hydration.issues.map((issue) => toRestoreIssue("hydration", issue));
    const sessionScope = this.sessionPersistence.resolveScope({
      launch: input.launchContract,
      hydratedRuntime: hydration.state,
      draftId: input.snapshot?.draft?.draftId,
    });
    const persistedSession = this.sessionPersistence.load(sessionScope);
    const normalizedSession = this.normalizePersistedSession({
      persistedSession,
      hydratedState: hydration.state,
      issues,
    });
    const state = hydration.state
      ? mergeHydrationStateWithSession(hydration.state, normalizedSession)
      : undefined;

    return Object.freeze({
      ok: !issues.some((issue) => issue.severity === "error"),
      launchContract: input.launchContract,
      state,
      sessionScope,
      persistedSession: normalizedSession,
      issues: Object.freeze(issues),
    });
  }

  public buildReopenRequest(request: LaunchSystemRuntimeWindowRequest): LaunchSystemRuntimeWindowRequest {
    const launchContract = request.launchContract;
    const scope = this.sessionPersistence.resolveScope({ launch: launchContract });
    const persistedSession = this.sessionPersistence.load(scope);
    if (!persistedSession) {
      return request;
    }

    const next = createSystemRuntimeWindowLaunchContract({
      ...launchContract,
      resolution: {
        ...launchContract.resolution,
        sessionId: persistedSession.launch.runtimeSessionId
          ?? launchContract.resolution.sessionId,
      },
      initialSelection: {
        ...launchContract.initialSelection,
        selectedDatasetBindingId: persistedSession.selection.selectedDatasetBindingId
          ?? launchContract.initialSelection.selectedDatasetBindingId,
        activePreviewRole: persistedSession.selection.activePreviewRole,
        selectedRecordIds: {
          ...launchContract.initialSelection.selectedRecordIds,
          ...persistedSession.selection.selectedRecordIds,
        },
      },
      runtimeContextPayload: {
        ...launchContract.runtimeContextPayload,
        runtimeState: mergeRuntimeStateWithSession(
          this.readRecord(launchContract.runtimeContextPayload.runtimeState),
          persistedSession,
        ),
      },
    });

    return Object.freeze({
      launchContract: next,
    });
  }

  private normalizePersistedSession(input: {
    readonly persistedSession?: RuntimeWindowSessionState;
    readonly hydratedState?: SystemRuntimeHydratedState;
    readonly issues: RuntimeWindowRestoreIssue[];
  }): RuntimeWindowSessionState | undefined {
    if (!input.persistedSession) {
      return undefined;
    }
    if (!input.hydratedState) {
      input.issues.push(toRestoreIssue("session-restore", {
        code: "runtime-window.restore.hydration-unavailable",
        severity: "warning",
        message: "Persisted runtime session state was found, but hydration was unavailable so restore was skipped.",
      }));
      return undefined;
    }

    const datasetBindingIds = new Set(input.hydratedState.datasetBindings.map((binding) => binding.bindingId));
    const selectedRecordIds: Record<string, string> = {};
    for (const [bindingId, recordId] of Object.entries(input.persistedSession.selection.selectedRecordIds)) {
      if (!datasetBindingIds.has(bindingId)) {
        input.issues.push(toRestoreIssue("session-restore", {
          code: "runtime-window.restore.selection-binding-stale",
          severity: "warning",
          message: `Skipping persisted selection for stale dataset binding '${bindingId}'.`,
          path: `selection.selectedRecordIds.${bindingId}`,
        }));
        continue;
      }
      selectedRecordIds[bindingId] = recordId;
    }

    const selectedDatasetBindingId = input.persistedSession.selection.selectedDatasetBindingId;
    const normalizedSelectedDatasetBindingId = selectedDatasetBindingId && datasetBindingIds.has(selectedDatasetBindingId)
      ? selectedDatasetBindingId
      : undefined;
    if (selectedDatasetBindingId && !normalizedSelectedDatasetBindingId) {
      input.issues.push(toRestoreIssue("session-restore", {
        code: "runtime-window.restore.selected-dataset-binding-stale",
        severity: "warning",
        message: `Persisted selected dataset binding '${selectedDatasetBindingId}' is unavailable; using hydrated defaults.`,
        path: "selection.selectedDatasetBindingId",
      }));
    }

    if (
      input.persistedSession.resolvedPage.pageBindingId
      && input.persistedSession.resolvedPage.pageBindingId !== input.hydratedState.resolvedPage.pageBindingId
    ) {
      input.issues.push(toRestoreIssue("session-restore", {
        code: "runtime-window.restore.page-binding-mismatch",
        severity: "warning",
        message: "Persisted page context no longer matches the launch page binding; restore fell back to hydrated page context.",
        path: "resolvedPage.pageBindingId",
      }));
    }

    return Object.freeze({
      ...input.persistedSession,
      selection: Object.freeze({
        ...input.persistedSession.selection,
        selectedDatasetBindingId: normalizedSelectedDatasetBindingId,
        selectedRecordIds: Object.freeze(selectedRecordIds),
      }),
    });
  }

  private readRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Readonly<Record<string, unknown>>;
  }
}
