import path from "node:path";
import {
  RuntimeRepositoryInstallationStates,
  type IRuntimeRepositoryInstallerContract,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryInstallResult,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryUpdateResult,
  type RuntimeRepositoryValidationResult,
} from "./RuntimeRepositoryInstallerContract";
import {
  resolveComfyRuntimeInstallerRequests,
  resolveComfyRuntimeWorkingDirectory,
  type ComfyRuntimeInstallationAsset,
  type ResolveComfyRuntimeInstallerRequestInput,
} from "./ComfyRuntimeInstallationAsset";
import {
  ComfyRuntimeWorkflowProfiles,
  resolveComfyRuntimeWorkflowProfile,
  type ComfyRuntimeWorkflowProfile,
} from "./ComfyRuntimeRequirements";
import {
  type IComfyRuntimeInstallerStateStore,
  createComfyRuntimeInstallerPersistedState,
} from "./ComfyRuntimeInstallerStateContract";
import { type ComfyRuntimeLifecycleResult } from "./ComfyRuntimeLifecycleContract";
import {
  createComfyRuntimeSystemDiagnosticsFromOrchestration,
  type ComfyRuntimeSystemDiagnostics,
} from "./ComfyRuntimeSystemDiagnostics";

export const ComfyRuntimeOrchestrationStates = Object.freeze({
  ready: "ready",
  partial: "partial",
  failed: "failed",
} as const);

export type ComfyRuntimeOrchestrationState =
  (typeof ComfyRuntimeOrchestrationStates)[keyof typeof ComfyRuntimeOrchestrationStates];

export const ComfyRuntimeOrchestrationPhaseStatuses = Object.freeze({
  completed: "completed",
  failed: "failed",
  skipped: "skipped",
  notImplemented: "not-implemented",
} as const);

export type ComfyRuntimeOrchestrationPhaseStatus =
  (typeof ComfyRuntimeOrchestrationPhaseStatuses)[keyof typeof ComfyRuntimeOrchestrationPhaseStatuses];

export interface ComfyRuntimeOrchestrationIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly phase: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeOrchestrationPhaseResult {
  readonly phase: "repository" | "environment" | "dependencies" | "custom-nodes" | "model-validation" | "runtime-validation";
  readonly status: ComfyRuntimeOrchestrationPhaseStatus;
  readonly message: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly issues: ReadonlyArray<ComfyRuntimeOrchestrationIssue>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeOrchestrationContext {
  readonly runtimeAsset: ComfyRuntimeInstallationAsset;
  readonly installDirectory: string;
  readonly runtimeWorkingDirectory: string;
  readonly runtimeEndpoint: string;
  readonly runtimeHost: string;
  readonly runtimePort: number;
  readonly runtimeEnvironment: Readonly<Record<string, string>>;
  readonly runtimeStartupTimeoutMs: number;
  readonly workflowProfile: ComfyRuntimeWorkflowProfile;
}

export interface IComfyRuntimeEnvironmentPreparationHook {
  prepare(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult>;
}

export interface IComfyRuntimeDependencyInstallationHook {
  installDependencies(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult>;
}

export interface IComfyRuntimeCustomNodeInstallationHook {
  installCustomNodes(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult>;
}

export interface IComfyRuntimeModelValidationHook {
  validateModels(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult>;
}

export interface IComfyRuntimeStartStopValidationHook {
  validateRuntime(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult>;
}

export interface ComfyRuntimeOrchestrationPhaseHookResult {
  readonly status: Extract<ComfyRuntimeOrchestrationPhaseStatus, "completed" | "failed" | "skipped">;
  readonly message: string;
  readonly issues?: ReadonlyArray<ComfyRuntimeOrchestrationIssue>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeInstallerOrchestrationRequest {
  readonly runtimeAsset?: ComfyRuntimeInstallationAsset;
  readonly targetRootDirectory: string;
  readonly installLocationKey?: string;
  readonly requestedRevision?: {
    readonly kind: "branch" | "tag" | "commit";
    readonly value: string;
  };
  readonly expectedRevision?: string;
  readonly updateMode?: "install-only" | "install-or-update";
  readonly includeRepositoryDiagnostics?: boolean;
  readonly workflowProfile?: ComfyRuntimeWorkflowProfile;
  readonly runtimeHostOverride?: string;
  readonly runtimePortOverride?: number;
  readonly runtimeEnvironment?: Readonly<Record<string, string>>;
  readonly runtimeStartupTimeoutMs?: number;
  readonly recoveryMode?: "resume" | "repair" | "revalidate";
}

export interface ComfyRuntimeInstallerOrchestrationResult {
  readonly state: ComfyRuntimeOrchestrationState;
  readonly runtimeAsset: ComfyRuntimeInstallationAsset;
  readonly resolvedTargets: Readonly<{
    readonly targetRootDirectory: string;
    readonly installDirectory: string;
    readonly runtimeWorkingDirectory: string;
    readonly runtimeEndpoint: string;
    readonly installLocationKey: string;
    readonly workflowProfile: ComfyRuntimeWorkflowProfile;
  }>;
  readonly repository: Readonly<{
    readonly operation: "installed" | "updated" | "already-installed" | "already-current" | "failed" | "skipped";
    readonly statusBefore: RuntimeRepositoryStatusResult;
    readonly statusAfter: RuntimeRepositoryStatusResult;
    readonly installResult?: RuntimeRepositoryInstallResult;
    readonly updateResult?: RuntimeRepositoryUpdateResult;
    readonly validation?: RuntimeRepositoryValidationResult;
    readonly diagnostics?: RuntimeRepositoryDiagnosticsResult;
  }>;
  readonly phases: ReadonlyArray<ComfyRuntimeOrchestrationPhaseResult>;
  readonly issues: ReadonlyArray<ComfyRuntimeOrchestrationIssue>;
  readonly systemDiagnostics: ComfyRuntimeSystemDiagnostics;
  readonly persistedState?: Readonly<{
    readonly loaded: boolean;
    readonly statePath?: string;
    readonly recovered: boolean;
    readonly reconciliation: "match" | "mismatch" | "none";
  }>;
}

export interface ComfyRuntimeInstallerOrchestrationServiceOptions {
  readonly environmentPreparationHook?: IComfyRuntimeEnvironmentPreparationHook;
  readonly dependencyInstallationHook?: IComfyRuntimeDependencyInstallationHook;
  readonly customNodeInstallationHook?: IComfyRuntimeCustomNodeInstallationHook;
  readonly modelValidationHook?: IComfyRuntimeModelValidationHook;
  readonly runtimeValidationHook?: IComfyRuntimeStartStopValidationHook;
  readonly stateStore?: IComfyRuntimeInstallerStateStore;
  readonly now?: () => Date;
}

export class ComfyRuntimeInstallerOrchestrationService {
  private readonly environmentPreparationHook?: IComfyRuntimeEnvironmentPreparationHook;
  private readonly dependencyInstallationHook?: IComfyRuntimeDependencyInstallationHook;
  private readonly customNodeInstallationHook?: IComfyRuntimeCustomNodeInstallationHook;
  private readonly modelValidationHook?: IComfyRuntimeModelValidationHook;
  private readonly runtimeValidationHook?: IComfyRuntimeStartStopValidationHook;
  private readonly stateStore?: IComfyRuntimeInstallerStateStore;
  private readonly now: () => Date;

  public constructor(
    private readonly repositoryInstaller: IRuntimeRepositoryInstallerContract,
    options: ComfyRuntimeInstallerOrchestrationServiceOptions = {},
  ) {
    this.environmentPreparationHook = options.environmentPreparationHook;
    this.dependencyInstallationHook = options.dependencyInstallationHook;
    this.customNodeInstallationHook = options.customNodeInstallationHook;
    this.modelValidationHook = options.modelValidationHook;
    this.runtimeValidationHook = options.runtimeValidationHook;
    this.stateStore = options.stateStore;
    this.now = options.now ?? (() => new Date());
  }

