import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
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
import { GetExecutionNodeDetailUseCase } from "../use-cases/GetExecutionNodeDetailUseCase";
import { ListExecutionNodesUseCase } from "../use-cases/ListExecutionNodesUseCase";
import { ExecutionNodeManagementUseCaseErrorCodes } from "../use-cases/ExecutionNodeManagementUseCaseShared";

class InMemoryExecutionNodeRepository implements IExecutionNodeRepository {
  public readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return Object.freeze([...this.records.values()].filter((record) => {
      if (query.nodeIds && query.nodeIds.length > 0 && !query.nodeIds.includes(record.nodeId)) {
        return false;
      }
      if (query.activationStatuses && query.activationStatuses.length > 0 && !query.activationStatuses.includes(record.activationStatus)) {
        return false;
      }
      if (query.healthStatuses && query.healthStatuses.length > 0 && !query.healthStatuses.includes(record.healthStatus)) {
        return false;
      }
      if (query.approvalStatuses && query.approvalStatuses.length > 0 && !query.approvalStatuses.includes(record.approvalStatus)) {
        return false;
      }
      if (query.trustStates && query.trustStates.length > 0 && !query.trustStates.includes(record.trustState)) {
        return false;
      }
      if (
        query.requiredCapabilitiesAnyOf
        && query.requiredCapabilitiesAnyOf.length > 0
        && !query.requiredCapabilitiesAnyOf.some((capability) => record.capabilityProfile.enabledCapabilities.includes(capability))
      ) {
        return false;
      }
      if (typeof query.supportsRemoteScheduling === "boolean" && query.supportsRemoteScheduling !== record.capabilityProfile.supportsRemoteScheduling) {
        return false;
      }
      if (query.requireCertificateRef === true && !record.certificateRef) {
        return false;
      }
      if (query.requireCertificateRef === false && !!record.certificateRef) {
        return false;
      }
      if (query.deploymentTagAnyOf && query.deploymentTagAnyOf.length > 0) {
        const tags = new Set(record.deploymentTags.map((tag) => tag.trim().toLowerCase()));
        const hasAny = query.deploymentTagAnyOf.some((tag) => tags.has(tag.trim().toLowerCase()));
        if (!hasAny) {
          return false;
        }
      }
      if (!query.includeRevoked && (record.activationStatus === ExecutionNodeActivationStatuses.revoked || record.trustState === NodeTrustStates.revoked)) {
        return false;
      }
      if (query.lastSeenAfter && (!record.lastSeenAt || Date.parse(record.lastSeenAt) < Date.parse(query.lastSeenAfter))) {
        return false;
      }
      if (query.lastSeenBefore && (!record.lastSeenAt || Date.parse(record.lastSeenAt) > Date.parse(query.lastSeenBefore))) {
        return false;
      }
      if (query.backendFamilies && query.backendFamilies.length > 0 && !record.backendFamilyCapabilities.some((entry) => query.backendFamilies?.includes(entry.backendFamily))) {
        return false;
      }
      if (query.executionTargets && query.executionTargets.length > 0 && !record.backendFamilyCapabilities.some((entry) => (
        entry.supportedExecutionTargets.some((target) => query.executionTargets?.includes(target))
      ))) {
        return false;
      }
      return true;
    }));
  }

  public async registerExecutionNode(input: {
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
    return this.saveExecutionNode(input);
  }

  public async saveExecutionNode(input: {
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

  public async updateExecutionNodeHealth(input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }
    const next = createExecutionNodeRecord({
      ...existing,
      healthStatus: input.healthStatus,
      lastSeenAt: input.observedAt,
      updatedAt: input.observedAt,
    });
    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }

  public async updateExecutionNodeCapabilities(input: UpdateExecutionNodeCapabilitiesInput): Promise<ExecutionNodeMutationResult> {
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

  public async updateExecutionNodeAvailability(input: UpdateExecutionNodeAvailabilityInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }
    const next = createExecutionNodeRecord({
      ...existing,
      activationStatus: input.activationStatus,
      healthStatus: input.healthStatus ?? existing.healthStatus,
      updatedAt: input.changedAt,
      lastSeenAt: input.changedAt,
    });
    return this.saveExecutionNode({
      record: next,
      mutation: input.mutation,
    });
  }
}

function createNode(input: {
  readonly nodeId: string;
  readonly activationStatus: ExecutionNodeActivationStatus;
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly backendFamily: string;
  readonly backendReadiness: "ready" | "degraded" | "unavailable" | "unknown";
  readonly lastSeenAt: string;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly approvalStatus?: typeof NodeApprovalStatuses[keyof typeof NodeApprovalStatuses];
  readonly trustState?: typeof NodeTrustStates[keyof typeof NodeTrustStates];
}): ExecutionNodeRecord {
  const backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability> = Object.freeze([{
    backendFamily: input.backendFamily,
    supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
    supportedOperationKinds: ["image-to-image"],
    executionReadiness: {
      state: input.backendReadiness,
      checkedAt: input.lastSeenAt,
    },
  }]);

  return createExecutionNodeRecord({
    nodeId: input.nodeId,
    displayName: `Execution ${input.nodeId}`,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.storageAccess],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities,
    approvalStatus: input.approvalStatus ?? NodeApprovalStatuses.approved,
    trustState: input.trustState ?? NodeTrustStates.trusted,
    activationStatus: input.activationStatus,
    healthStatus: input.healthStatus,
    deploymentTags: input.deploymentTags ?? ["region-east"],
    endpoint: {
      endpointRef: `node://${input.nodeId}`,
    },
    certificateRef: `cert:${input.nodeId}:v1`,
    lastSeenAt: input.lastSeenAt,
    metadata: {
      owner: "platform",
    },
    createdAt: "2026-04-08T15:00:00.000Z",
    updatedAt: input.lastSeenAt,
  });
}

