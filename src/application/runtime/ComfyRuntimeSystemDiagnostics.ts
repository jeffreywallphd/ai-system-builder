import {
  type ComfyRuntimeInstallerOrchestrationResult,
  type ComfyRuntimeOrchestrationIssue,
  type ComfyRuntimeOrchestrationPhaseResult,
} from "./ComfyRuntimeInstallerOrchestrationService";
import type { ComfyRuntimeInstallerPersistedState } from "./ComfyRuntimeInstallerStateContract";
import {
  ComfyRuntimeLifecycleStates,
  type ComfyRuntimeLifecycleResult,
} from "./ComfyRuntimeLifecycleContract";

export const ComfyRuntimeSystemDiagnosticsVersion = "ai-loom.comfy-runtime-system-diagnostics.v1";

export const ComfyRuntimeSystemReadinessStates = Object.freeze({
  ready: "ready",
  partiallyConfigured: "partially-configured",
  unhealthy: "unhealthy",
  missingDependenciesOrAssets: "missing-dependencies-or-assets",
  recoverable: "recoverable",
} as const);

export type ComfyRuntimeSystemReadinessState =
  (typeof ComfyRuntimeSystemReadinessStates)[keyof typeof ComfyRuntimeSystemReadinessStates];

export interface ComfyRuntimeSystemDiagnosticFailure {
  readonly code: string;
  readonly phase: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeSystemNextAction {
  readonly code: string;
  readonly priority: "high" | "medium" | "low";
  readonly message: string;
  readonly phase?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeSystemDiagnostics {
  readonly diagnosticsVersion: typeof ComfyRuntimeSystemDiagnosticsVersion;
  readonly generatedAt: string;
  readonly runtimeDependencyId: string;
  readonly runtimeAssetId: string;
  readonly runtimeAssetVersionId: string;
  readonly workflowProfile: string;
  readonly orchestrationState: "ready" | "partial" | "failed";
  readonly readiness: Readonly<{
    readonly state: ComfyRuntimeSystemReadinessState;
    readonly recoverable: boolean;
    readonly summary: string;
    readonly reasons: ReadonlyArray<string>;
  }>;
  readonly repository: Readonly<{
    readonly stateBefore: string;
    readonly stateAfter: string;
    readonly operation: string;
    readonly repositoryUri?: string;
    readonly requestedRevision?: string;
    readonly resolvedRevision?: string;
    readonly installLocationKey: string;
    readonly installDirectory: string;
    readonly validationValid: boolean;
  }>;
  readonly phaseStatus: Readonly<Record<string, string>>;
  readonly runtimeLifecycle: Readonly<{
    readonly state: string;
    readonly operation?: string;
    readonly endpoint?: string;
    readonly healthy?: boolean;
    readonly readinessStatusCode?: number;
    readonly livenessStatusCode?: number;
  }>;
  readonly persistedStateRecovery: Readonly<{
    readonly loaded: boolean;
    readonly recovered: boolean;
    readonly reconciliation: "match" | "mismatch" | "none";
    readonly statePath?: string;
  }>;
  readonly validationFailures: ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure>;
  readonly nextActions: ReadonlyArray<ComfyRuntimeSystemNextAction>;
  readonly failures: ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure>;
  readonly phaseDiagnostics: ReadonlyArray<Readonly<{
    readonly phase: string;
    readonly status: string;
    readonly message: string;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly issues: ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>>;
}

export function createComfyRuntimeSystemDiagnosticsFromOrchestration(
  result: Omit<ComfyRuntimeInstallerOrchestrationResult, "systemDiagnostics">,
): ComfyRuntimeSystemDiagnostics {
  const phasesByName = new Map(result.phases.map((entry) => [entry.phase, entry] as const));
  const runtimeLifecycle = readRuntimeLifecycle(phasesByName.get("runtime-validation"));
  const failures = freezeFailures(result.issues);
  const validationFailures = Object.freeze(failures.filter((entry) => entry.severity === "error"));
  const nextActions = deriveNextActions({
    phasesByName,
    failures,
    persistedState: result.persistedState,
  });
  const readiness = classifyReadiness({
    orchestrationState: result.state,
    phasesByName,
    validationFailures,
    runtimeLifecycle,
    nextActions,
  });

  return Object.freeze({
    diagnosticsVersion: ComfyRuntimeSystemDiagnosticsVersion,
    generatedAt: new Date().toISOString(),
    runtimeDependencyId: result.runtimeAsset.runtimeDependencyId,
    runtimeAssetId: result.runtimeAsset.assetId,
    runtimeAssetVersionId: result.runtimeAsset.versionId,
    workflowProfile: result.resolvedTargets.workflowProfile,
    orchestrationState: result.state,
    readiness,
    repository: Object.freeze({
      stateBefore: result.repository.statusBefore.state,
      stateAfter: result.repository.statusAfter.state,
      operation: result.repository.operation,
      repositoryUri: result.repository.statusAfter.installed?.source.repositoryUri,
      requestedRevision: result.repository.statusAfter.installed?.source.requestedRevision,
      resolvedRevision: result.repository.statusAfter.installed?.resolvedRevision,
      installLocationKey: result.repository.statusAfter.installLocation.installLocationKey,
      installDirectory: result.repository.statusAfter.installLocation.installDirectory,
      validationValid: result.repository.validation?.valid ?? false,
    }),
    phaseStatus: Object.freeze(Object.fromEntries(result.phases.map((entry) => [entry.phase, entry.status]))),
    runtimeLifecycle,
    persistedStateRecovery: Object.freeze({
      loaded: result.persistedState?.loaded ?? false,
      recovered: result.persistedState?.recovered ?? false,
      reconciliation: result.persistedState?.reconciliation ?? "none",
      statePath: result.persistedState?.statePath,
    }),
    validationFailures,
    nextActions,
    failures,
    phaseDiagnostics: Object.freeze(result.phases.map((entry) => Object.freeze({
      phase: entry.phase,
      status: entry.status,
      message: entry.message,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      issues: Object.freeze(entry.issues.map((issue) => Object.freeze({
        code: issue.code,
        phase: issue.phase,
        severity: issue.severity,
        message: issue.message,
        metadata: issue.metadata,
      }))),
      metadata: entry.metadata,
    }))),
  });
}

export function createComfyRuntimeSystemDiagnosticsFromPersistedState(
  state: ComfyRuntimeInstallerPersistedState,
): ComfyRuntimeSystemDiagnostics {
  const phases = Object.entries(state.phases)
    .map(([phase, value]) => Object.freeze({
      phase,
      status: value.status,
      message: value.message,
      startedAt: value.updatedAt,
      finishedAt: value.updatedAt,
      issues: Object.freeze(value.issues.map((issue) => Object.freeze({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        phase: issue.phase,
        metadata: issue.metadata,
      }))),
      metadata: value.metadata,
    }));
  const phasesByName = new Map(phases.map((entry) => [entry.phase, entry] as const));
  const failures = freezeFailures(state.issues);
  const validationFailures = Object.freeze(failures.filter((entry) => entry.severity === "error"));
  const runtimeLifecycle = state.lastLifecycle
    ? Object.freeze({
      state: state.lastLifecycle.state,
      operation: state.lastLifecycle.operation,
      endpoint: state.lastLifecycle.endpointValidation.endpoint,
      healthy: state.lastLifecycle.health?.healthy,
      readinessStatusCode: state.lastLifecycle.health?.readinessStatusCode,
      livenessStatusCode: state.lastLifecycle.health?.livenessStatusCode,
    })
    : Object.freeze({
      state: ComfyRuntimeLifecycleStates.unknown,
    });
  const nextActions = deriveNextActions({
    phasesByName,
    failures,
    persistedState: {
      loaded: true,
      recovered: state.orchestrationState !== "ready",
      reconciliation: "none",
      statePath: typeof state.diagnostics.statePath === "string" ? state.diagnostics.statePath : undefined,
    },
  });
  const readiness = classifyReadiness({
    orchestrationState: state.orchestrationState,
    phasesByName,
    validationFailures,
    runtimeLifecycle,
    nextActions,
  });

  return Object.freeze({
    diagnosticsVersion: ComfyRuntimeSystemDiagnosticsVersion,
    generatedAt: state.updatedAt,
    runtimeDependencyId: state.runtimeDependencyId,
    runtimeAssetId: state.runtimeAssetId,
    runtimeAssetVersionId: state.runtimeAssetVersionId,
    workflowProfile: "image-manipulation-default",
    orchestrationState: state.orchestrationState,
    readiness,
    repository: Object.freeze({
      stateBefore: state.repositoryState,
      stateAfter: state.repositoryState,
      operation: "persisted-state",
      resolvedRevision: state.repositoryRevision,
      installLocationKey: state.installLocationKey,
      installDirectory: state.installDirectory,
      validationValid: state.repositoryState === "installed",
    }),
    phaseStatus: Object.freeze(Object.fromEntries(phases.map((entry) => [entry.phase, entry.status]))),
    runtimeLifecycle,
    persistedStateRecovery: Object.freeze({
      loaded: true,
      recovered: state.orchestrationState !== "ready",
      reconciliation: "none",
      statePath: typeof state.diagnostics.statePath === "string" ? state.diagnostics.statePath : undefined,
    }),
    validationFailures,
    nextActions,
    failures,
    phaseDiagnostics: Object.freeze(phases),
  });
}

export function readComfyRuntimeSystemDiagnostics(value: unknown): ComfyRuntimeSystemDiagnostics | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Partial<ComfyRuntimeSystemDiagnostics>;
  if (candidate.diagnosticsVersion !== ComfyRuntimeSystemDiagnosticsVersion) {
    return undefined;
  }
  if (!candidate.runtimeDependencyId || !candidate.runtimeAssetId || !candidate.runtimeAssetVersionId) {
    return undefined;
  }
  if (!candidate.readiness || typeof candidate.readiness !== "object") {
    return undefined;
  }
  return Object.freeze(candidate as ComfyRuntimeSystemDiagnostics);
}

function readRuntimeLifecycle(
  runtimePhase: ComfyRuntimeOrchestrationPhaseResult | undefined,
): ComfyRuntimeSystemDiagnostics["runtimeLifecycle"] {
  const lifecycle = runtimePhase?.metadata?.runtimeLifecycle as ComfyRuntimeLifecycleResult | undefined;
  if (!lifecycle) {
    return Object.freeze({
      state: ComfyRuntimeLifecycleStates.unknown,
    });
  }
  return Object.freeze({
    state: lifecycle.state,
    operation: lifecycle.operation,
    endpoint: lifecycle.endpointValidation.endpoint,
    healthy: lifecycle.health?.healthy,
    readinessStatusCode: lifecycle.health?.readinessStatusCode,
    livenessStatusCode: lifecycle.health?.livenessStatusCode,
  });
}

function freezeFailures(issues: ReadonlyArray<ComfyRuntimeOrchestrationIssue>): ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure> {
  return Object.freeze(issues.map((entry) => Object.freeze({
    code: entry.code,
    phase: entry.phase,
    severity: entry.severity,
    message: entry.message,
    metadata: entry.metadata,
  })));
}

function deriveNextActions(input: {
  readonly phasesByName: ReadonlyMap<string, { readonly status: string }>;
  readonly failures: ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure>;
  readonly persistedState?: {
    readonly loaded: boolean;
    readonly recovered: boolean;
    readonly reconciliation: "match" | "mismatch" | "none";
    readonly statePath?: string;
  };
}): ReadonlyArray<ComfyRuntimeSystemNextAction> {
  const actions = new Map<string, ComfyRuntimeSystemNextAction>();
  for (const failure of input.failures) {
    const next = mapFailureToAction(failure);
    if (!next) {
      continue;
    }
    actions.set(next.code, next);
  }

  for (const [phase, detail] of input.phasesByName.entries()) {
    if (detail.status !== "not-implemented") {
      continue;
    }
    const code = `${phase}-implementation-pending`;
    if (actions.has(code)) {
      continue;
    }
    actions.set(code, Object.freeze({
      code,
      priority: "low",
      message: `Implement '${phase}' diagnostics and remediation hook to reach full runtime readiness.`,
      phase,
    }));
  }

  if (input.persistedState?.reconciliation === "mismatch") {
    actions.set("reconcile-installer-state", Object.freeze({
      code: "reconcile-installer-state",
      priority: "medium",
      message: "Reconcile persisted installer state with observed runtime repository state before continuing.",
      phase: "repository",
      metadata: input.persistedState.statePath
        ? Object.freeze({ statePath: input.persistedState.statePath })
        : undefined,
    }));
  }

  const sorted = [...actions.values()].sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority));
  return Object.freeze(sorted);
}

