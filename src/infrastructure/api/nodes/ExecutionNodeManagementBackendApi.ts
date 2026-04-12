import type {
  ExecutionNodeBackendAvailabilityReadApiRequest,
  ExecutionNodeBackendAvailabilityReadApiResponse,
  ExecutionNodeEligibilityCheckApiRequest,
  ExecutionNodeEligibilityCheckApiResponse,
  ExecutionNodeGetApiRequest,
  ExecutionNodeGetApiResponse,
  ExecutionNodeListApiRequest,
  ExecutionNodeListApiResponse,
  ExecutionNodeManagementApiError,
  ExecutionNodeManagementApiResponse,
  ExecutionNodeReadinessCheckApiRequest,
  ExecutionNodeReadinessCheckApiResponse,
  ExecutionNodeSetAvailabilityOverrideApiRequest,
  ExecutionNodeSetAvailabilityOverrideApiResponse,
} from "./sdk/PublicExecutionNodeManagementApiContract";
import { ExecutionNodeManagementApiErrorCodes } from "./sdk/PublicExecutionNodeManagementApiContract";
import type { ListExecutionNodesUseCase, GetExecutionNodeDetailUseCase, SetExecutionNodeAvailabilityOverrideUseCase } from "@application/nodes/use-cases";
import { ExecutionNodeAvailabilityOverrideActions, ExecutionNodeManagementUseCaseErrorCodes } from "@application/nodes/use-cases";
import type { IExecutionNodeEligibilityEvaluationServicePort } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import type { ImageExecutionNodeCompatibilityRequirements } from "@domain/nodes/ExecutionNodeDomain";
import {
  ExecutionNodeManagementTransportContractVersions,
  ExecutionNodeReadinessIssueSeverities,
  ExecutionNodeReadinessStates,
  type ExecutionNodeBackendAvailabilitySummaryDto,
  type ExecutionNodeEligibilityResultDto,
  type ExecutionNodeReadinessIssueDto,
  type ExecutionNodeReadinessNodeResultDto,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";
import {
  toExecutionNodeBackendAvailabilityReadResponseDto,
  toExecutionNodeEligibilityCheckResponseDto,
  toExecutionNodeListResponseFromInternalDto,
  toExecutionNodeGetResponseFromInternalDto,
  toExecutionNodeReadinessCheckResponseDto,
  toExecutionNodeSetAvailabilityOverrideResponseFromInternalDto,
} from "@shared/dto/nodes/ExecutionNodeManagementApiDtos";
import {
  ExecutionNodeManagementApiSchemaValidationError,
  parseExecutionNodeBackendAvailabilityReadRequestDto,
  parseExecutionNodeEligibilityCheckRequestDto,
  parseExecutionNodeGetRequestDto,
  parseExecutionNodeListRequestDto,
  parseExecutionNodeReadinessCheckRequestDto,
  parseExecutionNodeSetAvailabilityOverrideRequestDto,
} from "@shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts";

interface ExecutionNodeManagementBackendApiDependencies {
  readonly listExecutionNodesUseCase: ListExecutionNodesUseCase;
  readonly getExecutionNodeDetailUseCase: GetExecutionNodeDetailUseCase;
  readonly setExecutionNodeAvailabilityOverrideUseCase: SetExecutionNodeAvailabilityOverrideUseCase;
  readonly eligibilityService: IExecutionNodeEligibilityEvaluationServicePort;
  readonly clock?: {
    now(): Date;
  };
}

interface EvaluatedEligibilityContext {
  readonly checkedAt: string;
  readonly evaluations: ReadonlyArray<ExecutionNodeEligibilityResultDto>;
}

const IncludedBackendReadinessWithoutUnavailable = new Set(["ready", "degraded"]);

export class ExecutionNodeManagementBackendApi {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: ExecutionNodeManagementBackendApiDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async listNodes(
    request: ExecutionNodeListApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeListApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeListRequestDto(this.toListRequestDto(request)),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const outcome = await this.dependencies.listExecutionNodesUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      ...parsed.value,
      enabled: undefined,
      available: undefined,
      requireCertificateRef: undefined,
      backendReadinessStates: undefined,
    });
    if (!outcome.ok) {
      return this.failedFromUseCaseError(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: toExecutionNodeListResponseFromInternalDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        items: outcome.value.nodes,
        totalCount: outcome.value.totalCount,
        asOf: outcome.value.asOf,
      }),
    });
  }

  public async getNode(
    request: ExecutionNodeGetApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeGetApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeGetRequestDto({ nodeId: request.nodeId }),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const outcome = await this.dependencies.getExecutionNodeDetailUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: parsed.value.nodeId,
    });
    if (!outcome.ok) {
      return this.failedFromUseCaseError(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: toExecutionNodeGetResponseFromInternalDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        node: outcome.value.node,
        asOf: outcome.value.asOf,
      }),
    });
  }

  public async setAvailabilityOverride(
    request: ExecutionNodeSetAvailabilityOverrideApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeSetAvailabilityOverrideApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeSetAvailabilityOverrideRequestDto({
        nodeId: request.nodeId,
        action: request.action,
        changedAt: request.changedAt,
        suppressedUntil: request.suppressedUntil,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
      }),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const action = this.mapAvailabilityAction(parsed.value.action);
    if (!action) {
      return this.failed(
        ExecutionNodeManagementApiErrorCodes.invalidRequest,
        "action must be one of: enable, disable, suppress.",
      );
    }

    const outcome = await this.dependencies.setExecutionNodeAvailabilityOverrideUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: parsed.value.nodeId,
      action,
      changedAt: parsed.value.changedAt,
      suppressedUntil: parsed.value.suppressedUntil,
      expectedRevision: parsed.value.expectedRevision,
      reason: parsed.value.reason,
      correlationId: parsed.value.correlationId,
    });
    if (!outcome.ok) {
      return this.failedFromUseCaseError(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: toExecutionNodeSetAvailabilityOverrideResponseFromInternalDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        node: outcome.value.node,
        mutation: {
          changed: outcome.value.mutation.changed,
          wasReplay: outcome.value.mutation.wasReplay,
        },
        asOf: this.clock.now().toISOString(),
      }),
    });
  }

  public async checkEligibility(
    request: ExecutionNodeEligibilityCheckApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeEligibilityCheckApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeEligibilityCheckRequestDto(this.toEligibilityRequestDto(request)),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const evaluated = await this.evaluateEligibility({
      actorUserIdentityId: request.actorUserIdentityId,
      request: parsed.value,
    });
    if (!evaluated.ok) {
      return evaluated.error;
    }

    return Object.freeze({
      ok: true,
      data: toExecutionNodeEligibilityCheckResponseDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        checkedAt: evaluated.value.checkedAt,
        evaluations: evaluated.value.evaluations,
      }),
    });
  }

  public async checkReadiness(
    request: ExecutionNodeReadinessCheckApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeReadinessCheckApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeReadinessCheckRequestDto(this.toReadinessRequestDto(request)),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const evaluated = await this.evaluateEligibility({
      actorUserIdentityId: request.actorUserIdentityId,
      request: parsed.value,
    });
    if (!evaluated.ok) {
      return evaluated.error;
    }

    const checkedAt = evaluated.value.checkedAt;
    const evaluations = evaluated.value.evaluations;
    const nodeResults: ReadonlyArray<ExecutionNodeReadinessNodeResultDto> = Object.freeze(
      evaluations.map((evaluation) => Object.freeze({
        nodeId: evaluation.nodeId,
        displayName: evaluation.displayName,
        readiness: toNodeReadiness(evaluation.decision),
        eligible: evaluation.decision === "eligible",
        compatible: evaluation.compatible,
        routable: evaluation.routable,
        matchedBackendFamily: evaluation.matchedBackendFamily,
        matchedExecutionTarget: evaluation.matchedExecutionTarget,
        findingCodes: Object.freeze([...evaluation.findingCodes]),
      })),
    );

    const routableCount = evaluations.filter((entry) => entry.routable).length;
    const compatibleCount = evaluations.filter((entry) => entry.compatible).length;
    const readiness = routableCount > 0
      ? ExecutionNodeReadinessStates.ready
      : compatibleCount > 0
      ? ExecutionNodeReadinessStates.degraded
      : ExecutionNodeReadinessStates.blocked;
    const issues = buildReadinessIssues({
      readiness,
      evaluations,
    });

    return Object.freeze({
      ok: true,
      data: toExecutionNodeReadinessCheckResponseDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        checkedAt,
        readyForExecution: routableCount > 0,
        readiness,
        nodeResults,
        issues,
      }),
    });
  }

  public async listBackendAvailability(
    request: ExecutionNodeBackendAvailabilityReadApiRequest,
  ): Promise<ExecutionNodeManagementApiResponse<ExecutionNodeBackendAvailabilityReadApiResponse>> {
    if (!normalizeOptional(request.actorUserIdentityId)) {
      return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const parsed = this.parseRequest(
      () => parseExecutionNodeBackendAvailabilityReadRequestDto({
        backendFamilies: request.backendFamilies,
        executionTarget: request.executionTarget,
        includeUnavailable: request.includeUnavailable,
      }),
    );
    if (!parsed.ok) {
      return parsed.error;
    }

    const listOutcome = await this.dependencies.listExecutionNodesUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      backendFamilies: parsed.value.backendFamilies,
      executionTargets: parsed.value.executionTarget ? [parsed.value.executionTarget] : undefined,
      includeRevoked: false,
      limit: undefined,
      offset: undefined,
    });
    if (!listOutcome.ok) {
      return this.failedFromUseCaseError(listOutcome.error.code, listOutcome.error.message);
    }

    const details = await Promise.all(listOutcome.value.nodes.map(async (node) => {
      const detailOutcome = await this.dependencies.getExecutionNodeDetailUseCase.execute({
        actorUserIdentityId: request.actorUserIdentityId,
        nodeId: node.nodeId,
      });
      return detailOutcome.ok ? detailOutcome.value.node : undefined;
    }));

    const availability = aggregateBackendAvailability({
      nodes: details.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      backendFamilies: parsed.value.backendFamilies,
      executionTarget: parsed.value.executionTarget,
      includeUnavailable: parsed.value.includeUnavailable ?? false,
      asOf: listOutcome.value.asOf,
    });

    return Object.freeze({
      ok: true,
      data: toExecutionNodeBackendAvailabilityReadResponseDto({
        contractVersion: ExecutionNodeManagementTransportContractVersions.v1,
        asOf: listOutcome.value.asOf,
        backends: availability,
      }),
    });
  }

  private async evaluateEligibility(input: {
    readonly actorUserIdentityId: string;
    readonly request: ReturnType<typeof parseExecutionNodeEligibilityCheckRequestDto>;
  }): Promise<
    | { readonly ok: true; readonly value: EvaluatedEligibilityContext }
    | { readonly ok: false; readonly error: ExecutionNodeManagementApiResponse<never> }
  > {
    const checkedAt = input.request.now ?? this.clock.now().toISOString();
    const listed = await this.dependencies.listExecutionNodesUseCase.execute({
      actorUserIdentityId: input.actorUserIdentityId,
      nodeIds: input.request.candidateNodeIds,
      backendFamilies: input.request.requiredBackendFamilies,
      executionTargets: input.request.requiredExecutionTarget ? [input.request.requiredExecutionTarget] : undefined,
      requiredCapabilitiesAnyOf: input.request.requiredNodeCapabilities,
      supportsRemoteScheduling: input.request.requiresRemoteScheduling,
      includeRevoked: false,
      limit: undefined,
      offset: undefined,
    });
    if (!listed.ok) {
      return {
        ok: false,
        error: this.failedFromUseCaseError(listed.error.code, listed.error.message),
      };
    }

    const nodeIds = listed.value.nodes.map((node) => node.nodeId);
    const displayNames = new Map(listed.value.nodes.map((node) => [node.nodeId, node.displayName] as const));
    const requirements: ImageExecutionNodeCompatibilityRequirements = Object.freeze({
      requiredBackendFamilies: input.request.requiredBackendFamilies,
      requiredExecutionTarget: input.request.requiredExecutionTarget,
      requiredNodeCapabilities: input.request.requiredNodeCapabilities,
      requiresRemoteScheduling: input.request.requiresRemoteScheduling,
      requiredOperationKind: input.request.requiredOperationKind,
      requiredOperationCapability: input.request.requiredOperationCapability,
      requiredInputKinds: input.request.requiredInputKinds,
      requiredOutputKinds: input.request.requiredOutputKinds,
      requiredTranslationContractVersion: input.request.requiredTranslationContractVersion,
      preferredResourceClassHints: input.request.preferredResourceClassHints,
      allowDegraded: input.request.allowDegraded,
      maxLastSeenAgeMs: input.request.maxLastSeenAgeMs,
      now: checkedAt,
    });
    const evaluations = await this.dependencies.eligibilityService.evaluateExecutionNodeEligibility({
      asOf: checkedAt,
      requirements,
      candidateNodeIds: nodeIds,
    });

    return {
      ok: true,
      value: Object.freeze({
        checkedAt,
        evaluations: Object.freeze(evaluations.map((evaluation) => Object.freeze({
          nodeId: evaluation.nodeId,
          displayName: displayNames.get(evaluation.nodeId) ?? evaluation.nodeId,
          decision: evaluation.decision,
          compatible: evaluation.compatibility.compatible,
          routable: evaluation.compatibility.routable,
          matchedBackendFamily: evaluation.compatibility.matchedBackendFamily,
          matchedExecutionTarget: evaluation.compatibility.matchedExecutionTarget,
          findingCodes: Object.freeze(evaluation.compatibility.findings.map((finding) => finding.code)),
          findings: Object.freeze(evaluation.compatibility.findings.map((finding) => Object.freeze({
            code: finding.code,
            kind: finding.kind,
            message: finding.message,
            blocking: finding.blocking,
          }))),
        }))),
      }),
    };
  }

  private parseRequest<TPayload>(
    parser: () => TPayload,
  ): { readonly ok: true; readonly value: TPayload } | { readonly ok: false; readonly error: ExecutionNodeManagementApiResponse<never> } {
    try {
      return {
        ok: true,
        value: parser(),
      };
    } catch (error) {
      if (error instanceof ExecutionNodeManagementApiSchemaValidationError) {
        return {
          ok: false,
          error: this.failedValidation(error),
        };
      }
      throw error;
    }
  }

  private toListRequestDto(request: ExecutionNodeListApiRequest): Omit<ExecutionNodeListApiRequest, "actorUserIdentityId"> {
    return Object.freeze({
      nodeIds: request.nodeIds,
      nodeTypes: request.nodeTypes,
      approvalStatuses: request.approvalStatuses,
      trustStates: request.trustStates,
      activationStatuses: request.activationStatuses,
      healthStatuses: request.healthStatuses,
      operationalAvailabilityModes: request.operationalAvailabilityModes,
      backendFamilies: request.backendFamilies,
      executionTargets: request.executionTargets,
      requiredCapabilitiesAnyOf: request.requiredCapabilitiesAnyOf,
      supportsRemoteScheduling: request.supportsRemoteScheduling,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      includeRevoked: request.includeRevoked,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
      limit: request.limit,
      offset: request.offset,
    });
  }

  private toReadinessRequestDto(
    request: ExecutionNodeReadinessCheckApiRequest,
  ): Omit<ExecutionNodeReadinessCheckApiRequest, "actorUserIdentityId"> {
    return Object.freeze({
      workspaceId: request.workspaceId,
      workflowId: request.workflowId,
      runId: request.runId,
      candidateNodeIds: request.candidateNodeIds,
      requiredBackendFamilies: request.requiredBackendFamilies,
      requiredExecutionTarget: request.requiredExecutionTarget,
      requiredNodeCapabilities: request.requiredNodeCapabilities,
      requiresRemoteScheduling: request.requiresRemoteScheduling,
      requiredOperationKind: request.requiredOperationKind,
      requiredOperationCapability: request.requiredOperationCapability,
      requiredInputKinds: request.requiredInputKinds,
      requiredOutputKinds: request.requiredOutputKinds,
      requiredTranslationContractVersion: request.requiredTranslationContractVersion,
      preferredResourceClassHints: request.preferredResourceClassHints,
      allowDegraded: request.allowDegraded,
      maxLastSeenAgeMs: request.maxLastSeenAgeMs,
      now: request.now,
    });
  }

  private toEligibilityRequestDto(
    request: ExecutionNodeEligibilityCheckApiRequest,
  ): Omit<ExecutionNodeEligibilityCheckApiRequest, "actorUserIdentityId"> {
    return this.toReadinessRequestDto(request);
  }

  private mapAvailabilityAction(action: string): ExecutionNodeAvailabilityOverrideActions[keyof ExecutionNodeAvailabilityOverrideActions] | undefined {
    switch (action) {
      case ExecutionNodeAvailabilityOverrideActions.enable:
        return ExecutionNodeAvailabilityOverrideActions.enable;
      case ExecutionNodeAvailabilityOverrideActions.disable:
        return ExecutionNodeAvailabilityOverrideActions.disable;
      case ExecutionNodeAvailabilityOverrideActions.suppress:
        return ExecutionNodeAvailabilityOverrideActions.suppress;
      default:
        return undefined;
    }
  }

  private failedValidation(
    error: ExecutionNodeManagementApiSchemaValidationError,
  ): ExecutionNodeManagementApiResponse<never> {
    return this.failed(
      ExecutionNodeManagementApiErrorCodes.invalidRequest,
      "Request validation failed.",
      Object.freeze(error.issues.map((issue) => Object.freeze({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      }))),
    );
  }

  private failedFromUseCaseError(code: string, message: string): ExecutionNodeManagementApiResponse<never> {
    switch (code) {
      case ExecutionNodeManagementUseCaseErrorCodes.invalidRequest:
        return this.failed(ExecutionNodeManagementApiErrorCodes.invalidRequest, message);
      case ExecutionNodeManagementUseCaseErrorCodes.forbidden:
        return this.failed(ExecutionNodeManagementApiErrorCodes.forbidden, message);
      case ExecutionNodeManagementUseCaseErrorCodes.notFound:
        return this.failed(ExecutionNodeManagementApiErrorCodes.notFound, message);
      case ExecutionNodeManagementUseCaseErrorCodes.conflict:
      case ExecutionNodeManagementUseCaseErrorCodes.invalidState:
        return this.failed(ExecutionNodeManagementApiErrorCodes.conflict, message);
      default:
        return this.failed(ExecutionNodeManagementApiErrorCodes.internal, message);
    }
  }

  private failed(
    code: ExecutionNodeManagementApiError["code"],
    message: string,
    validationErrors?: ExecutionNodeManagementApiError["validationErrors"],
  ): ExecutionNodeManagementApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        validationErrors,
      }),
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toNodeReadiness(decision: ExecutionNodeEligibilityResultDto["decision"]): ExecutionNodeReadinessNodeResultDto["readiness"] {
  switch (decision) {
    case "eligible":
      return ExecutionNodeReadinessStates.ready;
    case "unavailable":
      return ExecutionNodeReadinessStates.degraded;
    default:
      return ExecutionNodeReadinessStates.blocked;
  }
}

