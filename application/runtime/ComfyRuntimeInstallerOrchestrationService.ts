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
}

export interface ComfyRuntimeInstallerOrchestrationServiceOptions {
  readonly environmentPreparationHook?: IComfyRuntimeEnvironmentPreparationHook;
  readonly dependencyInstallationHook?: IComfyRuntimeDependencyInstallationHook;
  readonly customNodeInstallationHook?: IComfyRuntimeCustomNodeInstallationHook;
  readonly modelValidationHook?: IComfyRuntimeModelValidationHook;
  readonly runtimeValidationHook?: IComfyRuntimeStartStopValidationHook;
  readonly now?: () => Date;
}

export class ComfyRuntimeInstallerOrchestrationService {
  private readonly environmentPreparationHook?: IComfyRuntimeEnvironmentPreparationHook;
  private readonly dependencyInstallationHook?: IComfyRuntimeDependencyInstallationHook;
  private readonly customNodeInstallationHook?: IComfyRuntimeCustomNodeInstallationHook;
  private readonly modelValidationHook?: IComfyRuntimeModelValidationHook;
  private readonly runtimeValidationHook?: IComfyRuntimeStartStopValidationHook;
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
    const runtimeEndpoint = `http://${installerRequests.runtimeAsset.runtimeStart.defaultHost}:${installerRequests.runtimeAsset.runtimeStart.defaultPort}`;
    const workflowProfile = resolveComfyRuntimeWorkflowProfile(
      request.workflowProfile ?? ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
    );

    const context: ComfyRuntimeOrchestrationContext = Object.freeze({
      runtimeAsset: installerRequests.runtimeAsset,
      installDirectory,
      runtimeWorkingDirectory,
      runtimeEndpoint,
      workflowProfile,
    });

    phases.push(this.createRepositoryPhase({
      operation: repositoryOperation,
      beforeState: statusBefore.state,
      afterState: statusAfter.state,
      validationValid: validation.valid,
      issues,
    }));

    const repositoryHealthy = !issues.some((entry) => entry.phase === "repository" && entry.severity === "error");
    if (repositoryHealthy) {
      phases.push(await this.executeHookPhase("environment", this.environmentPreparationHook
        ? () => this.environmentPreparationHook!.prepare(context)
        : undefined, "environment-preparation-not-implemented"));
      phases.push(await this.executeHookPhase("dependencies", this.dependencyInstallationHook
        ? () => this.dependencyInstallationHook!.installDependencies(context)
        : undefined, "dependency-install-not-implemented"));
      phases.push(await this.executeHookPhase("custom-nodes", this.customNodeInstallationHook
        ? () => this.customNodeInstallationHook!.installCustomNodes(context)
        : undefined, "custom-node-install-not-implemented"));
      phases.push(await this.executeHookPhase("model-validation", this.modelValidationHook
        ? () => this.modelValidationHook!.validateModels(context)
        : undefined, "model-validation-not-implemented"));
      phases.push(await this.executeHookPhase("runtime-validation", this.runtimeValidationHook
        ? () => this.runtimeValidationHook!.validateRuntime(context)
        : undefined, "runtime-validation-not-implemented"));
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

    return Object.freeze({
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
  ): Promise<ComfyRuntimeOrchestrationPhaseResult> {
    const startedAt = this.now().toISOString();
    if (!runHook) {
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
