import {
  ImageManipulationExecutionBackendHealthStates,
  type IImageManipulationExecutionCapabilityPort,
  type ImageManipulationExecutionBackendCapabilities,
} from "./ports";
import {
  ImageRunExecutionNodeSelectionOutcomes,
  type IImageRunExecutionNodeSelectionServicePort,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";
import { ExecutionNodeTargetKinds } from "@domain/nodes/ExecutionNodeDomain";

export const ImageManipulationExecutionReadinessStates = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  unavailable: "unavailable",
});

export type ImageManipulationExecutionReadinessState =
  typeof ImageManipulationExecutionReadinessStates[keyof typeof ImageManipulationExecutionReadinessStates];

export interface ImageManipulationExecutionReadinessIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export const ImageManipulationExecutionNodeAvailabilityStates = Object.freeze({
  available: "available",
  constrained: "constrained",
  unavailable: "unavailable",
  unknown: "unknown",
});

export type ImageManipulationExecutionNodeAvailabilityState =
  typeof ImageManipulationExecutionNodeAvailabilityStates[keyof typeof ImageManipulationExecutionNodeAvailabilityStates];

export interface ImageManipulationExecutionNodeAvailabilitySummary {
  readonly state: ImageManipulationExecutionNodeAvailabilityState;
  readonly checkedAt: string;
  readonly candidateNodeCount: number;
  readonly eligibleNodeCount: number;
  readonly unavailableNodeCount: number;
  readonly incompatibleNodeCount: number;
  readonly selectedNodeId?: string;
  readonly topBlockingReasonCodes: ReadonlyArray<string>;
  readonly topTransientAvailabilityReasonCodes: ReadonlyArray<string>;
  readonly reasonCode?: string;
}

export interface ImageManipulationExecutionReadinessSummary {
  readonly backendFamily: string;
  readonly checkedAt: string;
  readonly readiness: ImageManipulationExecutionReadinessState;
  readonly readyForExecution: boolean;
  readonly message?: string;
  readonly capabilities: ImageManipulationExecutionBackendCapabilities;
  readonly nodeAvailability: ImageManipulationExecutionNodeAvailabilitySummary;
  readonly issues: ReadonlyArray<ImageManipulationExecutionReadinessIssue>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface GetImageManipulationExecutionReadinessRequest {
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface GetImageManipulationExecutionReadinessUseCaseDependencies {
  readonly capabilityPort?: IImageManipulationExecutionCapabilityPort;
  readonly nodeSelectionService?: Pick<IImageRunExecutionNodeSelectionServicePort, "selectExecutionNodeForRun">;
  readonly now?: () => Date;
}

const DefaultBackendFamily = "adapter.image-manipulation.execution";
const AdapterUnavailableMessage = "Image manipulation execution backend is not configured.";

export class GetImageManipulationExecutionReadinessUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: GetImageManipulationExecutionReadinessUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(
    input: GetImageManipulationExecutionReadinessRequest,
  ): Promise<ImageManipulationExecutionReadinessSummary> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      return this.buildUnavailable(
        "workspace-id-required",
        "workspaceId is required.",
      );
    }

    if (!this.dependencies.capabilityPort) {
      return this.buildUnavailable(
        "execution-adapter-not-configured",
        AdapterUnavailableMessage,
      );
    }

    const status = await this.dependencies.capabilityPort.getExecutionBackendStatus({
      workspaceId,
      systemId: normalizeOptionalString(input.systemId),
      operationKind: normalizeOptionalString(input.operationKind),
      translationContractVersion: normalizeOptionalString(input.translationContractVersion),
    });

    const issues: ImageManipulationExecutionReadinessIssue[] = [];
    if (status.health === ImageManipulationExecutionBackendHealthStates.unavailable) {
      issues.push(Object.freeze({
        code: "backend-unavailable",
        severity: "error",
        message: status.message || "Execution backend is unavailable.",
      }));
    } else if (status.health === ImageManipulationExecutionBackendHealthStates.degraded) {
      issues.push(Object.freeze({
        code: "backend-degraded",
        severity: "warning",
        message: status.message || "Execution backend is degraded.",
      }));
    }

    const operationKind = normalizeOptionalString(input.operationKind);
    if (operationKind && !status.capabilities.supportedOperationKinds.includes(operationKind)) {
      issues.push(Object.freeze({
        code: "operation-kind-unsupported",
        severity: "error",
        message: `Operation kind '${operationKind}' is not supported by backend '${status.backendFamily}'.`,
      }));
    }