function createAuthorizationHook(input: {
  readonly denyList?: boolean;
  readonly denyDetail?: boolean;
}): ExecutionNodeManagementAuthorizationHook {
  return {
    async assertCanQueryExecutionNodes() {
      if (input.denyList) {
        throw new Error("execution-node read requires admin role");
      }
    },
    async assertCanGetExecutionNodeDetail() {
      if (input.denyDetail) {
        throw new Error("execution-node detail requires admin role");
      }
    },
  };
}

describe("execution node query/list use cases", () => {
  it("returns execution-node detail for authorized callers", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-detail-1",
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendFamily: "comfyui",
        backendReadiness: "ready",
        lastSeenAt: "2026-04-08T16:00:00.000Z",
      }),
      mutation: {
        operationKey: "seed-node-detail-1",
        actorId: "system:test",
      },
    });

    const useCase = new GetExecutionNodeDetailUseCase({
      nodeRepository: repository,
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin:operations",
      nodeId: "node-detail-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.node.nodeId).toBe("node-detail-1");
    expect(result.value.node.backendCapabilities[0]?.backendFamily).toBe("comfyui");
    expect(result.value.node.health.activationStatus).toBe(ExecutionNodeActivationStatuses.active);
  });

  it("applies list filters for backend, capability, activity, enabled state, and availability", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-ready",
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendFamily: "comfyui",
        backendReadiness: "ready",
        lastSeenAt: "2026-04-08T16:10:00.000Z",
      }),
      mutation: { operationKey: "seed-node-ready", actorId: "system:test" },
    });
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-disabled",
        activationStatus: ExecutionNodeActivationStatuses.approved,
        healthStatus: ExecutionNodeHealthStatuses.unknown,
        backendFamily: "comfyui",
        backendReadiness: "unknown",
        lastSeenAt: "2026-04-08T15:00:00.000Z",
      }),
      mutation: { operationKey: "seed-node-disabled", actorId: "system:test" },
    });
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-degraded",
        activationStatus: ExecutionNodeActivationStatuses.degraded,
        healthStatus: ExecutionNodeHealthStatuses.degraded,
        backendFamily: "comfyui",
        backendReadiness: "degraded",
        lastSeenAt: "2026-04-08T16:09:00.000Z",
      }),
      mutation: { operationKey: "seed-node-degraded", actorId: "system:test" },
    });

    const useCase = new ListExecutionNodesUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T16:12:00.000Z"),
      },
    });

    const available = await useCase.execute({
      actorUserIdentityId: "admin:operations",
      backendFamilies: ["comfyui"],
      requiredCapabilitiesAnyOf: [NodeRoleCapabilities.executor],
      lastSeenAfter: "2026-04-08T16:05:00.000Z",
      enabled: true,
      available: true,
    });

    expect(available.ok).toBeTrue();
    if (!available.ok) {
      return;
    }
    expect(available.value.nodes.map((node) => node.nodeId)).toEqual(["node-ready", "node-degraded"]);

    const disabled = await useCase.execute({
      actorUserIdentityId: "admin:operations",
      enabled: false,
    });
    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      return;
    }
    expect(disabled.value.nodes.map((node) => node.nodeId)).toContain("node-disabled");
    expect(disabled.value.nodes.map((node) => node.nodeId)).not.toContain("node-ready");
  });

  it("filters by backend readiness state and supports paging metadata", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-ready-1",
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendFamily: "comfyui",
        backendReadiness: "ready",
        lastSeenAt: "2026-04-08T16:10:00.000Z",
      }),
      mutation: { operationKey: "seed-node-ready-1", actorId: "system:test" },
    });
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-ready-2",
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendFamily: "comfyui",
        backendReadiness: "ready",
        lastSeenAt: "2026-04-08T16:11:00.000Z",
      }),
      mutation: { operationKey: "seed-node-ready-2", actorId: "system:test" },
    });
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-unavailable-1",
        activationStatus: ExecutionNodeActivationStatuses.unavailable,
        healthStatus: ExecutionNodeHealthStatuses.unavailable,
        backendFamily: "comfyui",
        backendReadiness: "unavailable",
        lastSeenAt: "2026-04-08T16:09:00.000Z",
      }),
      mutation: { operationKey: "seed-node-unavailable-1", actorId: "system:test" },
    });

    const useCase = new ListExecutionNodesUseCase({
      nodeRepository: repository,
      clock: {
        now: () => new Date("2026-04-08T16:12:30.000Z"),
      },
    });

    const result = await useCase.execute({
      actorUserIdentityId: "admin:operations",
      backendReadinessStates: ["ready"],
      limit: 1,
      offset: 0,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.totalCount).toBe(2);
    expect(result.value.nodes).toHaveLength(1);
    expect(result.value.nodes[0]?.nodeId).toBe("node-ready-2");
  });

  it("enforces authorization and returns typed forbidden outcomes for query surfaces", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createNode({
        nodeId: "node-auth-1",
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        backendFamily: "comfyui",
        backendReadiness: "ready",
        lastSeenAt: "2026-04-08T16:10:00.000Z",
      }),
      mutation: { operationKey: "seed-node-auth-1", actorId: "system:test" },
    });

    const listUseCase = new ListExecutionNodesUseCase({
      nodeRepository: repository,
      authorizationHook: createAuthorizationHook({ denyList: true }),
    });

    const listDenied = await listUseCase.execute({
      actorUserIdentityId: "member:viewer",
    });
    expect(listDenied.ok).toBeFalse();
    if (!listDenied.ok) {
      expect(listDenied.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.forbidden);
    }

    const detailUseCase = new GetExecutionNodeDetailUseCase({
      nodeRepository: repository,
      authorizationHook: createAuthorizationHook({ denyDetail: true }),
    });
    const detailDenied = await detailUseCase.execute({
      actorUserIdentityId: "member:viewer",
      nodeId: "node-auth-1",
    });
    expect(detailDenied.ok).toBeFalse();
    if (!detailDenied.ok) {
      expect(detailDenied.error.code).toBe(ExecutionNodeManagementUseCaseErrorCodes.forbidden);
    }
  });
});
