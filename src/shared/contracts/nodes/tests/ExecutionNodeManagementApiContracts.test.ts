import { describe, expect, it } from "bun:test";
import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
import {
  ExecutionNodeManagementTransportContractVersions,
  ExecutionNodeManagementTransportRoutes,
  toExecutionNodeBackendAvailabilitySummaryDto,
  toExecutionNodeDetailDto,
  toExecutionNodeSummaryDto,
} from "../ExecutionNodeManagementApiContracts";

describe("ExecutionNodeManagementApiContracts", () => {
  it("defines stable route and version catalogs", () => {
    expect(ExecutionNodeManagementTransportContractVersions.v1).toBe("execution-node-management-api/v1");
    expect(ExecutionNodeManagementTransportRoutes.listNodes).toBe("/api/v1/execution-nodes");
    expect(ExecutionNodeManagementTransportRoutes.checkReadiness).toBe("/api/v1/execution-nodes/readiness");
    expect(ExecutionNodeManagementTransportRoutes.setAvailabilityOverride)
      .toBe("/api/v1/execution-nodes/:nodeId/availability");
    expect(ExecutionNodeManagementTransportRoutes.listBackendAvailability)
      .toBe("/api/v1/execution-nodes/backends/availability");
  });

  it("projects internal execution-node summary to external safe summary", () => {
    const summary = toExecutionNodeSummaryDto({
      nodeId: "node:execution:1",
      displayName: "Execution Node 1",
      nodeType: NodeTypes.compute,
      health: {
        activationStatus: ExecutionNodeActivationStatuses.active,
        healthStatus: ExecutionNodeHealthStatuses.ready,
        lastSeenAt: "2026-04-08T19:30:00.000Z",
        stale: false,
      },
      operational: {
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.api],
        supportsRemoteScheduling: true,
        deploymentTags: ["gpu", "prod"],
        certificateAssigned: false,
        availabilityOverrideMode: "enabled",
        availabilityOverrideUpdatedAt: "2026-04-08T19:29:00.000Z",
      },
      backendFamilies: ["comfyui"],
      endpointRef: "https://internal.example/node/1",
      certificateRef: "cert:node:1",
      adapterDiagnosticKeys: ["probe-latency-ms"],
    });

    expect(summary.operational.certificateAssigned).toBeTrue();
    expect((summary as unknown as { endpointRef?: string }).endpointRef).toBeUndefined();
    expect((summary as unknown as { certificateRef?: string }).certificateRef).toBeUndefined();
  });

  it("projects internal execution-node detail without leaking transport internals", () => {
    const detail = toExecutionNodeDetailDto({
      nodeId: "node:execution:2",
      displayName: "Execution Node 2",
      nodeType: NodeTypes.hybrid,
      health: {
        activationStatus: ExecutionNodeActivationStatuses.degraded,
        healthStatus: ExecutionNodeHealthStatuses.degraded,
        stale: false,
      },
      operational: {
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: NodeTrustStates.trusted,
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
        deploymentTags: ["hybrid"],
        certificateAssigned: true,
        availabilityOverrideMode: "enabled",
        availabilityOverrideUpdatedAt: "2026-04-08T19:25:00.000Z",
      },
      backendFamilies: ["comfyui"],
      backendCapabilities: [{
        backendFamily: "comfyui",
        supportedExecutionTargets: ["image-manipulation"],
        supportedOperationKinds: ["image-to-image"],
        supportedOperationCapabilities: ["img2img"],
        supportedInputKinds: ["image-asset"],
        supportedOutputKinds: ["image-asset"],
        supportedTranslationContractVersions: ["1.0.0"],
        resourceClassHints: ["gpu-general"],
        metadataTags: ["default"],
        readiness: {
          state: ExecutionNodeBackendReadinessStates.degraded,
          checkedAt: "2026-04-08T19:31:00.000Z",
          summary: "Queue backlog is elevated.",
        },
      }],
      createdAt: "2026-04-08T19:00:00.000Z",
      updatedAt: "2026-04-08T19:31:00.000Z",
      endpointRef: "https://internal.example/node/2",
      connectionSecretRef: "secret:node:2",
      backendProbePayloadRef: "probe:payload:2",
    });

    expect(detail.backendCapabilities[0]?.backendFamily).toBe("comfyui");
    expect((detail as unknown as { endpointRef?: string }).endpointRef).toBeUndefined();
    expect((detail as unknown as { connectionSecretRef?: string }).connectionSecretRef).toBeUndefined();
    expect((detail as unknown as { backendProbePayloadRef?: string }).backendProbePayloadRef).toBeUndefined();
  });

  it("projects backend availability summary and strips internal probe references", () => {
    const summary = toExecutionNodeBackendAvailabilitySummaryDto({
      backendFamily: "comfyui",
      readiness: ExecutionNodeBackendReadinessStates.ready,
      totalNodeCount: 4,
      readyNodeCount: 3,
      degradedNodeCount: 1,
      unavailableNodeCount: 0,
      unknownNodeCount: 0,
      checkedAt: "2026-04-08T19:35:00.000Z",
      summary: "Sufficient node capacity.",
      probePayloadRefIds: ["probe:1", "probe:2"],
      connectionSecretRefIds: ["secret:1"],
    });

    expect(summary.readyNodeCount).toBe(3);
    expect((summary as unknown as { probePayloadRefIds?: ReadonlyArray<string> }).probePayloadRefIds).toBeUndefined();
    expect((summary as unknown as { connectionSecretRefIds?: ReadonlyArray<string> }).connectionSecretRefIds)
      .toBeUndefined();
  });
});
