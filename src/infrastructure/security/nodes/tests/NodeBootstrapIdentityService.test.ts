import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NodeRoleCapabilities, NodeTypes } from "../../../../domain/nodes/NodeTrustDomain";
import { parseNodeEnrollmentSubmissionRequestDto } from "../../../../shared/schemas/nodes/NodeTrustApiSchemaContracts";
import {
  NodeBootstrapIdentityService,
  NodeBootstrapIdentityServiceError,
} from "../NodeBootstrapIdentityService";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("NodeBootstrapIdentityService", () => {
  it("creates bootstrap identity material and a valid enrollment payload", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-bootstrap-"));
    createdRoots.push(root);
    const service = new NodeBootstrapIdentityService(root);

    const ensured = await service.ensureBootstrapIdentity({
      nodeType: NodeTypes.compute,
      displayName: "Compute Worker 1",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
      deploymentTags: ["us-east-1", "GPU", "gpu"],
    });

    expect(ensured.created).toBeTrue();
    expect(ensured.material.record.nodeType).toBe(NodeTypes.compute);
    expect(ensured.material.record.approvalStatus).toBe("pending");
    expect(ensured.material.record.trustState).toBe("pending-enrollment");
    expect(ensured.material.record.deploymentTags).toEqual(["us-east-1", "gpu"]);
    expect(ensured.material.record.publicTrustMaterialRef.startsWith("node-public-key:spki-sha256:")).toBeTrue();

    const payload = service.buildEnrollmentSubmissionPayload(ensured.material, {
      requestedCertificateProfile: "node-default",
    });

    const parsedPayload = parseNodeEnrollmentSubmissionRequestDto(payload);
    expect(parsedPayload.nodeId).toBe(ensured.material.record.nodeId);
    expect(parsedPayload.bootstrap?.trustMaterialRef).toBe(ensured.material.record.publicTrustMaterialRef);
    expect(parsedPayload.bootstrap?.publicKeyFingerprintSha256).toBe(ensured.material.record.publicKeyFingerprintSha256);
  });

  it("recovers existing bootstrap state idempotently", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-bootstrap-idempotent-"));
    createdRoots.push(root);
    const service = new NodeBootstrapIdentityService(root);

    const first = await service.ensureBootstrapIdentity({
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Worker 1",
      capabilityProfile: {
        enabledCapabilities: [
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.api,
        ],
      },
    });
    const second = await service.ensureBootstrapIdentity({
      nodeType: NodeTypes.hybrid,
      displayName: "Hybrid Worker Renamed",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
    });

    expect(first.created).toBeTrue();
    expect(second.created).toBeFalse();
    expect(second.material.record.nodeId).toBe(first.material.record.nodeId);
    expect(second.material.record.displayName).toBe(first.material.record.displayName);

    const persisted = JSON.parse(readFileSync(path.join(root, "node-bootstrap-record.json"), "utf8")) as {
      readonly record: { readonly nodeId: string };
    };
    expect(persisted.record.nodeId).toBe(first.material.record.nodeId);
  });

  it("rejects unsupported node types for bootstrap", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-bootstrap-node-type-"));
    createdRoots.push(root);
    const service = new NodeBootstrapIdentityService(root);

    await expect(service.ensureBootstrapIdentity({
      nodeType: NodeTypes.edge,
      displayName: "Edge Node",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
    })).rejects.toThrow(NodeBootstrapIdentityServiceError);
  });

  it("fails when bootstrap files are only partially present", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-node-bootstrap-partial-"));
    createdRoots.push(root);
    const service = new NodeBootstrapIdentityService(root);

    const first = await service.ensureBootstrapIdentity({
      nodeType: NodeTypes.compute,
      displayName: "Compute Node",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
    });

    unlinkSync(first.material.publicKeyPemPath);

    await expect(service.ensureBootstrapIdentity({
      nodeType: NodeTypes.compute,
      displayName: "Compute Node",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
      },
    })).rejects.toThrow(NodeBootstrapIdentityServiceError);
  });
});
