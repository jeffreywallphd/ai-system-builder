import { describe, expect, it } from "bun:test";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../../domain/nodes/NodeTrustDomain";
import {
  mapNodeEnrollmentRequestRecordToRowValues,
  mapNodeEnrollmentRequestRowToRecord,
  mapNodeIdentityRecordToRowValues,
  mapNodeIdentityRowToRecord,
  normalizeNodeTrustLookup,
} from "../NodeTrustPersistenceMapper";

describe("NodeTrustPersistenceMapper", () => {
  it("maps node identity rows to records and normalizes payload shape", () => {
    const record = mapNodeIdentityRowToRecord({
      node_id: "node:001",
      node_type: NodeTypes.compute,
      display_name: "Compute 001",
      capability_enabled_json: JSON.stringify([
        NodeRoleCapabilities.workflowExecution,
        NodeRoleCapabilities.modelInference,
      ]),
      capability_profile_version: "profile:v1",
      supports_remote_scheduling: 1,
      max_concurrent_workloads: 4,
      approval_status: NodeApprovalStatuses.approved,
      trust_state: NodeTrustStates.trusted,
      certificate_ref: "cert:node:001:v1",
      certificate_assigned_at: "2026-04-05T12:05:00.000Z",
      certificate_expires_at: null,
      certificate_authority_ref: "ca:platform",
      certificate_thumbprint: null,
      deployment_tags_json: JSON.stringify(["us-east-1", "gpu"]),
      last_seen_at: "2026-04-05T12:10:00.000Z",
      heartbeat_status: NodeHeartbeatStatuses.online,
      last_seen_observed_by: "heartbeat",
      revocation_state: NodeRevocationStates.active,
      revocation_reason: null,
      revocation_revoked_at: null,
      revocation_revoked_by_user_identity_id: null,
      revocation_note: null,
      enrolled_at: "2026-04-05T12:00:00.000Z",
      approved_at: "2026-04-05T12:05:00.000Z",
      revoked_at: null,
      enrollment_request_id: "enroll:001",
      created_at: "2026-04-05T12:00:00.000Z",
      created_by: "system",
      last_modified_at: "2026-04-05T12:10:00.000Z",
      last_modified_by: "admin",
      revision: 3,
    });

    expect(record.nodeId).toBe("node:001");
    expect(record.capabilityProfile.enabledCapabilities).toEqual([
      NodeRoleCapabilities.workflowExecution,
      NodeRoleCapabilities.modelInference,
    ]);
    expect(record.deploymentTags).toEqual(["us-east-1", "gpu"]);
    expect(record.certificate?.certificateRef).toBe("cert:node:001:v1");

    const rowValues = mapNodeIdentityRecordToRowValues(record);
    expect(rowValues[0]).toBe("node:001");
    expect(rowValues[7]).toBe(NodeApprovalStatuses.approved);
    expect(rowValues[8]).toBe(NodeTrustStates.trusted);
  });

  it("maps enrollment rows and lookup normalization", () => {
    const record = mapNodeEnrollmentRequestRowToRecord({
      request_id: "enroll:001",
      node_id: "node:001",
      node_type: NodeTypes.hybrid,
      display_name: "Hybrid 001",
      capability_enabled_json: JSON.stringify([
        NodeRoleCapabilities.workflowExecution,
      ]),
      capability_profile_version: null,
      supports_remote_scheduling: 1,
      max_concurrent_workloads: null,
      deployment_tags_json: JSON.stringify(["Region-1", "region-1", "edge"]),
      certificate_ref: null,
      requested_at: "2026-04-05T13:00:00.000Z",
      status: NodeEnrollmentRequestStatuses.submitted,
      reviewed_at: null,
      reviewed_by_user_identity_id: null,
      decision_note: null,
      created_at: "2026-04-05T13:00:00.000Z",
      created_by: "node:001",
      last_modified_at: "2026-04-05T13:00:00.000Z",
      last_modified_by: "node:001",
      revision: 1,
    });

    expect(record.nodeId).toBe("node:001");
    expect(record.deploymentTags).toEqual(["region-1", "edge"]);

    const rowValues = mapNodeEnrollmentRequestRecordToRowValues(record);
    expect(rowValues[0]).toBe("enroll:001");
    expect(rowValues[11]).toBe(NodeEnrollmentRequestStatuses.submitted);
    expect(normalizeNodeTrustLookup("  node:001  ")).toBe("node:001");
    expect(normalizeNodeTrustLookup("   ")).toBeUndefined();
  });
});