  public async orchestrate(
    request: ComfyRuntimeInstallerOrchestrationRequest,
  ): Promise<ComfyRuntimeInstallerOrchestrationResult> {
    const installerRequests = resolveComfyRuntimeInstallerRequests({
      runtimeAsset: request.runtimeAsset,
      targetRootDirectory: request.targetRootDirectory,
      installLocationKey: request.installLocationKey,
      requestedRevision: request.requestedRevision,
      includeRepositoryDiagnostics: request.includeRepositoryDiagnostics,
      expectedRevision: request.expectedRevision,
    });

    const statusBefore = await this.repositoryInstaller.inspectStatus(installerRequests.statusRequest);
    let statusAfter = statusBefore;
    let installResult: RuntimeRepositoryInstallResult | undefined;
    let updateResult: RuntimeRepositoryUpdateResult | undefined;
    let repositoryOperation: ComfyRuntimeInstallerOrchestrationResult["repository"]["operation"] = "skipped";
    const issues: ComfyRuntimeOrchestrationIssue[] = [];
    const phases: ComfyRuntimeOrchestrationPhaseResult[] = [];
    const startedAt = this.now().toISOString();

    if (
      statusBefore.state === RuntimeRepositoryInstallationStates.notInstalled
      || statusBefore.state === RuntimeRepositoryInstallationStates.partiallyInstalled
      || statusBefore.state === RuntimeRepositoryInstallationStates.invalid
    ) {
      installResult = await this.repositoryInstaller.install(installerRequests.installRequest);
      repositoryOperation = installResult.operation;
      statusAfter = await this.repositoryInstaller.inspectStatus(installerRequests.statusRequest);
      if (!installResult.success || !statusAfter.installed) {
        issues.push(
          issue("repository-install-failed", "error", "Repository install failed for ComfyUI runtime.", "repository", {
            operation: installResult.operation,
          }),
        );
      }
    } else if ((request.updateMode ?? "install-or-update") === "install-or-update") {
      updateResult = await this.repositoryInstaller.update(installerRequests.updateRequest);
      repositoryOperation = updateResult.operation;
      statusAfter = await this.repositoryInstaller.inspectStatus(installerRequests.statusRequest);
      if (!updateResult.success) {
        issues.push(
          issue("repository-update-failed", "error", "Repository update failed for ComfyUI runtime.", "repository", {
            operation: updateResult.operation,
          }),
        );
      }
    } else {
      repositoryOperation = "skipped";
    }

    const validation = await this.repositoryInstaller.validate(installerRequests.validationRequest);
    if (!validation.valid) {
      issues.push(issue(
        "repository-validation-failed",
        "error",
        "ComfyUI runtime repository validation failed.",
        "repository",
      ));
    }
    const diagnostics = await this.repositoryInstaller.collectDiagnostics(installerRequests.diagnosticsRequest);

    const installDirectory = statusAfter.installLocation.installDirectory;
    const runtimeWorkingDirectory = resolveComfyRuntimeWorkingDirectory({
      runtimeAsset: installerRequests.runtimeAsset,
      installDirectory,
    });
    const runtimeHost = request.runtimeHostOverride?.trim() || installerRequests.runtimeAsset.runtimeStart.defaultHost;
    const runtimePort = Number.isInteger(request.runtimePortOverride) && (request.runtimePortOverride ?? 0) > 0
      ? Number(request.runtimePortOverride)
      : installerRequests.runtimeAsset.runtimeStart.defaultPort;
    const runtimeEndpoint = `http://${runtimeHost}:${runtimePort}`;
    const runtimeEnvironment = Object.freeze({
      ...(request.runtimeEnvironment ?? {}),
      COMFYUI_HOST: runtimeHost,
      COMFYUI_PORT: `${runtimePort}`,
    });
    const runtimeStartupTimeoutMs = Number.isInteger(request.runtimeStartupTimeoutMs) && (request.runtimeStartupTimeoutMs ?? 0) > 0
      ? Number(request.runtimeStartupTimeoutMs)
      : installerRequests.runtimeAsset.runtimeHealth.startupTimeoutMs;
    const workflowProfile = resolveComfyRuntimeWorkflowProfile(
      request.workflowProfile ?? ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
    );

    const context: ComfyRuntimeOrchestrationContext = Object.freeze({
      runtimeAsset: installerRequests.runtimeAsset,
      installDirectory,
      runtimeWorkingDirectory,
      runtimeEndpoint,
      runtimeHost,
      runtimePort,
      runtimeEnvironment,
      runtimeStartupTimeoutMs,
      workflowProfile,
    });

    let persistedStateInfo: ComfyRuntimeInstallerOrchestrationResult["persistedState"] | undefined;
    const phasePlan = new Set<ComfyRuntimeOrchestrationPhaseResult["phase"]>([
      "environment",
      "dependencies",
      "custom-nodes",
      "model-validation",
      "runtime-validation",
    ]);
    if (this.stateStore) {
      const persisted = await this.stateStore.load({ installDirectory });
      for (const diagnostic of persisted.diagnostics) {
        issues.push({
          code: diagnostic.code,
          severity: diagnostic.severity,
          message: diagnostic.message,
          phase: diagnostic.phase,
          metadata: diagnostic.metadata,
        });
      }
      const previous = persisted.state;
      if (previous) {
        const repositoryMismatch = previous.repositoryState !== statusBefore.state;
        const revisionBefore = statusBefore.installed?.resolvedRevision;
        const revisionMismatch = Boolean(previous.repositoryRevision && revisionBefore && previous.repositoryRevision !== revisionBefore);
        const recoveryMode = request.recoveryMode ?? "resume";
        if (repositoryMismatch || revisionMismatch) {
          issues.push(issue(
            "installer-state-reconciliation-mismatch",
            "warning",
            "Persisted installer state differs from observed runtime repository state.",
            "repository",
            {
              persistedRepositoryState: previous.repositoryState,
              observedRepositoryState: statusBefore.state,
              persistedRevision: previous.repositoryRevision,
              observedRevision: revisionBefore,
            },
          ));
          phasePlan.clear();
          phasePlan.add("environment");
          phasePlan.add("dependencies");
          phasePlan.add("custom-nodes");
          phasePlan.add("model-validation");
          phasePlan.add("runtime-validation");
          persistedStateInfo = Object.freeze({
            loaded: true,
            statePath: previous.diagnostics.statePath as string | undefined,
            recovered: true,
            reconciliation: "mismatch",
          });
        } else {
          const completedPhases = new Set(Object.entries(previous.phases)
            .filter(([, phase]) => phase.status === "completed")
            .map(([name]) => name));
          if (recoveryMode === "resume") {
            for (const phase of ["environment", "dependencies", "custom-nodes"] as const) {
              if (completedPhases.has(phase)) {
                phasePlan.delete(phase);
              }
            }
          } else if (recoveryMode === "revalidate") {
            for (const phase of ["environment", "dependencies", "custom-nodes"] as const) {
              if (completedPhases.has(phase)) {
                phasePlan.delete(phase);
              }
            }
            phasePlan.add("model-validation");
            phasePlan.add("runtime-validation");
          }
          persistedStateInfo = Object.freeze({
            loaded: true,
            statePath: previous.diagnostics.statePath as string | undefined,
            recovered: recoveryMode !== "repair",
            reconciliation: "match",
          });
        }
      } else {
        persistedStateInfo = Object.freeze({
          loaded: false,
          recovered: false,
          reconciliation: "none",
        });
      }
    }

    phases.push(this.createRepositoryPhase({
      operation: repositoryOperation,
      beforeState: statusBefore.state,
      afterState: statusAfter.state,
      validationValid: validation.valid,
      issues,
    }));

    const repositoryHealthy = !issues.some((entry) => entry.phase === "repository" && entry.severity === "error");
    if (repositoryHealthy) {
      phases.push(await this.executeHookPhase("environment", phasePlan.has("environment")
        ? this.environmentPreparationHook
          ? () => this.environmentPreparationHook!.prepare(context)
          : undefined
        : undefined, "environment-preparation-not-implemented", !phasePlan.has("environment")
        ? "Skipped because persisted installer state indicates this phase already completed."
        : undefined));
      phases.push(await this.executeHookPhase("dependencies", phasePlan.has("dependencies")
        ? this.dependencyInstallationHook
          ? () => this.dependencyInstallationHook!.installDependencies(context)
          : undefined
        : undefined, "dependency-install-not-implemented", !phasePlan.has("dependencies")
        ? "Skipped because persisted installer state indicates this phase already completed."
        : undefined));
      phases.push(await this.executeHookPhase("custom-nodes", phasePlan.has("custom-nodes")
        ? this.customNodeInstallationHook
          ? () => this.customNodeInstallationHook!.installCustomNodes(context)
          : undefined
        : undefined, "custom-node-install-not-implemented", !phasePlan.has("custom-nodes")
        ? "Skipped because persisted installer state indicates this phase already completed."
        : undefined));
      phases.push(await this.executeHookPhase("model-validation", phasePlan.has("model-validation")
        ? this.modelValidationHook
          ? () => this.modelValidationHook!.validateModels(context)
          : undefined
        : undefined, "model-validation-not-implemented", !phasePlan.has("model-validation")
        ? "Skipped because persisted installer state indicates this phase already completed."
        : undefined));
      phases.push(await this.executeHookPhase("runtime-validation", phasePlan.has("runtime-validation")
        ? this.runtimeValidationHook
          ? () => this.runtimeValidationHook!.validateRuntime(context)
          : undefined
        : undefined, "runtime-validation-not-implemented", !phasePlan.has("runtime-validation")
        ? "Skipped because persisted installer state indicates this phase already completed."
        : undefined));
    } else {
      phases.push(this.createSkippedPhase("environment", "Skipped because repository phase failed."));
      phases.push(this.createSkippedPhase("dependencies", "Skipped because repository phase failed."));
      phases.push(this.createSkippedPhase("custom-nodes", "Skipped because repository phase failed."));
      phases.push(this.createSkippedPhase("model-validation", "Skipped because repository phase failed."));
      phases.push(this.createSkippedPhase("runtime-validation", "Skipped because repository phase failed."));
    }

    for (const phase of phases) {
      if (phase.phase === "repository") {
        continue;
      }
      for (const phaseIssue of phase.issues) {
        issues.push(phaseIssue);
      }
    }

    const hasError = issues.some((entry) => entry.severity === "error");
    const hasNotImplemented = phases.some((entry) => entry.status === ComfyRuntimeOrchestrationPhaseStatuses.notImplemented);
    const state: ComfyRuntimeOrchestrationState = hasError
      ? ComfyRuntimeOrchestrationStates.failed
      : hasNotImplemented
        ? ComfyRuntimeOrchestrationStates.partial
        : ComfyRuntimeOrchestrationStates.ready;

    const latestLifecycle = phases
      .find((entry) => entry.phase === "runtime-validation")
      ?.metadata?.runtimeLifecycle as ComfyRuntimeLifecycleResult | undefined;

    if (this.stateStore) {
      const persistedState = createComfyRuntimeInstallerPersistedState({
        runtimeDependencyId: installerRequests.runtimeAsset.runtimeDependencyId,
        runtimeAssetId: installerRequests.runtimeAsset.assetId,
        runtimeAssetVersionId: installerRequests.runtimeAsset.versionId,
        installLocationKey: statusAfter.installLocation.installLocationKey,
        installDirectory,
        runtimeWorkingDirectory: path.resolve(runtimeWorkingDirectory),
        runtimeEndpoint,
        repositoryState: statusAfter.state,
        repositoryRevision: statusAfter.installed?.resolvedRevision,
        orchestrationState: state,
        phases,
        lastLifecycle: latestLifecycle,
        issues,
        diagnostics: {
          statePath: path.join(installDirectory, ".ai-loom-comfy-installer-state.json"),
        },
        startedAt,
        updatedAt: this.now().toISOString(),
        completedAt: this.now().toISOString(),
      });
      await this.stateStore.save(persistedState);
    }

    const baseResult = Object.freeze({
      state,
      runtimeAsset: installerRequests.runtimeAsset,
      resolvedTargets: Object.freeze({
        targetRootDirectory: installerRequests.installRequest.targetRootDirectory,
        installDirectory,
        runtimeWorkingDirectory: path.resolve(runtimeWorkingDirectory),
        runtimeEndpoint,
        installLocationKey: statusAfter.installLocation.installLocationKey,
        workflowProfile,
      }),
      repository: Object.freeze({
        operation: repositoryOperation,
        statusBefore,
        statusAfter,
        installResult,
        updateResult,
        validation,
        diagnostics,
      }),
      phases: Object.freeze(phases),
      issues: Object.freeze(issues),
      persistedState: persistedStateInfo,
    });

    return Object.freeze({
      ...baseResult,
      systemDiagnostics: createComfyRuntimeSystemDiagnosticsFromOrchestration(baseResult),
    });
  }

