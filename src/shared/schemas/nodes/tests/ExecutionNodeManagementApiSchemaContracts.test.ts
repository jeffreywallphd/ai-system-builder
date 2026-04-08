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
  ExecutionNodeManagementApiSchemaValidationError,
  parseExecutionNodeBackendAvailabilityReadResponseDto,
  parseExecutionNodeEligibilityCheckResponseDto,
  parseExecutionNodeGetResponseDto,
  parseExecutionNodeListRequestDto,
  parseExecutionNodeListResponseDto,
  parseExecutionNodeReadinessCheckResponseDto,
} from "../ExecutionNodeManagementApiSchemaContracts";

describe("ExecutionNodeManagementApiSchemaContracts", () => {
  it("parses list request and response payloads", () => {
    const request = parseExecutionNodeListRequestDto({
      nodeTypes: [NodeTypes.compute],
      activationStatuses: [ExecutionNodeActivationStatuses.active],
      backendFamilies: ["comfyui"],
      requiredCapabilitiesAnyOf: [NodeRoleCapabilities.executor],
      includeRevoked: false,
      limit: 50,
      offset: 0,
    });
    expect(request.limit).toBe(50);

    const response = parseExecutionNodeListResponseDto({
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
          certificateAssigned: true,
          availabilityOverrideMode: "enabled",
          availabilityOverrideUpdatedAt: "2026-04-08T19:59:00.000Z",
        },
        backendFamilies: ["comfyui"],
      }],
      totalCount: 1,
      asOf: "2026-04-08T20:00:00.000Z",
    });

    expect(response.items[0]?.nodeId).toBe("node:execution:1");
  });

  it("rejects leaked internal fields from get-node response payloads", () => {
    expect(() => parseExecutionNodeGetResponseDto({
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
          enabledCapabilities: [NodeRoleCapabilities.executor],
          supportsRemoteScheduling: true,
          deploymentTags: ["hybrid"],
          certificateAssigned: true,
          availabilityOverrideMode: "enabled",
          availabilityOverrideUpdatedAt: "2026-04-08T20:04:00.000Z",
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
        endpointRef: "https://internal.example/node/2",
        createdAt: "2026-04-08T20:00:00.000Z",
        updatedAt: "2026-04-08T20:05:00.000Z",
      },
      asOf: "2026-04-08T20:05:00.000Z",
    })).toThrow(ExecutionNodeManagementApiSchemaValidationError);
  });

  it("parses readiness and backend-availability response payloads", () => {
    const readiness = parseExecutionNodeReadinessCheckResponseDto({
      contractVersion: "execution-node-management-api/v1",
      checkedAt: "2026-04-08T20:06:00.000Z",
      readyForExecution: true,
      readiness: "ready",
      nodeResults: [{
        nodeId: "node:execution:1",
        displayName: "Execution Node 1",
        readiness: "ready",
        eligible: true,
        compatible: true,
        routable: true,
        matchedBackendFamily: "comfyui",
        matchedExecutionTarget: "image-manipulation",
        findingCodes: [],
      }],
      issues: [],
    });
    expect(readiness.readyForExecution).toBeTrue();

    const availability = parseExecutionNodeBackendAvailabilityReadResponseDto({
      contractVersion: "execution-node-management-api/v1",
      asOf: "2026-04-08T20:10:00.000Z",
      backends: [{
        backendFamily: "comfyui",
        readiness: "degraded",
        totalNodeCount: 3,
        readyNodeCount: 2,
        degradedNodeCount: 1,
        unavailableNodeCount: 0,
        unknownNodeCount: 0,
        checkedAt: "2026-04-08T20:10:00.000Z",
      }],
    });
    expect(availability.backends[0]?.totalNodeCount).toBe(3);
  });

  it("enforces decision coherence for eligibility responses", () => {
    expect(() => parseExecutionNodeEligibilityCheckResponseDto({
      contractVersion: "execution-node-management-api/v1",
      checkedAt: "2026-04-08T20:11:00.000Z",
      evaluations: [{
        nodeId: "node:execution:3",
        displayName: "Execution Node 3",
        decision: "eligible",
        compatible: true,
        routable: false,
        findingCodes: ["node-health-not-routable"],
        findings: [{
          code: "node-health-not-routable",
          kind: "transient-availability",
          message: "Node health is degraded.",
          blocking: true,
        }],
      }],
    })).toThrow("eligible decision requires compatible=true and routable=true");
  });
});
