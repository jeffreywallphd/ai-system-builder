import { describe, expect, it } from "bun:test";
import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  createExecutionNodeRecord,
  recordExecutionNodeHealth,
  setExecutionNodeBackendFamilyCapabilities,
  transitionExecutionNodeActivationStatus,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import { ImageManipulationExecutionBackendHealthStates, type IImageManipulationExecutionCapabilityPort } from "@application/image-workflows/ports";
import type {
  ExecutionNodeListQuery,
  ExecutionNodeMutationResult,
  IExecutionNodeRepository,
  RegisterExecutionNodeInput,
  UpdateExecutionNodeAvailabilityInput,
  UpdateExecutionNodeCapabilitiesInput,
  UpdateExecutionNodeHealthInput,
} from "../ports/ExecutionNodeManagementPorts";
import {
  ExecutionNodeBackendRefreshClassifications,
  RefreshExecutionNodeBackendStateUseCase,
} from "../use-cases/RefreshExecutionNodeBackendStateUseCase";

class InMemoryExecutionNodeRepository implements IExecutionNodeRepository {
  private readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(_query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    return Object.freeze([...this.records.values()]);
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

  public async updateExecutionNodeHealth(input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult> {
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

  public async updateExecutionNodeCapabilities(input: UpdateExecutionNodeCapabilitiesInput): Promise<ExecutionNodeMutationResult> {
    const existing = this.records.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }
    const next = setExecutionNodeBackendFamilyCapabilities(
      existing,
      input.backendFamilyCapabilities,
      new Date(input.refreshedAt),
    );
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
    const transitioned = transitionExecutionNodeActivationStatus(existing, input.activationStatus, new Date(input.changedAt));
    const withHealth = input.healthStatus
      ? recordExecutionNodeHealth(transitioned, {
        healthStatus: input.healthStatus,
        observedAt: input.changedAt,
      })
      : transitioned;
    return this.saveExecutionNode({
      record: withHealth,
      mutation: input.mutation,
    });
  }

  public async updateExecutionNodeOperationalAvailability(input: {
    readonly nodeId: string;
    readonly mode: "enabled" | "disabled" | "suppressed";
    readonly suppressedUntil?: string;
    readonly changedAt: string;
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<ExecutionNodeMutationResult> {
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

class StaticCapabilityProbePort implements IImageManipulationExecutionCapabilityPort {
  public constructor(
    private readonly status: Awaited<ReturnType<IImageManipulationExecutionCapabilityPort["getExecutionBackendStatus"]>>,
  ) {}

  public async getExecutionBackendStatus(): Promise<Awaited<ReturnType<IImageManipulationExecutionCapabilityPort["getExecutionBackendStatus"]>>> {
    return this.status;
  }
}

function createExecutionNodeRecordFixture(input?: Partial<ExecutionNodeRecord>): ExecutionNodeRecord {
  return createExecutionNodeRecord({
    nodeId: input?.nodeId ?? "node-comfy-refresh-001",
    displayName: input?.displayName ?? "Comfy Refresh Node",
    nodeType: input?.nodeType ?? NodeTypes.compute,
    capabilityProfile: input?.capabilityProfile ?? createNodeCapabilityProfile({
      enabledCapabilities: [NodeRoleCapabilities.executor],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: input?.backendFamilyCapabilities ?? [{
      backendFamily: "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: ["image-to-image"],
      supportedTranslationContractVersions: ["1.0.0"],
    }],
    approvalStatus: input?.approvalStatus ?? NodeApprovalStatuses.approved,
    trustState: input?.trustState ?? NodeTrustStates.trusted,
    activationStatus: input?.activationStatus ?? ExecutionNodeActivationStatuses.active,
    healthStatus: input?.healthStatus ?? ExecutionNodeHealthStatuses.ready,
    deploymentTags: input?.deploymentTags ?? ["gpu"],
    endpoint: input?.endpoint ?? {
      endpointRef: "node://comfy-refresh-001",
    },
    certificateRef: input?.certificateRef ?? "cert:node-comfy-refresh-001:v1",
    lastSeenAt: input?.lastSeenAt ?? "2026-04-08T16:00:00.000Z",
    metadata: input?.metadata ?? {
      owner: "platform",
    },
    createdAt: input?.createdAt ?? "2026-04-08T15:00:00.000Z",
    updatedAt: input?.updatedAt ?? "2026-04-08T16:00:00.000Z",
  });
}

function createProbeStatus(input: {
  readonly checkedAt: string;
  readonly health: "healthy" | "degraded" | "unavailable";
  readonly readinessState?: "ready" | "degraded" | "unavailable" | "incompatible";
}) {
  return Object.freeze({
    backendFamily: "adapter.comfyui.image-manipulation",
    health: input.health,
    checkedAt: input.checkedAt,
    message: `probe:${input.health}`,
    capabilities: Object.freeze({
      backendFamily: "adapter.comfyui.image-manipulation",
      supportsProgressPolling: true,
      supportsProgressStreaming: false,
      supportsCancellation: true,
      supportsOutputDiscovery: true,
      supportedOperationKinds: Object.freeze(["image-to-image"]),
      supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
    }),
    diagnostics: Object.freeze({
      readinessState: input.readinessState ?? (input.health === "healthy" ? "ready" : input.health),
    }),
  });
}

describe("RefreshExecutionNodeBackendStateUseCase", () => {
  it("refreshes healthy backend probe results into ready node health and ready backend readiness", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createExecutionNodeRecordFixture(),
      mutation: {
        operationKey: "register-node-refresh-healthy",
        actorId: "system:test",
      },
    });

    const useCase = new RefreshExecutionNodeBackendStateUseCase({
      nodeRepository: repository,
      capabilityProbePort: new StaticCapabilityProbePort(createProbeStatus({
        checkedAt: "2026-04-08T16:10:00.000Z",
        health: ImageManipulationExecutionBackendHealthStates.healthy,
      })),
      clock: {
        now: () => new Date("2026-04-08T16:11:00.000Z"),
      },
      idGenerator: {
        nextId: () => "mutation-id",
      },
    });

    const refreshed = await useCase.execute({
      actorUserIdentityId: "system:probe",
      nodeId: "node-comfy-refresh-001",
      workspaceId: "workspace-alpha",
    });

    expect(refreshed.ok).toBeTrue();
    if (!refreshed.ok) {
      return;
    }

    expect(refreshed.value.classification).toBe(ExecutionNodeBackendRefreshClassifications.healthy);
    expect(refreshed.value.healthRefresh.record.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
    expect(refreshed.value.capabilityRefresh.record.backendFamilyCapabilities[0]?.executionReadiness?.state).toBe("ready");
  });

  it("refreshes degraded backend probe results into degraded node health and backend readiness", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createExecutionNodeRecordFixture(),
      mutation: {
        operationKey: "register-node-refresh-degraded",
        actorId: "system:test",
      },
    });

    const useCase = new RefreshExecutionNodeBackendStateUseCase({
      nodeRepository: repository,
      capabilityProbePort: new StaticCapabilityProbePort(createProbeStatus({
        checkedAt: "2026-04-08T16:12:00.000Z",
        health: ImageManipulationExecutionBackendHealthStates.degraded,
      })),
      clock: {
        now: () => new Date("2026-04-08T16:12:30.000Z"),
      },
      idGenerator: {
        nextId: () => "mutation-id",
      },
    });

    const refreshed = await useCase.execute({
      actorUserIdentityId: "system:probe",
      nodeId: "node-comfy-refresh-001",
      workspaceId: "workspace-alpha",
    });

    expect(refreshed.ok).toBeTrue();
    if (!refreshed.ok) {
      return;
    }

    expect(refreshed.value.classification).toBe(ExecutionNodeBackendRefreshClassifications.degraded);
    expect(refreshed.value.healthRefresh.record.healthStatus).toBe(ExecutionNodeHealthStatuses.degraded);
    expect(refreshed.value.capabilityRefresh.record.backendFamilyCapabilities[0]?.executionReadiness?.state).toBe("degraded");
  });

  it("refreshes unavailable backend probe results into unavailable node state and backend readiness", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createExecutionNodeRecordFixture(),
      mutation: {
        operationKey: "register-node-refresh-unavailable",
        actorId: "system:test",
      },
    });

    const useCase = new RefreshExecutionNodeBackendStateUseCase({
      nodeRepository: repository,
      capabilityProbePort: new StaticCapabilityProbePort(createProbeStatus({
        checkedAt: "2026-04-08T16:15:00.000Z",
        health: ImageManipulationExecutionBackendHealthStates.unavailable,
      })),
      clock: {
        now: () => new Date("2026-04-08T16:15:10.000Z"),
      },
      idGenerator: {
        nextId: () => "mutation-id",
      },
    });

    const refreshed = await useCase.execute({
      actorUserIdentityId: "system:probe",
      nodeId: "node-comfy-refresh-001",
      workspaceId: "workspace-alpha",
    });

    expect(refreshed.ok).toBeTrue();
    if (!refreshed.ok) {
      return;
    }

    expect(refreshed.value.classification).toBe(ExecutionNodeBackendRefreshClassifications.unavailable);
    expect(refreshed.value.healthRefresh.record.healthStatus).toBe(ExecutionNodeHealthStatuses.unavailable);
    expect(refreshed.value.healthRefresh.record.activationStatus).toBe(ExecutionNodeActivationStatuses.unavailable);
    expect(refreshed.value.capabilityRefresh.record.backendFamilyCapabilities[0]?.executionReadiness?.state).toBe("unavailable");
  });

  it("marks stale backend probe observations as unknown health/readiness for refresh eligibility", async () => {
    const repository = new InMemoryExecutionNodeRepository();
    await repository.registerExecutionNode({
      record: createExecutionNodeRecordFixture(),
      mutation: {
        operationKey: "register-node-refresh-stale",
        actorId: "system:test",
      },
    });

    const useCase = new RefreshExecutionNodeBackendStateUseCase({
      nodeRepository: repository,
      capabilityProbePort: new StaticCapabilityProbePort(createProbeStatus({
        checkedAt: "2026-04-08T15:00:00.000Z",
        health: ImageManipulationExecutionBackendHealthStates.healthy,
      })),
      clock: {
        now: () => new Date("2026-04-08T16:20:00.000Z"),
      },
      idGenerator: {
        nextId: () => "mutation-id",
      },
    });

    const refreshed = await useCase.execute({
      actorUserIdentityId: "system:probe",
      nodeId: "node-comfy-refresh-001",
      workspaceId: "workspace-alpha",
      maxStatusAgeMs: 120_000,
    });

    expect(refreshed.ok).toBeTrue();
    if (!refreshed.ok) {
      return;
    }

    expect(refreshed.value.classification).toBe(ExecutionNodeBackendRefreshClassifications.stale);
    expect(refreshed.value.healthRefresh.record.healthStatus).toBe(ExecutionNodeHealthStatuses.unknown);
    expect(refreshed.value.capabilityRefresh.record.backendFamilyCapabilities[0]?.executionReadiness?.state).toBe("unknown");
  });
});
