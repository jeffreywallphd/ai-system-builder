import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
  recordExecutionNodeHealth,
  transitionExecutionNodeActivationStatus,
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  type ExecutionNodeActivationStatus,
  type ExecutionNodeBackendFamilyCapability,
  type ExecutionNodeHealthStatus,
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
  UpdateExecutionNodeAvailabilityInput,
  UpdateExecutionNodeCapabilitiesInput,
  UpdateExecutionNodeHealthInput,
} from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import { ActivateExecutionNodeUseCase } from "../use-cases/ActivateExecutionNodeUseCase";
import { RegisterExecutionNodeUseCase } from "../use-cases/RegisterExecutionNodeUseCase";
import { ExecutionNodeManagementUseCaseErrorCodes } from "../use-cases/ExecutionNodeManagementUseCaseShared";

class InMemoryExecutionNodeRepository implements IExecutionNodeRepository {
  public readonly records = new Map<string, ExecutionNodeRecord>();

  async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  async listExecutionNodes(_query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return [...this.records.values()];
  }

  async registerExecutionNode(input: {
    readonly record: ExecutionNodeRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeMutationResult> {
    if (this.records.has(input.record.nodeId)) {
      throw new Error(`Execution node '${input.record.nodeId}' is already registered.`);
    }
    return this.saveExecutionNode(input);
  }

  async saveExecutionNode(input: {
    readonly record: ExecutionNodeRecord;
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeMutationResult> {
    const previous = this.records.get(input.record.nodeId);
    this.records.set(input.record.nodeId, input.record);

    return Object.freeze({
      changed: !previous || JSON.stringify(previous) !== JSON.stringify(input.record),
      wasReplay: false,
      record: input.record,
    });
  }

  async updateExecutionNodeHealth(input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const next = recordExecutionNodeHealth(existing, {
      healthStatus: input.healthStatus,
      observedAt: input.observedAt,
    });

    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }

  async updateExecutionNodeCapabilities(input: UpdateExecutionNodeCapabilitiesInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const next = createExecutionNodeRecord({
      ...existing,
      backendFamilyCapabilities: input.backendFamilyCapabilities,
      updatedAt: input.refreshedAt,
    });

    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }

  async updateExecutionNodeAvailability(input: UpdateExecutionNodeAvailabilityInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    let next = this.transitionToStatus(existing, input.activationStatus, input.changedAt);
    if (input.healthStatus) {
      next = recordExecutionNodeHealth(next, {
        healthStatus: input.healthStatus,
        observedAt: input.changedAt,
      });
    }

    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }

  private transitionToStatus(
    record: ExecutionNodeRecord,
    targetStatus: ExecutionNodeActivationStatus,
    changedAt: string,
  ): ExecutionNodeRecord {
    if (record.activationStatus === targetStatus) {
      return record;
    }

    let next = record;
    if (targetStatus === ExecutionNodeActivationStatuses.active) {
      if (next.activationStatus === ExecutionNodeActivationStatuses.inactive) {
        next = transitionExecutionNodeActivationStatus(next, ExecutionNodeActivationStatuses.pending, new Date(changedAt));
      }
      if (next.activationStatus === ExecutionNodeActivationStatuses.pending) {
        next = transitionExecutionNodeActivationStatus(next, ExecutionNodeActivationStatuses.approved, new Date(changedAt));
      }
    }

    return transitionExecutionNodeActivationStatus(next, targetStatus, new Date(changedAt));
  }
}

function createRegistrationRequest(input?: {
  readonly nodeId?: string;
  readonly displayName?: string;
  readonly endpointRef?: string;
  readonly backendFamilyCapabilities?: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly approvalStatus?: typeof NodeApprovalStatuses[keyof typeof NodeApprovalStatuses];
  readonly trustState?: typeof NodeTrustStates[keyof typeof NodeTrustStates];
  readonly activationStatus?: ExecutionNodeActivationStatus;
  readonly healthStatus?: ExecutionNodeHealthStatus;
  readonly certificateRef?: string;
}) {
  return {
    actorUserIdentityId: "admin:node-operator",
    nodeId: input?.nodeId ?? "node-comfy-001",
    displayName: input?.displayName ?? "Comfy Execution Node 001",
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 3,
    }),
    backendFamilyCapabilities: input?.backendFamilyCapabilities ?? [
      {
        backendFamily: "comfyui",
        supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      },
    ],
    endpointRef: input?.endpointRef ?? "node://comfy-001",
    approvalStatus: input?.approvalStatus,
    trustState: input?.trustState,
    activationStatus: input?.activationStatus,
    healthStatus: input?.healthStatus,
    certificateRef: input?.certificateRef,
  } as const;
}

function createDenyingAuthorizationHook(input: {
  readonly register?: boolean;
  readonly activate?: boolean;
}): ExecutionNodeManagementAuthorizationHook {
  return {
    async assertCanRegisterExecutionNode() {
      if (input.register) {
        throw new Error("admin role required to register execution nodes");
      }
    },
    async assertCanActivateExecutionNode() {
      if (input.activate) {
        throw new Error("admin role required to activate execution nodes");
      }
    },
  };
}

describe("execution node management application use-cases", () => {
  it("registers execution nodes durably and returns dto-ready summaries", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const useCase = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });

    const result = await useCase.execute(createRegistrationRequest());
    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.nodeId).toBe("node-comfy-001");
    expect(result.value.node.backendFamilies).toEqual(["comfyui"]);
    expect(result.value.node.endpointRef).toBe("node://comfy-001");
    expect(repository.records.has("node-comfy-001")).toBeTrue();
  });

  it("rejects duplicate execution node registration", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const useCase = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });

    const first = await useCase.execute(createRegistrationRequest());
    expect(first.ok).toBeTrue();

    const duplicate = await useCase.execute(createRegistrationRequest());
    expect(duplicate.ok).toBeFalse();
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.conflict);
      expect(duplicate.error.message).toContain("already registered");
    }
  });

  it("rejects invalid registration payloads", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const useCase = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });

    const invalid = await useCase.execute({
      ...createRegistrationRequest({
        backendFamilyCapabilities: [],
      }),
      endpointRef: "",
    });

    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.invalidRequest);
    }
  });

  it("activates approved and trusted execution nodes", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const register = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });
    const activate = new ActivateExecutionNodeUseCase({
      nodeRepository: repository,
    });

    await register.execute(createRegistrationRequest({
      nodeId: "node-activation-1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      activationStatus: ExecutionNodeActivationStatuses.approved,
      healthStatus: ExecutionNodeHealthStatuses.unknown,
      certificateRef: "cert:node-activation-1:v1",
    }));

    const activated = await activate.execute({
      actorUserIdentityId: "admin:node-operator",
      nodeId: "node-activation-1",
      activatedAt: "2026-04-08T15:10:00.000Z",
    });

    expect(activated.ok).toBeTrue();
    if (!activated.ok) {
      return;
    }

    expect(activated.value.node.health.activationStatus).toBe(ExecutionNodeActivationStatuses.active);
    expect(activated.value.node.health.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
    const stored = await repository.findExecutionNodeById("node-activation-1");
    expect(stored?.activationStatus).toBe(ExecutionNodeActivationStatuses.active);
  });

  it("rejects activation when trust posture is not eligible", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const register = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });
    const activate = new ActivateExecutionNodeUseCase({
      nodeRepository: repository,
    });

    await register.execute(createRegistrationRequest({
      nodeId: "node-activation-rejected-1",
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingApproval,
      activationStatus: ExecutionNodeActivationStatuses.pending,
    }));

    const activated = await activate.execute({
      actorUserIdentityId: "admin:node-operator",
      nodeId: "node-activation-rejected-1",
    });

    expect(activated.ok).toBeFalse();
    if (!activated.ok) {
      expect(activated.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.invalidState);
      expect(activated.error.message).toContain("approved");
    }
  });

  it("supports authorization extension hooks for registration and activation", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    const registerDeniedUseCase = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ register: true }),
    });

    const deniedRegistration = await registerDeniedUseCase.execute(createRegistrationRequest({
      nodeId: "node-register-denied-1",
    }));
    expect(deniedRegistration.ok).toBeFalse();
    if (!deniedRegistration.ok) {
      expect(deniedRegistration.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.forbidden);
    }

    const registerAllowedUseCase = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });
    await registerAllowedUseCase.execute(createRegistrationRequest({
      nodeId: "node-activate-denied-1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      activationStatus: ExecutionNodeActivationStatuses.approved,
      certificateRef: "cert:node-activate-denied-1:v1",
    }));

    const activateDeniedUseCase = new ActivateExecutionNodeUseCase({
      nodeRepository: repository,
      authorizationHook: createDenyingAuthorizationHook({ activate: true }),
    });
    const deniedActivation = await activateDeniedUseCase.execute({
      actorUserIdentityId: "member:viewer",
      nodeId: "node-activate-denied-1",
    });

    expect(deniedActivation.ok).toBeFalse();
    if (!deniedActivation.ok) {
      expect(deniedActivation.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.forbidden);
    }
  });
});