function mapFailureToAction(
  failure: ComfyRuntimeSystemDiagnosticFailure,
): ComfyRuntimeSystemNextAction | undefined {
  if (failure.phase === "repository") {
    return Object.freeze({
      code: "repair-runtime-repository",
      priority: "high",
      message: "Repair or reinstall the ComfyUI runtime repository and re-run validation.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  if (failure.phase === "environment") {
    return Object.freeze({
      code: "provision-python-environment",
      priority: "high",
      message: "Provision a compatible Python environment for ComfyUI runtime.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  if (failure.phase === "dependencies") {
    return Object.freeze({
      code: "install-python-dependencies",
      priority: "high",
      message: "Install or repair ComfyUI Python dependencies in the provisioned environment.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  if (failure.phase === "custom-nodes") {
    return Object.freeze({
      code: "install-required-custom-nodes",
      priority: "medium",
      message: "Install or update required custom node repositories for the active workflow profile.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  if (failure.phase === "model-validation") {
    return Object.freeze({
      code: "install-required-runtime-assets",
      priority: "high",
      message: "Install missing or incompatible model/runtime assets required by this workflow profile.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  if (failure.phase === "runtime-validation") {
    return Object.freeze({
      code: "restore-runtime-health",
      priority: "high",
      message: "Restart ComfyUI runtime and verify readiness/liveness endpoints are reachable.",
      phase: failure.phase,
      metadata: failure.metadata,
    });
  }
  return undefined;
}

function classifyReadiness(input: {
  readonly orchestrationState: "ready" | "partial" | "failed";
  readonly phasesByName: ReadonlyMap<string, { readonly status: string }>;
  readonly validationFailures: ReadonlyArray<ComfyRuntimeSystemDiagnosticFailure>;
  readonly runtimeLifecycle: ComfyRuntimeSystemDiagnostics["runtimeLifecycle"];
  readonly nextActions: ReadonlyArray<ComfyRuntimeSystemNextAction>;
}): ComfyRuntimeSystemDiagnostics["readiness"] {
  const failureCodes = input.validationFailures.map((entry) => `${entry.phase}:${entry.code}`.toLowerCase());
  const hasMissingDependencies = failureCodes.some((entry) => (
    entry.includes("missing")
    || entry.includes("dependency")
    || entry.includes("requirements")
    || entry.includes("asset")
    || entry.includes("model-validation")
  ));
  const hasRuntimeHealthFailure = input.runtimeLifecycle.state === ComfyRuntimeLifecycleStates.unhealthy
    || input.runtimeLifecycle.state === ComfyRuntimeLifecycleStates.timedOut
    || input.phasesByName.get("runtime-validation")?.status === "failed";
  const hasFailures = input.validationFailures.length > 0;

  if (!hasFailures && input.orchestrationState === "ready") {
    return Object.freeze({
      state: ComfyRuntimeSystemReadinessStates.ready,
      recoverable: false,
      summary: "ComfyUI runtime is ready.",
      reasons: Object.freeze(["all-installer-phases-completed"]),
    });
  }

  if (hasMissingDependencies) {
    return Object.freeze({
      state: ComfyRuntimeSystemReadinessStates.missingDependenciesOrAssets,
      recoverable: input.nextActions.length > 0,
      summary: "ComfyUI runtime is missing required dependencies or assets.",
      reasons: Object.freeze(["missing-runtime-dependencies-or-assets"]),
    });
  }

  if (hasRuntimeHealthFailure) {
    return Object.freeze({
      state: ComfyRuntimeSystemReadinessStates.unhealthy,
      recoverable: input.nextActions.length > 0,
      summary: "ComfyUI runtime is installed but unhealthy.",
      reasons: Object.freeze(["runtime-health-check-failed"]),
    });
  }

  if (hasFailures) {
    return Object.freeze({
      state: ComfyRuntimeSystemReadinessStates.recoverable,
      recoverable: input.nextActions.length > 0,
      summary: "ComfyUI runtime is recoverable with remediation actions.",
      reasons: Object.freeze(["installer-diagnostics-reported-failures"]),
    });
  }

  return Object.freeze({
    state: ComfyRuntimeSystemReadinessStates.partiallyConfigured,
    recoverable: input.nextActions.length > 0,
    summary: "ComfyUI runtime is partially configured.",
    reasons: Object.freeze(["installer-reported-partial-state"]),
  });
}

function priorityWeight(priority: ComfyRuntimeSystemNextAction["priority"]): number {
  if (priority === "high") {
    return 1;
  }
  if (priority === "medium") {
    return 2;
  }
  return 3;
}
