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
  NodeRevocationStates,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";
import { SchedulingNodeUsageModes } from "@domain/scheduling/SchedulingDomain";

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

interface AssembleAuthoritativeSchedulingInputUseCaseDependencies {
  readonly selectAssignmentReadyRunsUseCase: Pick<SelectAssignmentReadyRunsUseCase, "execute">;
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly nodeRepository: Pick<INodeTrustIdentityPersistenceRepository, "listNodes">;
  readonly roleAssignmentRepository?: Pick<IAuthorizationRoleAssignmentPersistenceRepository, "listRoleAssignments">;
  readonly nodePolicyStatePort?: IAuthoritativeSchedulingNodePolicyStatePort;
}

const DefaultReservationTtlSeconds = 30;

export class AssembleAuthoritativeSchedulingInputUseCase implements IAuthoritativeSchedulingInputAssembler {
  public constructor(private readonly dependencies: AssembleAuthoritativeSchedulingInputUseCaseDependencies) {}

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

    return Object.freeze({
      asOf: input.asOf,
      queueLeases,
      runs: runInputs,
      nodes,
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
      const policyState = policyStateByNodeId.get(node.nodeId);
      return Object.freeze({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        schedulable: policyState?.schedulable ?? isNodeSchedulable(node),
        supportsRemoteScheduling: node.capabilityProfile.supportsRemoteScheduling,
        enabledCapabilities: Object.freeze([...node.capabilityProfile.enabledCapabilities]),
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

function isNodeSchedulable(node: {
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

