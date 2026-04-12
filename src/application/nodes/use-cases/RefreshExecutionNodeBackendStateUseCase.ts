import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  isExecutionNodeActivationTransitionAllowed,
  type ExecutionNodeBackendFamilyCapability,
  type ExecutionNodeBackendReadinessState,
  type ExecutionNodeHealthStatus,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import { ImageManipulationExecutionBackendHealthStates, type IImageManipulationExecutionCapabilityPort } from "@application/image-workflows/ports";
import type {
  ExecutionNodeCapabilityRefreshResult,
  ExecutionNodeHealthRefreshResult,
  ExecutionNodeMutationResult,
  IExecutionNodeRepository,
} from "../ports/ExecutionNodeManagementPorts";
import {
  ExecutionNodeManagementAuditEventTypes,
  type ExecutionNodeManagementAuditSink,
  publishExecutionNodeManagementAuditEventBestEffort,
} from "../ports/ExecutionNodeManagementAuditPorts";
import {
  DefaultExecutionNodeManagementUseCaseIdGenerator,
  ExecutionNodeManagementUseCaseErrorCodes,
  type ExecutionNodeManagementUseCaseClock,
  type ExecutionNodeManagementUseCaseIdGenerator,
  type ExecutionNodeManagementUseCaseOutcome,
  createExecutionNodeMutationContext,
  normalizeOptional,
  normalizeRequired,
  toExecutionNodeInternalSummary,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

export const ExecutionNodeBackendRefreshClassifications = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
  incompatible: "incompatible",
  stale: "stale",
  unknown: "unknown",
});

export type ExecutionNodeBackendRefreshClassification =
  typeof ExecutionNodeBackendRefreshClassifications[keyof typeof ExecutionNodeBackendRefreshClassifications];

export interface RefreshExecutionNodeBackendStateUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
  readonly maxStatusAgeMs?: number;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface RefreshExecutionNodeBackendStateUseCaseResponse {
  readonly node: ReturnType<typeof toExecutionNodeInternalSummary>;
  readonly classification: ExecutionNodeBackendRefreshClassification;
  readonly checkedAt: string;
  readonly healthRefresh: ExecutionNodeHealthRefreshResult;
  readonly capabilityRefresh: ExecutionNodeCapabilityRefreshResult;
}

interface RefreshExecutionNodeBackendStateUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly capabilityProbePort: IImageManipulationExecutionCapabilityPort;
  readonly auditSink?: ExecutionNodeManagementAuditSink;
  readonly idGenerator?: ExecutionNodeManagementUseCaseIdGenerator;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

interface NormalizedBackendObservation {
  readonly classification: ExecutionNodeBackendRefreshClassification;
  readonly checkedAt: string;
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly backendReadiness: ExecutionNodeBackendReadinessState;
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
}

const HealthRefreshUnknownReasonCode = "refresh-observation-unknown";
const HealthRefreshStaleReasonCode = "refresh-observation-stale";
const HealthRefreshUnavailableReasonCode = "refresh-observation-unavailable";
const HealthRefreshIncompatibleReasonCode = "refresh-observation-incompatible";
const HealthRefreshDegradedReasonCode = "refresh-observation-degraded";
const HealthRefreshHealthyReasonCode = "refresh-observation-healthy";