  private createRepositoryPhase(input: {
    readonly operation: ComfyRuntimeInstallerOrchestrationResult["repository"]["operation"];
    readonly beforeState: RuntimeRepositoryStatusResult["state"];
    readonly afterState: RuntimeRepositoryStatusResult["state"];
    readonly validationValid: boolean;
    readonly issues: ReadonlyArray<ComfyRuntimeOrchestrationIssue>;
  }): ComfyRuntimeOrchestrationPhaseResult {
    const startedAt = this.now().toISOString();
    const finishedAt = this.now().toISOString();
    const hasRepositoryError = input.issues.some((entry) => entry.phase === "repository" && entry.severity === "error");
    return Object.freeze({
      phase: "repository",
      status: hasRepositoryError
        ? ComfyRuntimeOrchestrationPhaseStatuses.failed
        : ComfyRuntimeOrchestrationPhaseStatuses.completed,
      message: `Repository phase ${input.operation}; ${input.beforeState} -> ${input.afterState}; validation=${input.validationValid ? "valid" : "invalid"}.`,
      startedAt,
      finishedAt,
      issues: Object.freeze(input.issues.filter((entry) => entry.phase === "repository")),
      metadata: Object.freeze({
        beforeState: input.beforeState,
        afterState: input.afterState,
        operation: input.operation,
        validationValid: input.validationValid,
      }),
    });
  }

