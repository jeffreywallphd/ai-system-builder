import type {
  IAuthoritativeSchedulingInputAssembler,
  SchedulingEvaluationSnapshot,
} from "@application/scheduling/AuthoritativeSchedulingDecisionPipeline";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import { deriveRunAssignmentRequirementSet } from "@application/runs/use-cases/RunAssignmentRequirementDerivation";
import type { INodeTrustIdentityPersistenceRepository } from "@application/nodes/ports/INodeTrustIdentityPersistenceRepository";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "@application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository";
import { RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";
import {
  SchedulingCandidateDenialCodes,
  SchedulingNodeUsageModes,
  type SchedulingPolicyReason,
} from "@domain/scheduling/SchedulingDomain";
import type { ISchedulingDeploymentProfilePolicyContextPort } from "@application/scheduling/ports/SchedulingPolicyProfilePorts";
import type { NodeIdentityPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";

export interface AuthoritativeSchedulingNodePolicyState {
  readonly nodeId: string;
  readonly schedulable?: boolean;
  readonly usageMode?: typeof SchedulingNodeUsageModes[keyof typeof SchedulingNodeUsageModes];
  readonly localInteractiveOwnerUserIdentityId?: string;
  readonly hybridLocalUseProtection?: Readonly<{
    readonly reservedLocalCapacityUnits?: number;
    readonly activeRemoteAssignmentCount?: number;
    readonly protectedLocalUserWindow?: Readonly<{
      readonly startsAt: string;
      readonly endsAt: string;
      readonly protectedUserIdentityId?: string;
    }>;
  }>;
  readonly reservationOwner?: string;
  readonly deploymentProfileId?: string;
}

export interface IAuthoritativeSchedulingNodePolicyStatePort {
  listNodePolicyState(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly workspaceId?: string;
    readonly nodeIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<AuthoritativeSchedulingNodePolicyState>>;
}

export interface AuthoritativeSchedulingNodeStateRefreshRecord {
  readonly nodeId: string;
  readonly state?: NodeIdentityPersistenceRecord;
  readonly unavailableReason?: Readonly<{
    readonly code?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }>;
}

export interface IAuthoritativeSchedulingNodeStateRefreshPort {
  refreshNodeState(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly workspaceId?: string;
    readonly nodeIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<AuthoritativeSchedulingNodeStateRefreshRecord>>;
}

export interface AuthoritativeSchedulingNodeFreshnessPolicy {
  readonly maxHeartbeatAgeSeconds: number;
  readonly requireHeartbeat: boolean;
  readonly treatOfflineHeartbeatAsUnavailable: boolean;
}

interface AssembleAuthoritativeSchedulingInputUseCaseDependencies {
  readonly selectAssignmentReadyRunsUseCase: Pick<SelectAssignmentReadyRunsUseCase, "execute">;
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly nodeRepository: Pick<INodeTrustIdentityPersistenceRepository, "listNodes">;
  readonly roleAssignmentRepository?: Pick<IAuthorizationRoleAssignmentPersistenceRepository, "listRoleAssignments">;
  readonly nodePolicyStatePort?: IAuthoritativeSchedulingNodePolicyStatePort;
  readonly nodeStateRefreshPort?: IAuthoritativeSchedulingNodeStateRefreshPort;
  readonly deploymentProfilePolicyContextPort?: ISchedulingDeploymentProfilePolicyContextPort;
  readonly nodeFreshnessPolicy?: Partial<AuthoritativeSchedulingNodeFreshnessPolicy>;
}

const DefaultReservationTtlSeconds = 30;
const DefaultNodeFreshnessPolicy = Object.freeze({
  maxHeartbeatAgeSeconds: 120,
  requireHeartbeat: true,
  treatOfflineHeartbeatAsUnavailable: true,
}) satisfies AuthoritativeSchedulingNodeFreshnessPolicy;

export class AssembleAuthoritativeSchedulingInputUseCase implements IAuthoritativeSchedulingInputAssembler {
  private readonly nodeFreshnessPolicy: AuthoritativeSchedulingNodeFreshnessPolicy;

  public constructor(private readonly dependencies: AssembleAuthoritativeSchedulingInputUseCaseDependencies) {
    this.nodeFreshnessPolicy = Object.freeze({
      maxHeartbeatAgeSeconds: normalizePositiveInteger(
        dependencies.nodeFreshnessPolicy?.maxHeartbeatAgeSeconds,
        DefaultNodeFreshnessPolicy.maxHeartbeatAgeSeconds,
      ),
      requireHeartbeat: dependencies.nodeFreshnessPolicy?.requireHeartbeat
        ?? DefaultNodeFreshnessPolicy.requireHeartbeat,
      treatOfflineHeartbeatAsUnavailable: dependencies.nodeFreshnessPolicy?.treatOfflineHeartbeatAsUnavailable
        ?? DefaultNodeFreshnessPolicy.treatOfflineHeartbeatAsUnavailable,
    });
  }

  public async assemble(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingEvaluationSnapshot> {
    const claimedSelection = await this.dependencies.selectAssignmentReadyRunsUseCase.execute({
      asOf: input.asOf,
      reservationOwner: input.reservationOwner,
      queueId: input.queueId,
      workspaceId: input.workspaceId,
      limit: input.limit,
      reservationTtlSeconds: DefaultReservationTtlSeconds,
    });
    const queueLeases = Object.freeze(claimedSelection.items.map((item) => Object.freeze({
      runId: item.run.runId,
      queueId: item.queue.queueId,
      enteredAt: item.queue.enteredAt,
      eligibleAt: item.queue.eligibleAt,
      claimToken: item.queue.claimToken,
      claimOwner: input.reservationOwner,
      claimExpiresAt: item.queue.claimExpiresAt,
    })));

    const runInputs = await this.toSchedulingRunInputs({
      asOf: input.asOf,
      queueLeases,
      workspaceId: input.workspaceId,
    });
    const nodes = await this.toSchedulingNodeInputs({
      asOf: input.asOf,
      reservationOwner: input.reservationOwner,
      workspaceId: input.workspaceId,
      nodeScope: input.nodeScope,
    });
    const deploymentProfileContext = this.dependencies.deploymentProfilePolicyContextPort
      ? await this.dependencies.deploymentProfilePolicyContextPort.resolveDeploymentProfilePolicyContext({
        asOf: input.asOf,
        reservationOwner: input.reservationOwner,
        workspaceId: input.workspaceId,
        queueLeases,
        runs: runInputs,
        nodes,
      })
      : undefined;

    return Object.freeze({
      asOf: input.asOf,
      queueLeases,
      runs: runInputs,
      nodes,
      deploymentProfileId: normalizeOptional(deploymentProfileContext?.deploymentProfileId),
    });
  }

  private async toSchedulingRunInputs(input: {
    readonly asOf: string;
    readonly queueLeases: SchedulingEvaluationSnapshot["queueLeases"];
    readonly workspaceId?: string;
  }): Promise<SchedulingEvaluationSnapshot["runs"]> {
    const runs: SchedulingEvaluationSnapshot["runs"][number][] = [];
    for (const lease of input.queueLeases) {
      const runRecord = await this.dependencies.runRepository.findRunById(lease.runId);
      if (!runRecord) {
        continue;
      }

      const requirements = deriveRunAssignmentRequirementSet(runRecord);
      const workspaceId = normalizeOptional(runRecord.workspaceId);
      const roleKeys = await this.resolveWorkspaceRoleKeys({
        asOf: input.asOf,
        workspaceId,
        actorUserIdentityId: normalizeOptional(runRecord.userIdentityId),
      });
      runs.push(Object.freeze({
        runId: runRecord.runId,
        workspaceId,
        submittedByUserIdentityId: normalizeOptional(runRecord.userIdentityId),
        workspaceRoleKeys: roleKeys,
        requirements: Object.freeze({
          requiredCapabilities: requirements?.requiredCapabilities ?? Object.freeze([]),
          requiresRemoteScheduling: requirements?.requiresRemoteScheduling ?? true,
        }),
        queue: Object.freeze({
          queueId: lease.queueId,
          enteredAt: lease.enteredAt,
          eligibleAt: lease.eligibleAt,
          claimToken: lease.claimToken,
          claimOwner: lease.claimOwner,
        }),
      }));
    }

    return Object.freeze(runs);
  }

  private async toSchedulingNodeInputs(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly workspaceId?: string;
    readonly nodeScope?: ReadonlyArray<string>;
  }): Promise<SchedulingEvaluationSnapshot["nodes"]> {
    const nodes = await this.dependencies.nodeRepository.listNodes({
      includeRevoked: true,
      limit: 500,
    });
    const nodeScope = input.nodeScope ? new Set(input.nodeScope) : undefined;
    const filteredNodes = nodeScope
      ? nodes.filter((node) => nodeScope.has(node.nodeId))
      : nodes;
    const nodeIds = filteredNodes.map((node) => node.nodeId);

    const refreshedStateByNodeId = new Map<string, AuthoritativeSchedulingNodeStateRefreshRecord>();
    if (this.dependencies.nodeStateRefreshPort && nodeIds.length > 0) {
      try {
        const refreshed = await this.dependencies.nodeStateRefreshPort.refreshNodeState({
          asOf: input.asOf,
          reservationOwner: input.reservationOwner,
          workspaceId: input.workspaceId,
          nodeIds,
        });
        for (const entry of refreshed) {
          if (nodeIds.includes(entry.nodeId)) {
            refreshedStateByNodeId.set(entry.nodeId, entry);
          }
        }
        for (const nodeId of nodeIds) {
          if (refreshedStateByNodeId.has(nodeId)) {
            continue;
          }
          refreshedStateByNodeId.set(nodeId, Object.freeze({
            nodeId,
            unavailableReason: Object.freeze({
              code: SchedulingCandidateDenialCodes.nodeStateUnavailable,
              message: "Node state refresh did not return availability data for this scheduling cycle.",
            }),
          }));
        }
      } catch (error) {
        const safeErrorMessage = error instanceof Error
          ? normalizeOptional(error.message)
          : undefined;
        for (const nodeId of nodeIds) {
          refreshedStateByNodeId.set(nodeId, Object.freeze({
            nodeId,
            unavailableReason: Object.freeze({
              code: SchedulingCandidateDenialCodes.nodeStateUnavailable,
              message: "Node state refresh failed for this scheduling cycle.",
              details: Object.freeze({
                refreshErrorMessage: safeErrorMessage,
              }),
            }),
          }));
        }
      }
    }

    const policyStateByNodeId = new Map<string, AuthoritativeSchedulingNodePolicyState>();
    if (this.dependencies.nodePolicyStatePort && nodeIds.length > 0) {
      const policyStates = await this.dependencies.nodePolicyStatePort.listNodePolicyState({
        asOf: input.asOf,
        reservationOwner: input.reservationOwner,
        workspaceId: input.workspaceId,
        nodeIds,
      });
      for (const entry of policyStates) {
        policyStateByNodeId.set(entry.nodeId, entry);
      }
    }

    return Object.freeze(filteredNodes.map((node) => {
      const refreshedState = this.dependencies.nodeStateRefreshPort
        ? refreshedStateByNodeId.get(node.nodeId)
        : undefined;
      const authoritativeNode = refreshedState?.state ?? node;
      const schedulability = evaluateNodeSchedulability({
        asOf: input.asOf,
        node: authoritativeNode,
        freshnessPolicy: this.nodeFreshnessPolicy,
        refreshRecord: refreshedState,
      });
      const policyState = policyStateByNodeId.get(authoritativeNode.nodeId);
      const policyAllowsScheduling = policyState?.schedulable ?? true;
      const schedulable = schedulability.schedulable && policyAllowsScheduling;
      return Object.freeze({
        nodeId: authoritativeNode.nodeId,
        nodeType: authoritativeNode.nodeType,
        schedulable,
        unschedulableReason: schedulable
          ? undefined
          : schedulability.reason ?? createPolicyReason(
            SchedulingCandidateDenialCodes.nodeNotSchedulable,
            `Node '${authoritativeNode.nodeId}' is not schedulable.`,
          ),
        supportsRemoteScheduling: authoritativeNode.capabilityProfile.supportsRemoteScheduling,
        enabledCapabilities: Object.freeze([...authoritativeNode.capabilityProfile.enabledCapabilities]),
        usageMode: policyState?.usageMode ?? SchedulingNodeUsageModes.idle,
        localInteractiveOwnerUserIdentityId: normalizeOptional(policyState?.localInteractiveOwnerUserIdentityId),
        hybridLocalUseProtection: policyState?.hybridLocalUseProtection,
        reservationOwner: normalizeOptional(policyState?.reservationOwner),
        deploymentProfileId: normalizeOptional(policyState?.deploymentProfileId),
      });
    }));
  }

  private async resolveWorkspaceRoleKeys(input: {
    readonly asOf: string;
    readonly workspaceId?: string;
    readonly actorUserIdentityId?: string;
  }): Promise<ReadonlyArray<string>> {
    if (!this.dependencies.roleAssignmentRepository || !input.workspaceId || !input.actorUserIdentityId) {
      return Object.freeze([WorkspaceAuthorizationRoleKeys.member]);
    }

    const roleAssignments = await this.dependencies.roleAssignmentRepository.listRoleAssignments({
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actorUserIdentityId,
      scope: RoleAssignmentScopes.workspace,
      statuses: [RoleAssignmentStatuses.active],
      asOf: input.asOf,
      includeRevoked: false,
      limit: 8,
    });
    const roleKeys = [...new Set(
      roleAssignments
        .map((assignment) => normalizeOptional(assignment.roleKey))
        .filter((value): value is string => Boolean(value)),
    )];
    if (roleKeys.length === 0) {
      return Object.freeze([WorkspaceAuthorizationRoleKeys.member]);
    }
    return Object.freeze(roleKeys);
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return value as number;
}

function createPolicyReason(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): SchedulingPolicyReason {
  return Object.freeze({
    code,
    message,
    details,
  });
}

function evaluateNodeSchedulability(input: {
  readonly asOf: string;
  readonly node: NodeIdentityPersistenceRecord;
  readonly freshnessPolicy: AuthoritativeSchedulingNodeFreshnessPolicy;
  readonly refreshRecord?: AuthoritativeSchedulingNodeStateRefreshRecord;
}): Readonly<{
  readonly schedulable: boolean;
  readonly reason?: SchedulingPolicyReason;
}> {
  if (!isNodeTrustedForScheduling(input.node)) {
    return Object.freeze({
      schedulable: false,
      reason: toNodeTrustSchedulabilityReason(input.node),
    });
  }

  if (input.refreshRecord && !input.refreshRecord.state) {
    const unavailableCode = normalizeOptional(input.refreshRecord.unavailableReason?.code)
      ?? SchedulingCandidateDenialCodes.nodeStateUnavailable;
    const unavailableMessage = normalizeOptional(input.refreshRecord.unavailableReason?.message)
      ?? `Node '${input.node.nodeId}' state refresh data is unavailable.`;
    return Object.freeze({
      schedulable: false,
      reason: createPolicyReason(
        unavailableCode,
        unavailableMessage,
        input.refreshRecord.unavailableReason?.details,
      ),
    });
  }

  const heartbeatDecision = evaluateNodeHeartbeatFreshness({
    asOf: input.asOf,
    node: input.node,
    freshnessPolicy: input.freshnessPolicy,
  });
  if (!heartbeatDecision.schedulable) {
    return heartbeatDecision;
  }

  return Object.freeze({
    schedulable: true,
  });
}

function isNodeTrustedForScheduling(node: {
  readonly approvalStatus: string;
  readonly trustState: string;
  readonly revokedAt?: string;
  readonly revocation: {
    readonly state: string;
    readonly revokedAt?: string;
  };
  readonly certificate?: {
    readonly certificateRef: string;
  };
}): boolean {
  return node.approvalStatus === NodeApprovalStatuses.approved
    && node.trustState === NodeTrustStates.trusted
    && node.revocation.state !== NodeRevocationStates.revoked
    && !node.revocation.revokedAt
    && !node.revokedAt
    && Boolean(normalizeOptional(node.certificate?.certificateRef));
}

function toNodeTrustSchedulabilityReason(node: NodeIdentityPersistenceRecord): SchedulingPolicyReason {
  if (
    node.revocation.state === NodeRevocationStates.revoked
    || Boolean(node.revokedAt)
    || Boolean(node.revocation.revokedAt)
  ) {
    return createPolicyReason(
      SchedulingCandidateDenialCodes.nodeRevoked,
      `Node '${node.nodeId}' is revoked and cannot receive scheduler placements.`,
    );
  }

  return createPolicyReason(
    SchedulingCandidateDenialCodes.nodeNotSchedulable,
    `Node '${node.nodeId}' is not approved and trusted for scheduler placement.`,
    Object.freeze({
      approvalStatus: node.approvalStatus,
      trustState: node.trustState,
      hasCertificate: Boolean(normalizeOptional(node.certificate?.certificateRef)),
    }),
  );
}

function evaluateNodeHeartbeatFreshness(input: {
  readonly asOf: string;
  readonly node: NodeIdentityPersistenceRecord;
  readonly freshnessPolicy: AuthoritativeSchedulingNodeFreshnessPolicy;
}): Readonly<{
  readonly schedulable: boolean;
  readonly reason?: SchedulingPolicyReason;
}> {
  if (!input.node.lastSeen) {
    if (!input.freshnessPolicy.requireHeartbeat) {
      return Object.freeze({ schedulable: true });
    }
    return Object.freeze({
      schedulable: false,
      reason: createPolicyReason(
        SchedulingCandidateDenialCodes.nodeStateUnavailable,
        `Node '${input.node.nodeId}' is missing heartbeat availability data for scheduling.`,
      ),
    });
  }

  if (
    input.freshnessPolicy.treatOfflineHeartbeatAsUnavailable
    && input.node.lastSeen.heartbeatStatus === NodeHeartbeatStatuses.offline
  ) {
    return Object.freeze({
      schedulable: false,
      reason: createPolicyReason(
        SchedulingCandidateDenialCodes.nodeStateUnavailable,
        `Node '${input.node.nodeId}' is offline and unavailable for scheduler placement.`,
        Object.freeze({
          heartbeatStatus: input.node.lastSeen.heartbeatStatus,
          lastSeenAt: input.node.lastSeen.lastSeenAt,
        }),
      ),
    });
  }

  const asOfMillis = Date.parse(input.asOf);
  const lastSeenMillis = Date.parse(input.node.lastSeen.lastSeenAt);
  if (!Number.isFinite(asOfMillis) || !Number.isFinite(lastSeenMillis)) {
    return Object.freeze({
      schedulable: false,
      reason: createPolicyReason(
        SchedulingCandidateDenialCodes.nodeStateUnavailable,
        `Node '${input.node.nodeId}' heartbeat timestamps are invalid for freshness evaluation.`,
      ),
    });
  }

  const heartbeatAgeSeconds = Math.max(0, Math.floor((asOfMillis - lastSeenMillis) / 1000));
  if (heartbeatAgeSeconds > input.freshnessPolicy.maxHeartbeatAgeSeconds) {
    return Object.freeze({
      schedulable: false,
      reason: createPolicyReason(
        SchedulingCandidateDenialCodes.nodeStateStale,
        `Node '${input.node.nodeId}' heartbeat is stale for scheduler placement.`,
        Object.freeze({
          lastSeenAt: input.node.lastSeen.lastSeenAt,
          heartbeatAgeSeconds,
          maxHeartbeatAgeSeconds: input.freshnessPolicy.maxHeartbeatAgeSeconds,
        }),
      ),
    });
  }

  return Object.freeze({ schedulable: true });
}

