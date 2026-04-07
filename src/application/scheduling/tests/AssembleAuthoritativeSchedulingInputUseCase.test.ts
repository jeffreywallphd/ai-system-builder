import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { INodeTrustIdentityPersistenceRepository } from "@application/nodes/ports/INodeTrustIdentityPersistenceRepository";
import type { NodeIdentityPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeIdentityPersistenceLookupQuery } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "@application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository";
import type { AuthorizationRoleAssignmentPersistenceLookupQuery } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import { NodeApprovalStatuses, NodeTrustStates, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import { SchedulingNodeUsageModes } from "@domain/scheduling/SchedulingDomain";
import { AssembleAuthoritativeSchedulingInputUseCase } from "../use-cases/AssembleAuthoritativeSchedulingInputUseCase";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(_query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze([...this.runs.values()]);
  }

  public async createRun(
    _record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    throw new Error("Not implemented.");
  }

  public async saveRun(
    _record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    throw new Error("Not implemented.");
  }
}

class RecordingNodeRepository implements Pick<INodeTrustIdentityPersistenceRepository, "listNodes"> {
  public constructor(private readonly nodes: ReadonlyArray<NodeIdentityPersistenceRecord>) {}

  public async listNodes(
    _query: NodeIdentityPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>> {
    return this.nodes;
  }
}

class RecordingRoleAssignmentRepository implements Pick<IAuthorizationRoleAssignmentPersistenceRepository, "listRoleAssignments"> {
  public async listRoleAssignments(query: AuthorizationRoleAssignmentPersistenceLookupQuery) {
    if (query.workspaceId === "workspace-alpha" && query.actorUserIdentityId === "user:owner") {
      return Object.freeze([Object.freeze({
        id: "role:owner",
        actorUserIdentityId: "user:owner",
        roleKey: WorkspaceAuthorizationRoleKeys.owner,
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace-alpha",
        status: RoleAssignmentStatuses.active,
        assignedAt: "2026-04-07T12:00:00.000Z",
        assignedByUserIdentityId: "user:admin",
        createdAt: "2026-04-07T12:00:00.000Z",
        createdBy: "user:admin",
        lastModifiedAt: "2026-04-07T12:00:00.000Z",
        lastModifiedBy: "user:admin",
        revision: 1,
      })]);
    }
    return Object.freeze([]);
  }
}

function createRunRecord(): PlatformRunRecord {
  return Object.freeze({
    runId: "run:owner",
    runKind: "workflow",
    status: "pending",
    workspaceId: "workspace-alpha",
    userIdentityId: "user:owner",
    sourceAggregateRef: "workflow:demo",
    initiatedAt: "2026-04-07T12:00:00.000Z",
    metadata: Object.freeze({
      submissionSnapshot: Object.freeze({
        actor: Object.freeze({
          actorUserIdentityId: "user:owner",
          activeWorkspaceId: "workspace-alpha",
        }),
        runtimeTarget: Object.freeze({
          systemId: "system:demo",
          versionId: "system:demo:v1",
          async: true,
        }),
        tags: Object.freeze([]),
        parameters: Object.freeze({}),
        storageReferences: Object.freeze([]),
        resourceReferences: Object.freeze([]),
        policyPrerequisites: Object.freeze([]),
      }),
    }),
    revision: 1,
  });
}

function createNode(nodeId: string, nodeType = NodeTypes.compute): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId,
    nodeType,
    displayName: nodeId,
    capabilityProfile: Object.freeze({
      enabledCapabilities: Object.freeze(["executor"]),
      supportsRemoteScheduling: true,
    }),
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    certificate: Object.freeze({
      certificateRef: `cert:${nodeId}`,
    }),
    deploymentTags: Object.freeze([]),
    revocation: Object.freeze({
      state: "active",
    }),
    enrolledAt: "2026-04-07T10:00:00.000Z",
    createdAt: "2026-04-07T10:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-07T10:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

describe("AssembleAuthoritativeSchedulingInputUseCase", () => {
  it("builds scheduling snapshots from claimed queue work, workspace roles, and node policy state", async () => {
    const runRepository = new InMemoryRunRepository();
    runRepository.runs.set("run:owner", createRunRecord());

    const useCase = new AssembleAuthoritativeSchedulingInputUseCase({
      selectAssignmentReadyRunsUseCase: {
        execute: async () => Object.freeze({
          asOf: "2026-04-07T12:01:00.000Z",
          items: Object.freeze([Object.freeze({
            run: Object.freeze({
              runId: "run:owner",
              workflowId: "workflow:demo",
              source: "api",
              state: "queued",
              assignmentStatus: "unassigned",
              executionOutcome: "none",
              submittedAt: "2026-04-07T12:00:00.000Z",
              updatedAt: "2026-04-07T12:00:00.000Z",
              submission: Object.freeze({
                submittedByActorId: "user:owner",
              }),
              assignment: Object.freeze({ status: "unassigned" }),
              execution: Object.freeze({ outcome: "none" }),
              retry: Object.freeze({ attempt: 1, maxAttempts: 1 }),
              contractVersion: "run-orchestration-transport/v1",
            }),
            queue: Object.freeze({
              queueId: "queue:default",
              enteredAt: "2026-04-07T12:00:00.000Z",
              eligibleAt: "2026-04-07T12:00:00.000Z",
              orderKey: "2026-04-07T12:00:00.000Z:run:owner",
              claimToken: "claim:run:owner",
              claimExpiresAt: "2026-04-07T12:01:30.000Z",
            }),
          })]),
        }),
      } as never,
      runRepository,
      nodeRepository: new RecordingNodeRepository(Object.freeze([
        createNode("node:compute:1"),
        createNode("node:hybrid:1", NodeTypes.hybrid),
      ])),
      roleAssignmentRepository: new RecordingRoleAssignmentRepository(),
      nodePolicyStatePort: {
        listNodePolicyState: async () => Object.freeze([Object.freeze({
          nodeId: "node:hybrid:1",
          usageMode: SchedulingNodeUsageModes.interactiveLocalSession,
          localInteractiveOwnerUserIdentityId: "user:desktop-owner",
          reservationOwner: "scheduler:alpha",
          hybridLocalUseProtection: Object.freeze({
            reservedLocalCapacityUnits: 1,
            activeRemoteAssignmentCount: 1,
          }),
        })]),
      },
    });

    const snapshot = await useCase.assemble({
      asOf: "2026-04-07T12:01:00.000Z",
      reservationOwner: "scheduler:alpha",
      limit: 3,
      nodeScope: Object.freeze(["node:hybrid:1"]),
    });

    expect(snapshot.queueLeases).toEqual(Object.freeze([Object.freeze({
      runId: "run:owner",
      queueId: "queue:default",
      enteredAt: "2026-04-07T12:00:00.000Z",
      eligibleAt: "2026-04-07T12:00:00.000Z",
      claimToken: "claim:run:owner",
      claimOwner: "scheduler:alpha",
      claimExpiresAt: "2026-04-07T12:01:30.000Z",
    })]));
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.runs[0]?.workspaceRoleKeys).toEqual(Object.freeze([WorkspaceAuthorizationRoleKeys.owner]));
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.nodeId).toBe("node:hybrid:1");
    expect(snapshot.nodes[0]?.usageMode).toBe("interactive-local-session");
    expect(snapshot.nodes[0]?.hybridLocalUseProtection?.reservedLocalCapacityUnits).toBe(1);
  });
});