    const translationContractVersion = normalizeOptionalString(input.translationContractVersion);
    if (
      translationContractVersion
      && !status.capabilities.supportedTranslationContractVersions.includes(translationContractVersion)
    ) {
      issues.push(Object.freeze({
        code: "translation-contract-version-unsupported",
        severity: "error",
        message:
          `Translation contract version '${translationContractVersion}' is not supported by backend '${status.backendFamily}'.`,
      }));
    }

    const hasBackendBlockingIssues = issues.some((issue) => issue.severity === "error");
    const nodeAvailability = hasBackendBlockingIssues
      ? this.buildNodeAvailability({
        state: ImageManipulationExecutionNodeAvailabilityStates.unknown,
        checkedAt: status.checkedAt,
        reasonCode: "node-availability-evaluation-skipped-backend-blocking",
      })
      : await this.evaluateNodeAvailability({
        workspaceId,
        systemId: normalizeOptionalString(input.systemId),
        workflowId: normalizeOptionalString(input.workflowId),
        operationKind,
        translationContractVersion,
        checkedAt: status.checkedAt,
        backendFamily: status.backendFamily,
      });
    issues.push(...nodeAvailability.issues);

    const hasBlockingIssues = issues.some((issue) => issue.severity === "error");
    const readiness = status.health === ImageManipulationExecutionBackendHealthStates.unavailable
      ? ImageManipulationExecutionReadinessStates.unavailable
      : hasBlockingIssues || issues.length > 0
      ? ImageManipulationExecutionReadinessStates.degraded
      : ImageManipulationExecutionReadinessStates.ready;

