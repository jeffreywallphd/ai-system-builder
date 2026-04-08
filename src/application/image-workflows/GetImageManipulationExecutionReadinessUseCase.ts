import {
  ImageManipulationExecutionBackendHealthStates,
  type IImageManipulationExecutionCapabilityPort,
  type ImageManipulationExecutionBackendCapabilities,
} from "./ports";

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

export interface ImageManipulationExecutionReadinessSummary {
  readonly backendFamily: string;
  readonly checkedAt: string;
  readonly readiness: ImageManipulationExecutionReadinessState;
  readonly readyForExecution: boolean;
  readonly message?: string;
  readonly capabilities: ImageManipulationExecutionBackendCapabilities;
  readonly issues: ReadonlyArray<ImageManipulationExecutionReadinessIssue>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface GetImageManipulationExecutionReadinessRequest {
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface GetImageManipulationExecutionReadinessUseCaseDependencies {
  readonly capabilityPort?: IImageManipulationExecutionCapabilityPort;
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
      issues: Object.freeze([Object.freeze({
        code,
        severity: "error" as const,
        message,
      })]),
      diagnostics: undefined,
    });
  }
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
