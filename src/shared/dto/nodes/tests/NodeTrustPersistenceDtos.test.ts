import { describe, expect, it } from "bun:test";
import { NodeEnrollmentRequestStatuses } from "../../../../domain/nodes/NodeTrustDomain";
import { NodeRoleCapabilities, NodeTrustStates } from "../../../../domain/nodes/NodeTrustDomain";
import {
  NodeTrustPersistenceQueryPresets,
  normalizeNodeTrustMutationOperationKey,
  toNodeCapabilityLookupKey,
  toNodeDeploymentTagLookupKey,
  toNodeTrustStateLookupKey,
} from "../NodeTrustPersistenceDtos";

describe("NodeTrustPersistenceDtos", () => {
  it("builds deterministic lookup keys for capability, deployment tag, and trust state indexes", () => {
    expect(toNodeCapabilityLookupKey(NodeRoleCapabilities.executor)).toBe("capability:executor");
    expect(toNodeDeploymentTagLookupKey("  US-EAST-1  ")).toBe("tag:us-east-1");
    expect(toNodeTrustStateLookupKey(NodeTrustStates.pendingApproval)).toBe("trust-state:pending-approval");
  });

  it("exposes stable query presets for pending enrollment, active nodes, and revoked nodes", () => {
    expect(NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses).toContain(
      NodeEnrollmentRequestStatuses.submitted,
    );
    expect(NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses).toContain(
      NodeEnrollmentRequestStatuses.underReview,
    );
    expect(NodeTrustPersistenceQueryPresets.activeNodeTrustStates).toEqual([NodeTrustStates.trusted]);
    expect(NodeTrustPersistenceQueryPresets.revokedNodeTrustStates).toEqual([NodeTrustStates.revoked]);
  });

  it("rejects empty idempotency operation keys", () => {
    expect(() => normalizeNodeTrustMutationOperationKey("   ")).toThrow(
      "Node trust persistence mutation operationKey is required.",
    );
    expect(normalizeNodeTrustMutationOperationKey("op-node-101")).toBe("op-node-101");
  });
});
