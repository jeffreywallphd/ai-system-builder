import { describe, expect, it } from "bun:test";
import {
  createExecutionNodeRecord,
  evaluateImageExecutionNodeCompatibility,
  recordExecutionNodeHealth,
  setExecutionNodeBackendFamilyCapabilities,
  transitionExecutionNodeActivationStatus,
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
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
import {
  ExecutionNodeEligibilityDecisionKinds,
  type ExecutionNodeAvailabilityChangeResult,
  type ExecutionNodeCapabilityRefreshResult,
  type ExecutionNodeEligibilityEvaluation,
  type ExecutionNodeHealthRefreshResult,
  type ExecutionNodeListQuery,
  type ExecutionNodeMutationResult,
  type ExecutionNodeSelectionHint,
  type IExecutionNodeAvailabilityManagementServicePort,
  type IExecutionNodeCapabilityRefreshServicePort,
  type IExecutionNodeEligibilityEvaluationServicePort,
  type IExecutionNodeHealthRefreshServicePort,
  type IExecutionNodeRepository,
  type IExecutionNodeSelectionHintsServicePort,
  type ExecutionNodeManagementServicePorts,
} from "../ports/ExecutionNodeManagementPorts";

function createSampleExecutionNode(input?: Partial<ExecutionNodeRecord>): ExecutionNodeRecord {
  return createExecutionNodeRecord({
    nodeId: input?.nodeId ?? "node-compute-001",
    displayName: input?.displayName ?? "Compute Node 001",
    nodeType: input?.nodeType ?? NodeTypes.compute,
    capabilityProfile: input?.capabilityProfile ?? createNodeCapabilityProfile({
      enabledCapabilities: [
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.storageAccess,
      ],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: input?.backendFamilyCapabilities ?? [
      {
        backendFamily: "comfyui",
        supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      },
    ],
    approvalStatus: input?.approvalStatus ?? NodeApprovalStatuses.approved,
    trustState: input?.trustState ?? NodeTrustStates.trusted,
    activationStatus: input?.activationStatus ?? ExecutionNodeActivationStatuses.active,
    healthStatus: input?.healthStatus ?? ExecutionNodeHealthStatuses.ready,
    deploymentTags: input?.deploymentTags ?? ["region-east"],
    endpoint: input?.endpoint ?? {
      endpointRef: "node://compute-001",
    },
    certificateRef: input?.certificateRef ?? "cert:node-compute-001:v1",
    lastSeenAt: input?.lastSeenAt ?? "2026-04-08T14:00:00.000Z",
    metadata: input?.metadata ?? {
      owner: "platform",
    },
    createdAt: input?.createdAt ?? "2026-04-08T14:00:00.000Z",
    updatedAt: input?.updatedAt ?? "2026-04-08T14:00:00.000Z",
  });
}

class InMemoryExecutionNodeManagementAdapter
  implements
    IExecutionNodeRepository,
    IExecutionNodeHealthRefreshServicePort,
    IExecutionNodeCapabilityRefreshServicePort,
    IExecutionNodeEligibilityEvaluationServicePort,
    IExecutionNodeAvailabilityManagementServicePort,
    IExecutionNodeSelectionHintsServicePort {
  private readonly recordsByNodeId = new Map<string, ExecutionNodeRecord>();
  private readonly mutationReplayByOperationKey = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.recordsByNodeId.get(nodeId);
  }

  public async listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    const records = [...this.recordsByNodeId.values()].filter((record) => {
      if (query.nodeIds && query.nodeIds.length > 0 && !query.nodeIds.includes(record.nodeId)) {
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
      if (
        query.deploymentTagAnyOf
        && query.deploymentTagAnyOf.length > 0
        && !query.deploymentTagAnyOf.some((tag) => record.deploymentTags.includes(tag.trim().toLowerCase()))
      ) {
        return false;
      }
      if (!query.includeRevoked && (record.activationStatus === ExecutionNodeActivationStatuses.revoked || record.trustState === NodeTrustStates.revoked)) {
        return false;
      }
      if (query.lastSeenAfter) {
        if (!record.lastSeenAt || Date.parse(record.lastSeenAt) < Date.parse(query.lastSeenAfter)) {
          return false;
        }
      }
      if (query.lastSeenBefore) {
        if (!record.lastSeenAt || Date.parse(record.lastSeenAt) > Date.parse(query.lastSeenBefore)) {
          return false;
        }
      }
      return true;
    });

    const offset = query.offset && query.offset > 0 ? query.offset : 0;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    const paged = offset > 0 ? records.slice(offset) : records;
    return limit ? paged.slice(0, limit) : paged;
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
    const operationKey = input.mutation.operationKey.trim().toLowerCase();
    const replay = this.mutationReplayByOperationKey.get(operationKey);
    if (replay) {
      return Object.freeze({
        changed: false,
        wasReplay: true,
        record: replay,
      });
    }

    const previous = this.recordsByNodeId.get(input.record.nodeId);
    this.recordsByNodeId.set(input.record.nodeId, input.record);
    this.mutationReplayByOperationKey.set(operationKey, input.record);

    return Object.freeze({
      changed: !previous || JSON.stringify(previous) !== JSON.stringify(input.record),
      wasReplay: false,
      record: input.record,
    });
  }

  public async updateExecutionNodeHealth(input: {
    readonly nodeId: string;
    readonly healthStatus: "unknown" | "ready" | "degraded" | "unavailable";
    readonly observedAt: string;
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeMutationResult> {
    const existing = this.recordsByNodeId.get(input.nodeId);
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

  public async updateExecutionNodeCapabilities(input: {
    readonly nodeId: string;
    readonly backendFamilyCapabilities: readonly {
      readonly backendFamily: string;
      readonly supportedExecutionTargets: readonly (string | "image-manipulation")[];
      readonly supportedOperationKinds?: readonly string[];
      readonly supportedOperationCapabilities?: readonly string[];
      readonly supportedInputKinds?: readonly string[];
      readonly supportedOutputKinds?: readonly string[];
      readonly supportedTranslationContractVersions?: readonly string[];
      readonly resourceClassHints?: readonly string[];
      readonly executionReadiness?: {
        readonly state: "unknown" | "ready" | "degraded" | "unavailable";
        readonly checkedAt?: string;
        readonly summary?: string;
      };
      readonly capabilityProfileVersion?: string;
      readonly metadataTags?: readonly string[];
    }[];
    readonly refreshedAt: string;
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeMutationResult> {
    const existing = this.recordsByNodeId.get(input.nodeId);
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

  public async updateExecutionNodeAvailability(input: {
    readonly nodeId: string;
    readonly activationStatus: "pending" | "inactive" | "approved" | "active" | "degraded" | "unavailable" | "revoked";
    readonly healthStatus?: "unknown" | "ready" | "degraded" | "unavailable";
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
    const existing = this.recordsByNodeId.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const transitioned = transitionExecutionNodeActivationStatus(
      existing,
      input.activationStatus,
      new Date(input.changedAt),
    );

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

  public async refreshExecutionNodeHealth(input: {
    readonly nodeId: string;
    readonly observation: {
      readonly healthStatus: "unknown" | "ready" | "degraded" | "unavailable";
      readonly observedAt: string;
      readonly summary?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeHealthRefreshResult> {
    const saved = await this.updateExecutionNodeHealth({
      nodeId: input.nodeId,
      healthStatus: input.observation.healthStatus,
      observedAt: input.observation.observedAt,
      mutation: input.mutation,
    });

    return Object.freeze({
      nodeId: input.nodeId,
      changed: saved.changed,
      record: saved.record,
      observation: input.observation,
    });
  }

  public async refreshExecutionNodeCapabilities(input: {
    readonly nodeId: string;
    readonly observation: {
      readonly backendFamilyCapabilities: readonly {
        readonly backendFamily: string;
        readonly supportedExecutionTargets: readonly (string | "image-manipulation")[];
        readonly supportedOperationKinds?: readonly string[];
        readonly supportedOperationCapabilities?: readonly string[];
        readonly supportedInputKinds?: readonly string[];
        readonly supportedOutputKinds?: readonly string[];
        readonly supportedTranslationContractVersions?: readonly string[];
        readonly resourceClassHints?: readonly string[];
        readonly executionReadiness?: {
          readonly state: "unknown" | "ready" | "degraded" | "unavailable";
          readonly checkedAt?: string;
          readonly summary?: string;
        };
        readonly capabilityProfileVersion?: string;
        readonly metadataTags?: readonly string[];
      }[];
      readonly observedAt: string;
      readonly summary?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };
    readonly mutation: {
      readonly operationKey: string;
      readonly actorId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
    };
  }): Promise<ExecutionNodeCapabilityRefreshResult> {
    const saved = await this.updateExecutionNodeCapabilities({
      nodeId: input.nodeId,
      backendFamilyCapabilities: input.observation.backendFamilyCapabilities,
      refreshedAt: input.observation.observedAt,
      mutation: input.mutation,
    });

    return Object.freeze({
      nodeId: input.nodeId,
      changed: saved.changed,
      record: saved.record,
      observation: input.observation,
    });
  }

  public async evaluateExecutionNodeEligibility(input: {
    readonly asOf: string;
    readonly requirements?: {
      readonly requiredBackendFamilies?: readonly string[];
      readonly requiredExecutionTarget?: string;
      readonly requiredNodeCapabilities?: readonly ("ui" | "api" | "scheduler" | "executor" | "storage-access" | "preview-worker")[];
      readonly requiresRemoteScheduling?: boolean;
      readonly requiredOperationKind?: string;
      readonly requiredOperationCapability?: string;
      readonly requiredInputKinds?: readonly string[];
      readonly requiredOutputKinds?: readonly string[];
      readonly requiredTranslationContractVersion?: string;
      readonly preferredResourceClassHints?: readonly string[];
      readonly allowDegraded?: boolean;
      readonly maxLastSeenAgeMs?: number;
      readonly now?: string | Date;
    };
    readonly candidateNodeIds?: readonly string[];
    readonly query?: ExecutionNodeListQuery;
  }): Promise<readonly ExecutionNodeEligibilityEvaluation[]> {
    const candidates = await this.resolveCandidates({
      query: input.query,
      candidateNodeIds: input.candidateNodeIds,
    });

    return Object.freeze(candidates.map((candidate) => {
      const compatibility = evaluateImageExecutionNodeCompatibility(candidate, {
        ...input.requirements,
        now: input.requirements?.now ?? input.asOf,
      });
      const decision = compatibility.routable
        ? ExecutionNodeEligibilityDecisionKinds.eligible
        : compatibility.compatible
          ? ExecutionNodeEligibilityDecisionKinds.unavailable
          : ExecutionNodeEligibilityDecisionKinds.incompatible;

      return Object.freeze({
        nodeId: candidate.nodeId,
        decision,
        compatibility,
      });
    }));
  }

  public async setExecutionNodeAvailability(input: {
    readonly nodeId: string;
    readonly activationStatus: "pending" | "inactive" | "approved" | "active" | "degraded" | "unavailable" | "revoked";
    readonly healthStatus?: "unknown" | "ready" | "degraded" | "unavailable";
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
  }): Promise<ExecutionNodeAvailabilityChangeResult> {
    const existing = this.recordsByNodeId.get(input.nodeId);
    if (!existing) {
      throw new Error(`Execution node '${input.nodeId}' was not found.`);
    }

    const saved = await this.updateExecutionNodeAvailability(input);

    return Object.freeze({
      changed: saved.changed,
      record: saved.record,
      previousActivationStatus: existing.activationStatus,
      previousHealthStatus: existing.healthStatus,
    });
  }

  public async suggestExecutionNodeSelectionHints(input: {
    readonly asOf: string;
    readonly requirements?: {
      readonly requiredBackendFamilies?: readonly string[];
      readonly requiredExecutionTarget?: string;
      readonly requiredNodeCapabilities?: readonly ("ui" | "api" | "scheduler" | "executor" | "storage-access" | "preview-worker")[];
      readonly requiresRemoteScheduling?: boolean;
      readonly requiredOperationKind?: string;
      readonly requiredOperationCapability?: string;
      readonly requiredInputKinds?: readonly string[];
      readonly requiredOutputKinds?: readonly string[];
      readonly requiredTranslationContractVersion?: string;
      readonly preferredResourceClassHints?: readonly string[];
      readonly allowDegraded?: boolean;
      readonly maxLastSeenAgeMs?: number;
      readonly now?: string | Date;
    };
    readonly candidateNodeIds?: readonly string[];
    readonly query?: ExecutionNodeListQuery;
    readonly limit?: number;
  }): Promise<readonly ExecutionNodeSelectionHint[]> {
    const evaluations = await this.evaluateExecutionNodeEligibility({
      asOf: input.asOf,
      requirements: input.requirements,
      candidateNodeIds: input.candidateNodeIds,
      query: input.query,
    });

    const ranked = [...evaluations]
      .sort((left, right) => {
        const decisionRank = this.toDecisionRank(left.decision) - this.toDecisionRank(right.decision);
        if (decisionRank !== 0) {
          return decisionRank;
        }

        return left.compatibility.findings.length - right.compatibility.findings.length;
      })
      .map((evaluation, index) => Object.freeze({
        nodeId: evaluation.nodeId,
        rank: index + 1,
        decision: evaluation.decision,
        matchedBackendFamily: evaluation.compatibility.matchedBackendFamily,
        matchedExecutionTarget: evaluation.compatibility.matchedExecutionTarget,
        reasonCodes: Object.freeze(evaluation.compatibility.findings.map((finding) => finding.code)),
      }));

    return Object.freeze(typeof input.limit === "number" && input.limit > 0
      ? ranked.slice(0, input.limit)
      : ranked);
  }

  private toDecisionRank(decision: string): number {
    if (decision === ExecutionNodeEligibilityDecisionKinds.eligible) {
      return 0;
    }
    if (decision === ExecutionNodeEligibilityDecisionKinds.unavailable) {
      return 1;
    }
    return 2;
  }

  private async resolveCandidates(input: {
    readonly query?: ExecutionNodeListQuery;
    readonly candidateNodeIds?: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    if (input.query) {
      return this.listExecutionNodes(input.query);
    }

    const allRecords = [...this.recordsByNodeId.values()];
    if (!input.candidateNodeIds || input.candidateNodeIds.length === 0) {
      return allRecords;
    }

    const nodeIdSet = new Set(input.candidateNodeIds);
    return allRecords.filter((record) => nodeIdSet.has(record.nodeId));
  }
}

describe("execution node management ports", () => {
  it("supports repository registration, query, and status/capability updates", async () => {
    const adapter = new InMemoryExecutionNodeManagementAdapter();
    const initial = createSampleExecutionNode();

    const registered = await adapter.registerExecutionNode({
      record: initial,
      mutation: {
        operationKey: "register-node-compute-001",
        actorId: "system:bootstrap",
      },
    });

    expect(registered.changed).toBeTrue();
    expect(registered.record.nodeId).toBe("node-compute-001");

    await adapter.updateExecutionNodeHealth({
      nodeId: "node-compute-001",
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      observedAt: "2026-04-08T14:05:00.000Z",
      mutation: {
        operationKey: "health-node-compute-001",
        actorId: "system:health-probe",
      },
    });

    await adapter.updateExecutionNodeCapabilities({
      nodeId: "node-compute-001",
      backendFamilyCapabilities: [
        {
          backendFamily: "comfyui",
          supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
          supportedOperationKinds: ["image-to-image"],
        },
      ],
      refreshedAt: "2026-04-08T14:06:00.000Z",
      mutation: {
        operationKey: "capability-node-compute-001",
        actorId: "system:capability-probe",
      },
    });

    const byId = await adapter.findExecutionNodeById("node-compute-001");
    expect(byId?.healthStatus).toBe(ExecutionNodeHealthStatuses.degraded);
    expect(byId?.backendFamilyCapabilities[0]?.supportedOperationKinds).toContain("image-to-image");

    const filtered = await adapter.listExecutionNodes({
      healthStatuses: [ExecutionNodeHealthStatuses.degraded],
      backendFamilies: ["comfyui"],
      requiredCapabilitiesAnyOf: [NodeRoleCapabilities.executor],
      requireCertificateRef: true,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.nodeId).toBe("node-compute-001");
  });

  it("supports health/capability refresh, eligibility evaluation, availability changes, and selection hints through service ports", async () => {
    const adapter = new InMemoryExecutionNodeManagementAdapter();
    const ports: ExecutionNodeManagementServicePorts = {
      healthRefresh: adapter,
      capabilityRefresh: adapter,
      eligibility: adapter,
      availability: adapter,
      selectionHints: adapter,
    };

    await adapter.registerExecutionNode({
      record: createSampleExecutionNode({ nodeId: "node-ready" }),
      mutation: {
        operationKey: "register-node-ready",
        actorId: "system:bootstrap",
      },
    });
    await adapter.registerExecutionNode({
      record: createSampleExecutionNode({
        nodeId: "node-offline",
        healthStatus: ExecutionNodeHealthStatuses.unavailable,
        activationStatus: ExecutionNodeActivationStatuses.unavailable,
      }),
      mutation: {
        operationKey: "register-node-offline",
        actorId: "system:bootstrap",
      },
    });

    const healthRefresh = await ports.healthRefresh.refreshExecutionNodeHealth({
      nodeId: "node-ready",
      observation: {
        healthStatus: ExecutionNodeHealthStatuses.ready,
        observedAt: "2026-04-08T14:10:00.000Z",
        summary: "probe-ok",
      },
      mutation: {
        operationKey: "refresh-health-node-ready",
        actorId: "system:health-probe",
      },
    });
    expect(healthRefresh.record.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);

    const capabilityRefresh = await ports.capabilityRefresh.refreshExecutionNodeCapabilities({
      nodeId: "node-ready",
      observation: {
        observedAt: "2026-04-08T14:11:00.000Z",
        backendFamilyCapabilities: [
          {
            backendFamily: "comfyui",
            supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
            supportedOperationKinds: ["image-to-image"],
            executionReadiness: {
              state: "ready",
              checkedAt: "2026-04-08T14:11:00.000Z",
            },
          },
        ],
      },
      mutation: {
        operationKey: "refresh-capability-node-ready",
        actorId: "system:capability-probe",
      },
    });
    expect(capabilityRefresh.record.backendFamilyCapabilities[0]?.executionReadiness?.state).toBe("ready");

    const evaluations = await ports.eligibility.evaluateExecutionNodeEligibility({
      asOf: "2026-04-08T14:12:00.000Z",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
        requiredExecutionTarget: ExecutionNodeTargetKinds.imageManipulation,
        requiredOperationKind: "image-to-image",
      },
    });

    const evaluationByNodeId = new Map(evaluations.map((entry) => [entry.nodeId, entry]));
    expect(evaluationByNodeId.get("node-ready")?.decision).toBe(ExecutionNodeEligibilityDecisionKinds.eligible);
    expect(evaluationByNodeId.get("node-offline")?.decision).toBe(ExecutionNodeEligibilityDecisionKinds.unavailable);

    const availabilityUpdate = await ports.availability.setExecutionNodeAvailability({
      nodeId: "node-ready",
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      changedAt: "2026-04-08T14:13:00.000Z",
      mutation: {
        operationKey: "set-availability-node-ready",
        actorId: "admin:user",
      },
      details: {
        reasonCode: "maintenance-window",
      },
    });
    expect(availabilityUpdate.previousActivationStatus).toBe(ExecutionNodeActivationStatuses.active);
    expect(availabilityUpdate.record.activationStatus).toBe(ExecutionNodeActivationStatuses.degraded);

    const hints = await ports.selectionHints.suggestExecutionNodeSelectionHints({
      asOf: "2026-04-08T14:14:00.000Z",
      requirements: {
        requiredBackendFamilies: ["comfyui"],
        requiredExecutionTarget: ExecutionNodeTargetKinds.imageManipulation,
      },
      limit: 2,
    });

    expect(hints).toHaveLength(2);
    expect(hints[0]?.nodeId).toBe("node-ready");
    expect(hints[0]?.decision).toBe(ExecutionNodeEligibilityDecisionKinds.eligible);
    expect(hints[1]?.decision).toBe(ExecutionNodeEligibilityDecisionKinds.unavailable);
  });
});
