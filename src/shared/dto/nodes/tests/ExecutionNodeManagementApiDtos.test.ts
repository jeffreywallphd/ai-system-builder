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
  toExecutionNodeBackendAvailabilityReadResponseFromInternalDto,
  toExecutionNodeGetResponseFromInternalDto,
  toExecutionNodeListResponseFromInternalDto,
  toExecutionNodeSetAvailabilityOverrideResponseFromInternalDto,
} from "../ExecutionNodeManagementApiDtos";

describe("ExecutionNodeManagementApiDtos", () => {
  it("builds immutable list response DTOs from internal records", () => {
    const response = toExecutionNodeListResponseFromInternalDto({
      contractVersion: "execution-node-management-api/v1",
      items: [{
        nodeId: "node:execution:1",
        displayName: "Execution Node 1",
        nodeType: NodeTypes.compute,
        health: {
          activationStatus: ExecutionNodeActivationStatuses.active,
          healthStatus: ExecutionNodeHealthStatuses.ready,
          stale: false,
        },
        operational: {
          approvalStatus: NodeApprovalStatuses.approved,
          trustState: NodeTrustStates.trusted,
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
          deploymentTags: ["prod"],
          certificateAssigned: false,
          availabilityOverrideMode: "enabled",
          availabilityOverrideUpdatedAt: "2026-04-08T20:19:00.000Z",
        },
        backendFamilies: ["comfyui"],
        endpointRef: "https://internal.example/node/1",
        certificateRef: "cert:node:1",
      }],
      totalCount: 1,
      asOf: "2026-04-08T20:20:00.000Z",
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.items[0]?.operational.certificateAssigned).toBeTrue();
    expect((response.items[0] as unknown as { endpointRef?: string }).endpointRef).toBeUndefined();
  });

  it("builds immutable detail response DTOs from internal records", () => {
    const response = toExecutionNodeGetResponseFromInternalDto({
      contractVersion: "execution-node-management-api/v1",
      node: {
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
          enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.api],
          supportsRemoteScheduling: true,
          deploymentTags: ["hybrid"],
          certificateAssigned: true,
          availabilityOverrideMode: "enabled",
          availabilityOverrideUpdatedAt: "2026-04-08T20:20:00.000Z",
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
            state: ExecutionNodeBackendReadinessStates.ready,
          },
        }],
        createdAt: "2026-04-08T20:00:00.000Z",
        updatedAt: "2026-04-08T20:21:00.000Z",
        endpointRef: "https://internal.example/node/2",
        connectionSecretRef: "secret:node:2",
      },
      asOf: "2026-04-08T20:21:00.000Z",
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.node.backendCapabilities[0]?.backendFamily).toBe("comfyui");
    expect((response.node as unknown as { connectionSecretRef?: string }).connectionSecretRef).toBeUndefined();
  });

  it("builds immutable backend availability DTOs from internal summaries", () => {
    const response = toExecutionNodeBackendAvailabilityReadResponseFromInternalDto({
      contractVersion: "execution-node-management-api/v1",
      asOf: "2026-04-08T20:22:00.000Z",
      backends: [{
        backendFamily: "comfyui",
        readiness: ExecutionNodeBackendReadinessStates.degraded,
        totalNodeCount: 2,
        readyNodeCount: 1,
        degradedNodeCount: 1,
        unavailableNodeCount: 0,
        unknownNodeCount: 0,
        checkedAt: "2026-04-08T20:22:00.000Z",
        probePayloadRefIds: ["probe:1"],
      }],
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.backends[0]?.degradedNodeCount).toBe(1);
    expect((response.backends[0] as unknown as { probePayloadRefIds?: ReadonlyArray<string> }).probePayloadRefIds)
      .toBeUndefined();
  });

  it("builds immutable availability-override response DTOs from internal summaries", () => {
    const response = toExecutionNodeSetAvailabilityOverrideResponseFromInternalDto({
      contractVersion: "execution-node-management-api/v1",
      node: {
        nodeId: "node:execution:override",
        displayName: "Execution Node Override",
        nodeType: NodeTypes.compute,
        health: {
          activationStatus: ExecutionNodeActivationStatuses.active,
          healthStatus: ExecutionNodeHealthStatuses.ready,
          stale: false,
        },
        operational: {
          approvalStatus: NodeApprovalStatuses.approved,
          trustState: NodeTrustStates.trusted,
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
          deploymentTags: ["ops"],
          certificateAssigned: true,
          availabilityOverrideMode: "disabled",
          availabilityOverrideUpdatedAt: "2026-04-08T20:25:00.000Z",
        },
        backendFamilies: ["comfyui"],
        endpointRef: "internal://node/override",
      },
      mutation: {
        changed: true,
        wasReplay: false,
      },
      asOf: "2026-04-08T20:25:01.000Z",
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.mutation.changed).toBeTrue();
    expect((response.node as unknown as { endpointRef?: string }).endpointRef).toBeUndefined();
  });
});