  private async executeHookPhase(
    phase: ComfyRuntimeOrchestrationPhaseResult["phase"],
    runHook: (() => Promise<ComfyRuntimeOrchestrationPhaseHookResult>) | undefined,
    missingImplementationCode: string,
    skippedMessage?: string,
  ): Promise<ComfyRuntimeOrchestrationPhaseResult> {
    const startedAt = this.now().toISOString();
    if (!runHook) {
      if (skippedMessage) {
        return Object.freeze({
          phase,
          status: ComfyRuntimeOrchestrationPhaseStatuses.skipped,
          message: skippedMessage,
          startedAt,
          finishedAt: this.now().toISOString(),
          issues: Object.freeze([]),
        });
      }
      return Object.freeze({
        phase,
        status: ComfyRuntimeOrchestrationPhaseStatuses.notImplemented,
        message: `${phase} phase is not implemented in this slice.`,
        startedAt,
        finishedAt: this.now().toISOString(),
        issues: Object.freeze([
          issue(missingImplementationCode, "warning", `${phase} phase is not implemented yet.`, phase),
        ]),
      });
    }

    try {
      const result = await runHook();
      return Object.freeze({
        phase,
        status: result.status,
        message: result.message,
        startedAt,
        finishedAt: this.now().toISOString(),
        issues: Object.freeze([...(result.issues ?? [])]),
        metadata: result.metadata ? Object.freeze({ ...result.metadata }) : undefined,
      });
    } catch (error) {
      return Object.freeze({
        phase,
        status: ComfyRuntimeOrchestrationPhaseStatuses.failed,
        message: `${phase} phase failed.`,
        startedAt,
        finishedAt: this.now().toISOString(),
        issues: Object.freeze([
          issue(
            `${phase}-phase-failed`,
            "error",
            error instanceof Error ? error.message : `${phase} phase failed.`,
            phase,
          ),
        ]),
      });
    }
  }

