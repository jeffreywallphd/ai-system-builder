import path from "node:path";
import {
  RuntimeRepositoryInstallationStates,
  type IRuntimeRepositoryInstallerContract,
  type RuntimeRepositoryDiagnosticsResult,
  type RuntimeRepositoryStatusResult,
  type RuntimeRepositoryValidationResult,
} from "../../application/runtime/RuntimeRepositoryInstallerContract";
import {
  resolveComfyRuntimeCustomNodeInstallRequests,
  resolveComfyRuntimeCustomNodeRequirementsForProfile,
} from "../../application/runtime/ComfyRuntimeRequirements";
import type {
  IComfyRuntimeCustomNodeInstallationHook,
  ComfyRuntimeOrchestrationContext,
  ComfyRuntimeOrchestrationIssue,
  ComfyRuntimeOrchestrationPhaseHookResult,
} from "../../application/runtime/ComfyRuntimeInstallerOrchestrationService";

export interface ComfyRuntimeCustomNodeInstallationHooksOptions {
  readonly now?: () => Date;
  readonly includeRepositoryDiagnostics?: boolean;
}

interface CustomNodeInstallEntry {
  readonly requirementId: string;
  readonly displayName: string;
  readonly applicability: string;
  readonly status: "installed" | "updated" | "already-current" | "already-installed" | "failed";
  readonly installDirectory: string;
  readonly installLocationKey: string;
  readonly resolvedRevision?: string;
  readonly recoveredFromPartial?: boolean;
  readonly diagnostics?: RuntimeRepositoryDiagnosticsResult;
  readonly validation?: RuntimeRepositoryValidationResult;
  readonly beforeState: RuntimeRepositoryStatusResult["state"];
  readonly afterState: RuntimeRepositoryStatusResult["state"];
}

export class ComfyRuntimeCustomNodeInstallationHooks implements IComfyRuntimeCustomNodeInstallationHook {
  private readonly now: () => Date;
  private readonly includeRepositoryDiagnostics: boolean;

  public constructor(
    private readonly repositoryInstaller: IRuntimeRepositoryInstallerContract,
    options: ComfyRuntimeCustomNodeInstallationHooksOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.includeRepositoryDiagnostics = options.includeRepositoryDiagnostics ?? true;
  }

  public async installCustomNodes(
    context: ComfyRuntimeOrchestrationContext,
  ): Promise<ComfyRuntimeOrchestrationPhaseHookResult> {
    const selectedRequirements = resolveComfyRuntimeCustomNodeRequirementsForProfile({
      requirements: context.runtimeAsset.customNodeRequirements,
      workflowProfile: context.workflowProfile,
    });
    if (selectedRequirements.length < 1) {
      return Object.freeze({
        status: "skipped",
        message: "No custom node requirements for selected workflow profile.",
        issues: Object.freeze([]),
        metadata: Object.freeze({
          customNodeInstall: Object.freeze({
            workflowProfile: context.workflowProfile,
            total: 0,
            entries: Object.freeze([]),
            generatedAt: this.now().toISOString(),
          }),
        }),
      });
    }

    const customNodesRoot = path.resolve(context.installDirectory, "custom_nodes");
    const entries: CustomNodeInstallEntry[] = [];
    const issues: ComfyRuntimeOrchestrationIssue[] = [];

    for (const requirement of selectedRequirements) {
      const requests = resolveComfyRuntimeCustomNodeInstallRequests({
        requirement,
        targetRootDirectory: customNodesRoot,
        includeDiagnostics: this.includeRepositoryDiagnostics,
      });
      const statusBefore = await this.repositoryInstaller.inspectStatus(requests.statusRequest);
      let statusAfter = statusBefore;
      let operation: CustomNodeInstallEntry["status"] = "failed";
      let recoveredFromPartial = false;

      if (
        statusBefore.state === RuntimeRepositoryInstallationStates.notInstalled
        || statusBefore.state === RuntimeRepositoryInstallationStates.partiallyInstalled
        || statusBefore.state === RuntimeRepositoryInstallationStates.invalid
      ) {
        const installResult = await this.repositoryInstaller.install(requests.installRequest);
        operation = installResult.operation;
        recoveredFromPartial = installResult.recoveredFromPartial;
        statusAfter = await this.repositoryInstaller.inspectStatus(requests.statusRequest);
        if (!installResult.success) {
          issues.push(createIssue({
            code: "custom-node-install-failed",
            severity: "error",
            message: `Custom node '${requirement.displayName}' install failed.`,
            metadata: {
              requirementId: requirement.requirementId,
              operation: installResult.operation,
              error: installResult.error,
            },
          }));
        }
      } else {
        const updateResult = await this.repositoryInstaller.update(requests.updateRequest);
        operation = updateResult.operation;
        statusAfter = await this.repositoryInstaller.inspectStatus(requests.statusRequest);
        if (!updateResult.success) {
          issues.push(createIssue({
            code: "custom-node-update-failed",
            severity: "error",
            message: `Custom node '${requirement.displayName}' update failed.`,
            metadata: {
              requirementId: requirement.requirementId,
              operation: updateResult.operation,
              error: updateResult.error,
            },
          }));
        }
      }

      const validation = await this.repositoryInstaller.validate(requests.validationRequest);
      if (!validation.valid) {
        issues.push(createIssue({
          code: "custom-node-validation-failed",
          severity: "error",
          message: `Custom node '${requirement.displayName}' validation failed.`,
          metadata: {
            requirementId: requirement.requirementId,
            validationIssues: validation.issues,
          },
        }));
      }

      const diagnostics = await this.repositoryInstaller.collectDiagnostics(requests.diagnosticsRequest);

      entries.push(Object.freeze({
        requirementId: requirement.requirementId,
        displayName: requirement.displayName,
        applicability: requirement.applicability,
        status: operation,
        installDirectory: statusAfter.installLocation.installDirectory,
        installLocationKey: statusAfter.installLocation.installLocationKey,
        resolvedRevision: statusAfter.installed?.resolvedRevision,
        recoveredFromPartial,
        beforeState: statusBefore.state,
        afterState: statusAfter.state,
        diagnostics: this.includeRepositoryDiagnostics ? diagnostics : undefined,
        validation,
      }));
    }

    const phaseStatus = issues.some((entry) => entry.severity === "error") ? "failed" : "completed";
    const installedCount = entries.filter((entry) => entry.status === "installed").length;
    const updatedCount = entries.filter((entry) => entry.status === "updated").length;
    return Object.freeze({
      status: phaseStatus,
      message: `Custom nodes resolved for '${context.workflowProfile}' profile (installed=${installedCount}, updated=${updatedCount}, total=${entries.length}).`,
      issues: Object.freeze(issues),
      metadata: Object.freeze({
        customNodeInstall: Object.freeze({
          workflowProfile: context.workflowProfile,
          rootDirectory: customNodesRoot,
          total: entries.length,
          installedCount,
          updatedCount,
          entries: Object.freeze(entries),
          generatedAt: this.now().toISOString(),
        }),
      }),
    });
  }
}

function createIssue(input: {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): ComfyRuntimeOrchestrationIssue {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    phase: "custom-nodes",
    metadata: input.metadata,
  });
}