function buildReadinessIssues(input: {
  readonly readiness: ExecutionNodeReadinessCheckApiResponse["readiness"];
  readonly evaluations: ReadonlyArray<ExecutionNodeEligibilityResultDto>;
}): ReadonlyArray<ExecutionNodeReadinessIssueDto> {
  if (input.evaluations.length === 0) {
    return Object.freeze([Object.freeze({
      code: "execution-node-candidates-unavailable",
      severity: ExecutionNodeReadinessIssueSeverities.error,
      message: "No execution-node candidates are available for this request.",
    })]);
  }

  if (input.readiness === ExecutionNodeReadinessStates.ready) {
    return Object.freeze([]);
  }

  if (input.readiness === ExecutionNodeReadinessStates.degraded) {
    return Object.freeze([Object.freeze({
      code: "execution-node-no-routable-match",
      severity: ExecutionNodeReadinessIssueSeverities.error,
      message: "Compatible execution nodes were found, but none are currently routable.",
    })]);
  }

  return Object.freeze([Object.freeze({
    code: "execution-node-no-compatible-match",
    severity: ExecutionNodeReadinessIssueSeverities.error,
    message: "No compatible execution nodes satisfy the current requirements.",
  })]);
}

function aggregateBackendAvailability(input: {
  readonly nodes: ReadonlyArray<ExecutionNodeGetApiResponse["node"]>;
  readonly backendFamilies?: ReadonlyArray<string>;
  readonly executionTarget?: string;
  readonly includeUnavailable: boolean;
  readonly asOf: string;
}): ReadonlyArray<ExecutionNodeBackendAvailabilitySummaryDto> {
  const familyFilter = new Set((input.backendFamilies ?? []).map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  const executionTarget = input.executionTarget?.trim().toLowerCase();
  const aggregate = new Map<string, {
    readyNodeCount: number;
    degradedNodeCount: number;
    unavailableNodeCount: number;
    unknownNodeCount: number;
    checkedAt?: string;
  }>();

  for (const node of input.nodes) {
    for (const capability of node.backendCapabilities) {
      const backendFamily = capability.backendFamily.trim().toLowerCase();
      if (familyFilter.size > 0 && !familyFilter.has(backendFamily)) {
        continue;
      }
      if (
        executionTarget
        && !capability.supportedExecutionTargets.some((target) => target.toLowerCase() === executionTarget)
      ) {
        continue;
      }

      const existing = aggregate.get(backendFamily) ?? {
        readyNodeCount: 0,
        degradedNodeCount: 0,
        unavailableNodeCount: 0,
        unknownNodeCount: 0,
        checkedAt: undefined,
      };
      switch (capability.readiness.state) {
        case "ready":
          existing.readyNodeCount += 1;
          break;
        case "degraded":
          existing.degradedNodeCount += 1;
          break;
        case "unavailable":
          existing.unavailableNodeCount += 1;
          break;
        default:
          existing.unknownNodeCount += 1;
          break;
      }
      if (!existing.checkedAt || (capability.readiness.checkedAt && capability.readiness.checkedAt > existing.checkedAt)) {
        existing.checkedAt = capability.readiness.checkedAt;
      }
      aggregate.set(backendFamily, existing);
    }
  }

  for (const backendFamily of familyFilter.values()) {
    if (!aggregate.has(backendFamily)) {
      aggregate.set(backendFamily, {
        readyNodeCount: 0,
        degradedNodeCount: 0,
        unavailableNodeCount: 0,
        unknownNodeCount: 0,
        checkedAt: input.asOf,
      });
    }
  }

  const entries = [...aggregate.entries()]
    .map(([backendFamily, entry]) => {
      const totalNodeCount = entry.readyNodeCount + entry.degradedNodeCount + entry.unavailableNodeCount + entry.unknownNodeCount;
      const readiness = entry.readyNodeCount > 0
        ? "ready"
        : entry.degradedNodeCount > 0
        ? "degraded"
        : entry.unavailableNodeCount > 0
        ? "unavailable"
        : "unknown";
      return Object.freeze({
        backendFamily,
        readiness,
        totalNodeCount,
        readyNodeCount: entry.readyNodeCount,
        degradedNodeCount: entry.degradedNodeCount,
        unavailableNodeCount: entry.unavailableNodeCount,
        unknownNodeCount: entry.unknownNodeCount,
        checkedAt: entry.checkedAt ?? input.asOf,
        summary: totalNodeCount === 0
          ? "No execution nodes currently advertise this backend family."
          : undefined,
      } satisfies ExecutionNodeBackendAvailabilitySummaryDto);
    })
    .filter((entry) => input.includeUnavailable || IncludedBackendReadinessWithoutUnavailable.has(entry.readiness))
    .sort((left, right) => left.backendFamily.localeCompare(right.backendFamily));

  return Object.freeze(entries);
}
