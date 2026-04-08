import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
  evaluateImageExecutionNodeEligibility,
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  ExecutionNodeOperationalAvailabilityModes,
  ExecutionNodeTargetKinds,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import type {
  ExecutionNodeListQuery,
  ExecutionNodeMutationResult,
  IExecutionNodeRepository,
  RegisterExecutionNodeInput,
  UpdateExecutionNodeAvailabilityInput,
  UpdateExecutionNodeCapabilitiesInput,
  UpdateExecutionNodeHealthInput,
  UpdateExecutionNodeOperationalAvailabilityInput,
} from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import { ListExecutionNodesUseCase } from "../use-cases/ListExecutionNodesUseCase";
import {
  ExecutionNodeAvailabilityOverrideActions,
  SetExecutionNodeAvailabilityOverrideUseCase,
} from "../use-cases/SetExecutionNodeAvailabilityOverrideUseCase";
import { ExecutionNodeManagementUseCaseErrorCodes } from "../use-cases/ExecutionNodeManagementUseCaseShared";

class InMemoryExecutionNodeRepository implements IExecutionNodeRepository {
  private readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return Object.freeze([...this.records.values()].filter((record) => {
      if (
        query.operationalAvailabilityModes
        && query.operationalAvailabilityModes.length > 0
        && !query.operationalAvailabilityModes.includes(record.availabilityOverride.mode)
      ) {
        return false;
      }

      return true;
    }));
  }

  public async registerExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult> {
    return this.saveExecutionNode(input);
  }

  public async saveExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult> {
    const previous = this.records.get(input.record.nodeId);
    this.records.set(input.record.nodeId, input.record);
    return Object.freeze({
      changed: !previous || JSON.stringify(previous) !== JSON.stringify(input.record),
      wasReplay: false,
      record: input.record,
    });
  }

  public async updateExecutionNodeHealth(_input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult> {
    throw new Error("Not implemented in test adapter.");
  }

  public async updateExecutionNodeCapabilities(
    _input: UpdateExecutionNodeCapabilitiesInput,
  ): Promise<ExecutionNodeMutationResult> {
    throw new Error("Not implemented in test adapter.");
  }

  public async updateExecutionNodeAvailability(
    _input: UpdateExecutionNodeAvailabilityInput,
  ): Promise<ExecutionNodeMutationResult> {
    throw new Error("Not implemented in test adapter.");
  }

  public async updateExecutionNodeOperationalAvailability(
    input: UpdateExecutionNodeOperationalAvailabilityInput,
  ): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const next = createExecutionNodeRecord({
      ...existing,
      availabilityOverride: {
        mode: input.mode,
        suppressedUntil: input.suppressedUntil,
        reason: input.mutation.reason,
        updatedAt: input.changedAt,
      },
      updatedAt: input.changedAt,
    });

    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }
}

function createNode(nodeId: string): ExecutionNodeRecord {
  return createExecutionNodeRecord({
    nodeId,
    displayName: `Node ${nodeId}`,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 2,
    }),
    backendFamilyCapabilities: [{
      backendFamily: "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
    }],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: ExecutionNodeActivationStatuses.active,
    healthStatus: ExecutionNodeHealthStatuses.ready,
    endpoint: {
      endpointRef: `node://${nodeId}`,
    },
    certificateRef: `cert:${nodeId}:v1`,
    createdAt: "2026-04-08T15:00:00.000Z",
    updatedAt: "2026-04-08T15:00:00.000Z",
    lastSeenAt: "2026-04-08T15:00:00.000Z",
  });
}

function createAuthorizationHook(deny = false): ExecutionNodeManagementAuthorizationHook {
  return {
    async assertCanOverrideExecutionNodeAvailability() {
      if (deny) {
        throw new Error("admin role required to change execution-node availability.");
      }
    },
  };
}