export class RefreshExecutionNodeBackendStateUseCase {
  private readonly idGenerator: ExecutionNodeManagementUseCaseIdGenerator;
  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: RefreshExecutionNodeBackendStateUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultExecutionNodeManagementUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RefreshExecutionNodeBackendStateUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<RefreshExecutionNodeBackendStateUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "nodeId is required.",
      );
    }

    const workspaceId = normalizeRequired(request.workspaceId);
    if (!workspaceId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "workspaceId is required.",
      );
    }

    if (request.maxStatusAgeMs !== undefined && (!Number.isInteger(request.maxStatusAgeMs) || request.maxStatusAgeMs <= 0)) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "maxStatusAgeMs must be a positive integer when provided.",
      );
    }

    const existing = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (!existing) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.notFound,
        `Execution node '${nodeId}' was not found.`,
      );
    }

    const observedStatus = await this.dependencies.capabilityProbePort.getExecutionBackendStatus({
      workspaceId,
      systemId: normalizeOptional(request.systemId),
      operationKind: normalizeOptional(request.operationKind),
      translationContractVersion: normalizeOptional(request.translationContractVersion),
    });

    const normalizedObservation = this.normalizeBackendObservation(
      observedStatus,
      request.maxStatusAgeMs,
    );
    const refreshedCapabilities = this.mergeBackendCapabilities(
      existing,
      observedStatus,
      normalizedObservation,
    );
    const observedAt = normalizedObservation.checkedAt;

    const capabilityMutation = await this.dependencies.nodeRepository.updateExecutionNodeCapabilities({
      nodeId,
      backendFamilyCapabilities: refreshedCapabilities,
      refreshedAt: observedAt,
      mutation: createExecutionNodeMutationContext({
        actorUserIdentityId,
        operationPrefix: "refresh-execution-node-capabilities",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
      }),
    });

    const healthMutation = await this.persistHealthRefresh({
      node: capabilityMutation.record,
      observedAt,
      healthStatus: normalizedObservation.healthStatus,
      actorUserIdentityId,
      reason: request.reason,
      correlationId: request.correlationId,
      details: Object.freeze({
        reasonCode: normalizedObservation.details["reasonCode"],
        classification: normalizedObservation.classification,
      }),
    });

    const capabilityRefresh = this.toCapabilityRefreshResult({
      nodeId,
      mutation: capabilityMutation,
      refreshedCapabilities,
      normalizedObservation,
    });
    const healthRefresh = this.toHealthRefreshResult({
      nodeId,
      mutation: healthMutation,
      normalizedObservation,
    });

    await publishExecutionNodeManagementAuditEventBestEffort(this.dependencies.auditSink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeBackendStateRefreshed,
      actorUserIdentityId,
      occurredAt: normalizedObservation.checkedAt,
      nodeId,
      workspaceId,
      outcome: "success",
      details: Object.freeze({
        classification: normalizedObservation.classification,
        healthStatus: normalizedObservation.healthStatus,
        backendReadiness: normalizedObservation.backendReadiness,
        reasonCode: normalizedObservation.details["reasonCode"],
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: toExecutionNodeInternalSummary(healthMutation.record),
        classification: normalizedObservation.classification,
        checkedAt: normalizedObservation.checkedAt,
        capabilityRefresh,
        healthRefresh,
      }),
    };
  }

  private normalizeBackendObservation(
    status: Awaited<ReturnType<IImageManipulationExecutionCapabilityPort["getExecutionBackendStatus"]>>,
    maxStatusAgeMs?: number,
  ): NormalizedBackendObservation {
    const now = this.clock.now();
    const checkedAt = this.normalizeTimestamp(status.checkedAt) ?? now.toISOString();
    const checkedAtMs = Date.parse(checkedAt);
    const ageMs = now.getTime() - checkedAtMs;

    if (maxStatusAgeMs !== undefined && ageMs > maxStatusAgeMs) {
      return Object.freeze({
        classification: ExecutionNodeBackendRefreshClassifications.stale,
        checkedAt,
        healthStatus: ExecutionNodeHealthStatuses.unknown,
        backendReadiness: ExecutionNodeBackendReadinessStates.unknown,
        summary: "Backend probe observation is stale for current execution-node refresh policy.",
        details: Object.freeze({
          reasonCode: HealthRefreshStaleReasonCode,
          ageMs,
          maxStatusAgeMs,
          backendHealth: status.health,
        }),
      });
    }

    const readinessState = this.resolveReadinessState(status);
    if (readinessState === "incompatible") {
      return Object.freeze({
        classification: ExecutionNodeBackendRefreshClassifications.incompatible,
        checkedAt,
        healthStatus: ExecutionNodeHealthStatuses.degraded,
        backendReadiness: ExecutionNodeBackendReadinessStates.unknown,
        summary: "Backend probe is reachable but incompatible with execution requirements.",
        details: Object.freeze({
          reasonCode: HealthRefreshIncompatibleReasonCode,
          backendHealth: status.health,
          readinessState,
        }),
      });
    }

    if (status.health === ImageManipulationExecutionBackendHealthStates.healthy) {
      return Object.freeze({
        classification: ExecutionNodeBackendRefreshClassifications.healthy,
        checkedAt,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendReadiness: ExecutionNodeBackendReadinessStates.ready,
        summary: status.message || "Backend probe reports healthy execution readiness.",
        details: Object.freeze({
          reasonCode: HealthRefreshHealthyReasonCode,
          backendHealth: status.health,
          readinessState,
        }),
      });
    }

    if (status.health === ImageManipulationExecutionBackendHealthStates.degraded) {
      return Object.freeze({
        classification: ExecutionNodeBackendRefreshClassifications.degraded,
        checkedAt,
        healthStatus: ExecutionNodeHealthStatuses.degraded,
        backendReadiness: ExecutionNodeBackendReadinessStates.degraded,
        summary: status.message || "Backend probe reports degraded execution readiness.",
        details: Object.freeze({
          reasonCode: HealthRefreshDegradedReasonCode,
          backendHealth: status.health,
          readinessState,
        }),
      });
    }

    if (status.health === ImageManipulationExecutionBackendHealthStates.unavailable) {
      return Object.freeze({
        classification: ExecutionNodeBackendRefreshClassifications.unavailable,
        checkedAt,
        healthStatus: ExecutionNodeHealthStatuses.unavailable,
        backendReadiness: ExecutionNodeBackendReadinessStates.unavailable,
        summary: status.message || "Backend probe reports execution backend unavailable.",
        details: Object.freeze({
          reasonCode: HealthRefreshUnavailableReasonCode,
          backendHealth: status.health,
          readinessState,
        }),
      });
    }

    return Object.freeze({
      classification: ExecutionNodeBackendRefreshClassifications.unknown,
      checkedAt,
      healthStatus: ExecutionNodeHealthStatuses.unknown,
      backendReadiness: ExecutionNodeBackendReadinessStates.unknown,
      summary: status.message || "Backend probe did not return a known readiness state.",
      details: Object.freeze({
        reasonCode: HealthRefreshUnknownReasonCode,
        backendHealth: status.health,
        readinessState,
      }),
    });
  }

  private mergeBackendCapabilities(
    node: ExecutionNodeRecord,
    status: Awaited<ReturnType<IImageManipulationExecutionCapabilityPort["getExecutionBackendStatus"]>>,
    normalized: NormalizedBackendObservation,
  ): ReadonlyArray<ExecutionNodeBackendFamilyCapability> {
    const canonicalBackendFamily = this.resolveCanonicalBackendFamily(node, status.backendFamily);
    const existingEntry = node.backendFamilyCapabilities.find((entry) => entry.backendFamily === canonicalBackendFamily);
    const metadataTags = new Set<string>(existingEntry?.metadataTags ?? []);
    metadataTags.add(`refresh:${normalized.classification}`);

    const refreshedEntry: ExecutionNodeBackendFamilyCapability = Object.freeze({
      backendFamily: canonicalBackendFamily,
      supportedExecutionTargets: Object.freeze([ExecutionNodeTargetKinds.imageManipulation]),
      supportedOperationKinds: Object.freeze([
        ...(status.capabilities.supportedOperationKinds.length > 0
          ? status.capabilities.supportedOperationKinds
          : existingEntry?.supportedOperationKinds ?? []),
      ]),
      supportedOperationCapabilities: Object.freeze([...(existingEntry?.supportedOperationCapabilities ?? [])]),
      supportedInputKinds: Object.freeze([...(existingEntry?.supportedInputKinds ?? [])]),
      supportedOutputKinds: Object.freeze([...(existingEntry?.supportedOutputKinds ?? [])]),
      supportedTranslationContractVersions: Object.freeze([
        ...(status.capabilities.supportedTranslationContractVersions.length > 0
          ? status.capabilities.supportedTranslationContractVersions
          : existingEntry?.supportedTranslationContractVersions ?? []),
      ]),
      resourceClassHints: Object.freeze([...(existingEntry?.resourceClassHints ?? [])]),
      executionReadiness: Object.freeze({
        state: normalized.backendReadiness,
        checkedAt: normalized.checkedAt,
        summary: normalized.summary,
      }),
      capabilityProfileVersion: existingEntry?.capabilityProfileVersion,
      metadataTags: Object.freeze([...metadataTags.values()]),
    });

    const others = node.backendFamilyCapabilities.filter((entry) => entry.backendFamily !== canonicalBackendFamily);
    return Object.freeze([
      ...others,
      refreshedEntry,
    ]);
  }

  private resolveCanonicalBackendFamily(node: ExecutionNodeRecord, backendFamily: string): string {
    const normalizedObserved = normalizeBackendFamily(backendFamily);
    const existingMatch = node.backendFamilyCapabilities.find((entry) => (
      normalizeBackendFamily(entry.backendFamily) === normalizedObserved
      || (normalizedObserved.includes("comfyui") && normalizeBackendFamily(entry.backendFamily).includes("comfyui"))
    ));
    return existingMatch?.backendFamily ?? normalizedObserved;
  }

  private async persistHealthRefresh(input: {
    readonly node: ExecutionNodeRecord;
    readonly observedAt: string;
    readonly healthStatus: ExecutionNodeHealthStatus;
    readonly actorUserIdentityId: string;
    readonly reason?: string;
    readonly correlationId?: string;
    readonly details: Readonly<Record<string, unknown>>;
  }): Promise<ExecutionNodeMutationResult> {
    const mutation = createExecutionNodeMutationContext({
      actorUserIdentityId: input.actorUserIdentityId,
      operationPrefix: "refresh-execution-node-health",
      idGenerator: this.idGenerator,
      clock: this.clock,
      reason: input.reason,
      correlationId: input.correlationId,
    });

    if (
      input.healthStatus === ExecutionNodeHealthStatuses.unavailable
      && input.node.activationStatus === ExecutionNodeActivationStatuses.active
    ) {
      return this.dependencies.nodeRepository.updateExecutionNodeAvailability({
        nodeId: input.node.nodeId,
        activationStatus: ExecutionNodeActivationStatuses.unavailable,
        healthStatus: input.healthStatus,
        changedAt: input.observedAt,
        mutation,
        details: input.details,
      });
    }

    if (
      input.healthStatus === ExecutionNodeHealthStatuses.ready
      && input.node.activationStatus !== ExecutionNodeActivationStatuses.active
    ) {
      if (isExecutionNodeActivationTransitionAllowed(input.node.activationStatus, ExecutionNodeActivationStatuses.active)) {
        return this.dependencies.nodeRepository.updateExecutionNodeAvailability({
          nodeId: input.node.nodeId,
          activationStatus: ExecutionNodeActivationStatuses.active,
          healthStatus: input.healthStatus,
          changedAt: input.observedAt,
          mutation,
          details: input.details,
        });
      }

      return this.dependencies.nodeRepository.updateExecutionNodeHealth({
        nodeId: input.node.nodeId,
        healthStatus: ExecutionNodeHealthStatuses.unknown,
        observedAt: input.observedAt,
        mutation,
      });
    }

    return this.dependencies.nodeRepository.updateExecutionNodeHealth({
      nodeId: input.node.nodeId,
      healthStatus: input.healthStatus,
      observedAt: input.observedAt,
      mutation,
    });
  }

  private toHealthRefreshResult(input: {
    readonly nodeId: string;
    readonly mutation: ExecutionNodeMutationResult;
    readonly normalizedObservation: NormalizedBackendObservation;
  }): ExecutionNodeHealthRefreshResult {
    return Object.freeze({
      nodeId: input.nodeId,
      changed: input.mutation.changed,
      record: input.mutation.record,
      observation: Object.freeze({
        healthStatus: input.normalizedObservation.healthStatus,
        observedAt: input.normalizedObservation.checkedAt,
        summary: input.normalizedObservation.summary,
        details: input.normalizedObservation.details,
      }),
    });
  }

  private toCapabilityRefreshResult(input: {
    readonly nodeId: string;
    readonly mutation: ExecutionNodeMutationResult;
    readonly refreshedCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
    readonly normalizedObservation: NormalizedBackendObservation;
  }): ExecutionNodeCapabilityRefreshResult {
    return Object.freeze({
      nodeId: input.nodeId,
      changed: input.mutation.changed,
      record: input.mutation.record,
      observation: Object.freeze({
        backendFamilyCapabilities: input.refreshedCapabilities,
        observedAt: input.normalizedObservation.checkedAt,
        summary: input.normalizedObservation.summary,
        details: input.normalizedObservation.details,
      }),
    });
  }

  private resolveReadinessState(
    status: Awaited<ReturnType<IImageManipulationExecutionCapabilityPort["getExecutionBackendStatus"]>>,
  ): string {
    const diagnostics = status.diagnostics;
    if (!diagnostics || typeof diagnostics !== "object") {
      return "unknown";
    }
    const readinessState = (diagnostics as Readonly<Record<string, unknown>>)["readinessState"];
    return typeof readinessState === "string" ? readinessState.trim().toLowerCase() : "unknown";
  }

  private normalizeTimestamp(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed.toISOString();
  }
}

function normalizeBackendFamily(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "unknown-backend";
  }
  if (normalized.includes("comfyui")) {
    return "comfyui";
  }
  return normalized;
}