    return Object.freeze({
      backendFamily: status.backendFamily,
      checkedAt: status.checkedAt,
      readiness,
      readyForExecution: readiness !== ImageManipulationExecutionReadinessStates.unavailable && !hasBlockingIssues,
      message: status.message,
      capabilities: status.capabilities,
      nodeAvailability: nodeAvailability.summary,
      issues: Object.freeze(issues),
      diagnostics: status.diagnostics,
    });
  }

  private buildUnavailable(
    code: string,
    message: string,
  ): ImageManipulationExecutionReadinessSummary {
    return Object.freeze({
      backendFamily: DefaultBackendFamily,
      checkedAt: this.now().toISOString(),
      readiness: ImageManipulationExecutionReadinessStates.unavailable,
      readyForExecution: false,
      message,
      capabilities: Object.freeze({
        backendFamily: DefaultBackendFamily,
        supportsProgressPolling: false,
        supportsProgressStreaming: false,
        supportsCancellation: false,
        supportsOutputDiscovery: false,
        supportedOperationKinds: Object.freeze([]),
        supportedTranslationContractVersions: Object.freeze([]),
      }),
      nodeAvailability: this.buildNodeAvailability({
        state: ImageManipulationExecutionNodeAvailabilityStates.unknown,
        checkedAt: this.now().toISOString(),
        reasonCode: code,
      }).summary,
      issues: Object.freeze([Object.freeze({
        code,
        severity: "error" as const,
        message,
      })]),
      diagnostics: undefined,
    });
  }

  private async evaluateNodeAvailability(input: {
    readonly workspaceId: string;
    readonly systemId?: string;
    readonly workflowId?: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
    readonly checkedAt: string;
    readonly backendFamily: string;
  }): Promise<{
    readonly summary: ImageManipulationExecutionNodeAvailabilitySummary;
    readonly issues: ReadonlyArray<ImageManipulationExecutionReadinessIssue>;
  }> {
    if (!this.dependencies.nodeSelectionService) {
      return Object.freeze({
        summary: this.buildNodeAvailability({
          state: ImageManipulationExecutionNodeAvailabilityStates.unknown,
          checkedAt: input.checkedAt,
          reasonCode: "node-selection-not-configured",
        }).summary,
        issues: Object.freeze([Object.freeze({
          code: "node-selection-not-configured",
          severity: "error" as const,
          message: "Execution-node selection service is not configured.",
        })]),
      });
    }

    const decision = await this.dependencies.nodeSelectionService.selectExecutionNodeForRun({
      asOf: input.checkedAt,
      run: Object.freeze({
        runId: `readiness:${input.workspaceId}:${input.checkedAt}`,
        workspaceId: input.workspaceId,
        systemId: input.systemId,
        workflowId: input.workflowId,
        operationKind: input.operationKind,
        translationContractVersion: input.translationContractVersion,
      }),
      requirements: Object.freeze({
        requiredBackendFamilies: Object.freeze([input.backendFamily]),
        requiredExecutionTarget: ExecutionNodeTargetKinds.imageManipulation,
        requiredOperationKind: input.operationKind,
        requiredTranslationContractVersion: input.translationContractVersion,
      }),
    });

    const candidateNodeCount = decision.candidates.length;
    const eligibleNodeCount = decision.candidates.filter((candidate) => candidate.eligible).length;
    const unavailableNodeCount = decision.candidates.filter((candidate) => candidate.decision === "unavailable").length;
    const incompatibleNodeCount = decision.candidates.filter((candidate) => candidate.decision === "incompatible").length;
    const topBlockingReasonCodes = this.resolveTopReasonCodes(
      decision.candidates.flatMap((candidate) => candidate.blockingReasonCodes),
    );
    const topTransientAvailabilityReasonCodes = this.resolveTopReasonCodes(
      decision.candidates.flatMap((candidate) => candidate.transientAvailabilityReasonCodes),
    );

    if (decision.outcome === ImageRunExecutionNodeSelectionOutcomes.selected) {
      return Object.freeze({
        summary: this.buildNodeAvailability({
          state: ImageManipulationExecutionNodeAvailabilityStates.available,
          checkedAt: input.checkedAt,
          candidateNodeCount,
          eligibleNodeCount,
          unavailableNodeCount,
          incompatibleNodeCount,
          selectedNodeId: decision.selectedNodeId,
          topBlockingReasonCodes,
          topTransientAvailabilityReasonCodes,
        }).summary,
        issues: Object.freeze([]),
      });
    }

    if (decision.outcome === ImageRunExecutionNodeSelectionOutcomes.noCandidateNodes) {
      return Object.freeze({
        summary: this.buildNodeAvailability({
          state: ImageManipulationExecutionNodeAvailabilityStates.unavailable,
          checkedAt: input.checkedAt,
          candidateNodeCount,
          eligibleNodeCount,
          unavailableNodeCount,
          incompatibleNodeCount,
          topBlockingReasonCodes,
          topTransientAvailabilityReasonCodes,
          reasonCode: "execution-node-candidates-unavailable",
        }).summary,
        issues: Object.freeze([Object.freeze({
          code: "execution-node-candidates-unavailable",
          severity: "error" as const,
          message: "No execution-node candidates are available for this image run request.",
        })]),
      });
    }

    return Object.freeze({
      summary: this.buildNodeAvailability({
        state: ImageManipulationExecutionNodeAvailabilityStates.constrained,
        checkedAt: input.checkedAt,
        candidateNodeCount,
        eligibleNodeCount,
        unavailableNodeCount,
        incompatibleNodeCount,
        topBlockingReasonCodes,
        topTransientAvailabilityReasonCodes,
        reasonCode: "execution-node-no-eligible-match",
      }).summary,
      issues: Object.freeze([Object.freeze({
        code: "execution-node-no-eligible-match",
        severity: "error" as const,
        message: "Workflow and backend are valid, but no eligible execution node is currently routable.",
      })]),
    });
  }

  private buildNodeAvailability(input: {
    readonly state: ImageManipulationExecutionNodeAvailabilityState;
    readonly checkedAt: string;
    readonly candidateNodeCount?: number;
    readonly eligibleNodeCount?: number;
    readonly unavailableNodeCount?: number;
    readonly incompatibleNodeCount?: number;
    readonly selectedNodeId?: string;
    readonly topBlockingReasonCodes?: ReadonlyArray<string>;
    readonly topTransientAvailabilityReasonCodes?: ReadonlyArray<string>;
    readonly reasonCode?: string;
  }): {
    readonly summary: ImageManipulationExecutionNodeAvailabilitySummary;
  } {
    return Object.freeze({
      summary: Object.freeze({
        state: input.state,
        checkedAt: input.checkedAt,
        candidateNodeCount: input.candidateNodeCount ?? 0,
        eligibleNodeCount: input.eligibleNodeCount ?? 0,
        unavailableNodeCount: input.unavailableNodeCount ?? 0,
        incompatibleNodeCount: input.incompatibleNodeCount ?? 0,
        selectedNodeId: input.selectedNodeId,
        topBlockingReasonCodes: Object.freeze([...(input.topBlockingReasonCodes ?? [])]),
        topTransientAvailabilityReasonCodes: Object.freeze([...(input.topTransientAvailabilityReasonCodes ?? [])]),
        reasonCode: input.reasonCode,
      }),
    });
  }

  private resolveTopReasonCodes(reasonCodes: ReadonlyArray<string>): ReadonlyArray<string> {
    const counts = new Map<string, number>();
    for (const code of reasonCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return Object.freeze(
      [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([code]) => code),
    );
  }
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