  private createSkippedPhase(
    phase: ComfyRuntimeOrchestrationPhaseResult["phase"],
    message: string,
  ): ComfyRuntimeOrchestrationPhaseResult {
    const startedAt = this.now().toISOString();
    return Object.freeze({
      phase,
      status: ComfyRuntimeOrchestrationPhaseStatuses.skipped,
      message,
      startedAt,
      finishedAt: this.now().toISOString(),
      issues: Object.freeze([]),
    });
  }
}

function issue(
  code: string,
  severity: "error" | "warning",
  message: string,
  phase: ComfyRuntimeOrchestrationIssue["phase"],
  metadata?: Readonly<Record<string, unknown>>,
): ComfyRuntimeOrchestrationIssue {
  return Object.freeze({
    code,
    severity,
    message,
    phase,
    metadata,
  });
}

export function resolveComfyRuntimeInstallerOrchestrationInput(
  request: ComfyRuntimeInstallerOrchestrationRequest,
): ResolveComfyRuntimeInstallerRequestInput {
  return Object.freeze({
    runtimeAsset: request.runtimeAsset,
    targetRootDirectory: request.targetRootDirectory,
    installLocationKey: request.installLocationKey,
    requestedRevision: request.requestedRevision,
    expectedRevision: request.expectedRevision,
    includeRepositoryDiagnostics: request.includeRepositoryDiagnostics,
  });
}
