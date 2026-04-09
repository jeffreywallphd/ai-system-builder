import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeOperationalAvailabilityModes,
  type ExecutionNodeOperationalAvailabilityMode,
} from "@domain/nodes/ExecutionNodeDomain";
import { NodeTrustStates } from "@domain/nodes/NodeTrustDomain";
import type { ExecutionNodeMutationResult, IExecutionNodeRepository } from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
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
  normalizeTimestamp,
  toExecutionNodeInternalSummary,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

export const ExecutionNodeAvailabilityOverrideActions = Object.freeze({
  enable: "enable",
  disable: "disable",
  suppress: "suppress",
});

export type ExecutionNodeAvailabilityOverrideAction =
  typeof ExecutionNodeAvailabilityOverrideActions[keyof typeof ExecutionNodeAvailabilityOverrideActions];

export interface SetExecutionNodeAvailabilityOverrideUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly action: ExecutionNodeAvailabilityOverrideAction;
  readonly changedAt?: string;
  readonly suppressedUntil?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SetExecutionNodeAvailabilityOverrideUseCaseResponse {
  readonly node: ReturnType<typeof toExecutionNodeInternalSummary>;
  readonly mutation: ExecutionNodeMutationResult;
}

interface SetExecutionNodeAvailabilityOverrideUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly authorizationHook?: ExecutionNodeManagementAuthorizationHook;
  readonly auditSink?: ExecutionNodeManagementAuditSink;
  readonly idGenerator?: ExecutionNodeManagementUseCaseIdGenerator;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

export class SetExecutionNodeAvailabilityOverrideUseCase {
  private readonly idGenerator: ExecutionNodeManagementUseCaseIdGenerator;

  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: SetExecutionNodeAvailabilityOverrideUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultExecutionNodeManagementUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: SetExecutionNodeAvailabilityOverrideUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<SetExecutionNodeAvailabilityOverrideUseCaseResponse>> {
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

    const node = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (!node) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.notFound,
        `Execution node '${nodeId}' was not found.`,
      );
    }

    try {
      await this.dependencies.authorizationHook?.assertCanOverrideExecutionNodeAvailability?.({
        actorUserIdentityId,
        node,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to override execution-node availability.",
      );
    }

    if (node.activationStatus === ExecutionNodeActivationStatuses.revoked || node.trustState === NodeTrustStates.revoked) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidState,
        `Execution node '${nodeId}' is revoked and cannot accept availability overrides.`,
      );
    }

    const changedAt = normalizeOptional(request.changedAt) ?? this.clock.now().toISOString();
    let normalizedChangedAt: string;
    try {
      normalizedChangedAt = normalizeTimestamp(changedAt, "changedAt");
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "changedAt must be a valid timestamp.",
      );
    }

    const mode = this.resolveModeFromAction(request.action);
    if (!mode) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "action must be one of: enable, disable, suppress.",
      );
    }

    const suppressedUntil = normalizeOptional(request.suppressedUntil);
    if (mode === ExecutionNodeOperationalAvailabilityModes.suppressed) {
      if (!suppressedUntil) {
        return toExecutionNodeManagementFailure(
          ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
          "suppressedUntil is required when action='suppress'.",
        );
      }

      let normalizedSuppressedUntil: string;
      try {
        normalizedSuppressedUntil = normalizeTimestamp(suppressedUntil, "suppressedUntil");
      } catch (error) {
        return toExecutionNodeManagementFailure(
          ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
          error instanceof Error ? error.message : "suppressedUntil must be a valid timestamp.",
        );
      }

      if (Date.parse(normalizedSuppressedUntil) <= Date.parse(normalizedChangedAt)) {
        return toExecutionNodeManagementFailure(
          ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
          "suppressedUntil must be later than changedAt.",
        );
      }
    } else if (suppressedUntil) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "suppressedUntil is only allowed when action='suppress'.",
      );
    }

    const mutation = await this.dependencies.nodeRepository.updateExecutionNodeOperationalAvailability({
      nodeId,
      mode,
      suppressedUntil,
      changedAt: normalizedChangedAt,
      mutation: createExecutionNodeMutationContext({
        actorUserIdentityId,
        operationPrefix: "set-execution-node-availability-override",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
      }),
      details: Object.freeze({
        action: request.action,
        ...(request.details ?? {}),
      }),
    });

    await publishExecutionNodeManagementAuditEventBestEffort(this.dependencies.auditSink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeAvailabilityOverrideUpdated,
      actorUserIdentityId,
      occurredAt: normalizedChangedAt,
      nodeId: mutation.record.nodeId,
      outcome: mutation.wasReplay ? "already-applied" : "success",
      details: Object.freeze({
        action: request.action,
        mode,
        suppressedUntil,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: toExecutionNodeInternalSummary(mutation.record),
        mutation,
      }),
    };
  }

  private resolveModeFromAction(
    action: ExecutionNodeAvailabilityOverrideAction,
  ): ExecutionNodeOperationalAvailabilityMode | undefined {
    switch (action) {
      case ExecutionNodeAvailabilityOverrideActions.enable:
        return ExecutionNodeOperationalAvailabilityModes.enabled;
      case ExecutionNodeAvailabilityOverrideActions.disable:
        return ExecutionNodeOperationalAvailabilityModes.disabled;
      case ExecutionNodeAvailabilityOverrideActions.suppress:
        return ExecutionNodeOperationalAvailabilityModes.suppressed;
      default:
        return undefined;
    }
  }
}