describe("SetExecutionNodeAvailabilityOverrideUseCase", () => {
  it("supports disable, enable, and temporary suppress availability overrides", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode("node-override-1"),
      mutation: { operationKey: "seed:1", actorId: "system:test" },
    });

    const useCase = new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T16:00:00.000Z"),
      },
      idGenerator: {
        nextId: () => "override-mutation-id",
      },
    });

    const disabled = await useCase.execute({
      actorUserIdentityId: "admin:ops",
      nodeId: "node-override-1",
      action: ExecutionNodeAvailabilityOverrideActions.disable,
      reason: "maintenance blackout",
    });
    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      return;
    }
    expect(disabled.value.node.operational.availabilityOverrideMode).toBe(ExecutionNodeOperationalAvailabilityModes.disabled);

    const suppressed = await useCase.execute({
      actorUserIdentityId: "admin:ops",
      nodeId: "node-override-1",
      action: ExecutionNodeAvailabilityOverrideActions.suppress,
      changedAt: "2026-04-08T16:05:00.000Z",
      suppressedUntil: "2026-04-08T17:00:00.000Z",
      reason: "temporary capacity hold",
    });
    expect(suppressed.ok).toBeTrue();
    if (!suppressed.ok) {
      return;
    }
    expect(suppressed.value.node.operational.availabilityOverrideMode).toBe(ExecutionNodeOperationalAvailabilityModes.suppressed);
    expect(suppressed.value.node.operational.availabilitySuppressedUntil).toBe("2026-04-08T17:00:00.000Z");

    const enabled = await useCase.execute({
      actorUserIdentityId: "admin:ops",
      nodeId: "node-override-1",
      action: ExecutionNodeAvailabilityOverrideActions.enable,
      changedAt: "2026-04-08T17:01:00.000Z",
    });
    expect(enabled.ok).toBeTrue();
    if (!enabled.ok) {
      return;
    }
    expect(enabled.value.node.operational.availabilityOverrideMode).toBe(ExecutionNodeOperationalAvailabilityModes.enabled);
    expect(enabled.value.node.operational.availabilitySuppressedUntil).toBeUndefined();
  });

  it("requires suppressedUntil for suppress action and enforces authorization", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode("node-override-2"),
      mutation: { operationKey: "seed:2", actorId: "system:test" },
    });

    const invalidUseCase = new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: repository,
    });
    const invalid = await invalidUseCase.execute({
      actorUserIdentityId: "admin:ops",
      nodeId: "node-override-2",
      action: ExecutionNodeAvailabilityOverrideActions.suppress,
    });
    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.invalidRequest);
    }

    const forbiddenUseCase = new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: repository,
      authorizationHook: createAuthorizationHook(true),
    });
    const forbidden = await forbiddenUseCase.execute({
      actorUserIdentityId: "member:viewer",
      nodeId: "node-override-2",
      action: ExecutionNodeAvailabilityOverrideActions.disable,
    });
    expect(forbidden.ok).toBeFalse();
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.forbidden);
    }
  });

  it("makes availability filtering and eligibility checks honor operational overrides", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode("node-override-3"),
      mutation: { operationKey: "seed:3", actorId: "system:test" },
    });

    const overrideUseCase = new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T16:00:00.000Z"),
      },
      idGenerator: {
        nextId: () => "override-mutation-id",
      },
    });

    await overrideUseCase.execute({
      actorUserIdentityId: "admin:ops",
      nodeId: "node-override-3",
      action: ExecutionNodeAvailabilityOverrideActions.disable,
      reason: "manual policy gate",
    });

    const listUseCase = new ListExecutionNodesUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T16:05:00.000Z"),
      },
    });

    const available = await listUseCase.execute({
      actorUserIdentityId: "admin:ops",
      available: true,
    });
    expect(available.ok).toBeTrue();
    if (!available.ok) {
      return;
    }
    expect(available.value.nodes.map((node) => node.nodeId)).not.toContain("node-override-3");

    const disabled = await listUseCase.execute({
      actorUserIdentityId: "admin:ops",
      operationalAvailabilityModes: [ExecutionNodeOperationalAvailabilityModes.disabled],
    });
    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      return;
    }
    expect(disabled.value.nodes.map((node) => node.nodeId)).toEqual(["node-override-3"]);

    const stored = await repository.findExecutionNodeById("node-override-3");
    expect(stored).toBeDefined();
    if (!stored) {
      return;
    }

    const eligibility = evaluateImageExecutionNodeEligibility(stored, {
      requiredExecutionTarget: ExecutionNodeTargetKinds.imageManipulation,
      now: "2026-04-08T16:05:00.000Z",
    });
    expect(eligibility.isEligible).toBeFalse();
    expect(eligibility.reasons).toContain("node-disabled-by-policy");
  });
});

