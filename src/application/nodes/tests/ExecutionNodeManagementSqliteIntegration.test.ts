import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import { SqliteExecutionNodeRepository } from "@infrastructure/persistence/nodes/SqliteExecutionNodeRepository";
import { ActivateExecutionNodeUseCase } from "../use-cases/ActivateExecutionNodeUseCase";
import { RegisterExecutionNodeUseCase } from "../use-cases/RegisterExecutionNodeUseCase";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("Execution node management use cases (SQLite integration)", () => {
  it("persists registered and activated execution node records with durable status history", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-node-execution-sqlite-"));
    createdRoots.push(root);

    const repository = new SqliteExecutionNodeRepository(path.join(root, "execution-node.sqlite"));
    const register = new RegisterExecutionNodeUseCase({
      nodeRepository: repository,
    });
    const activate = new ActivateExecutionNodeUseCase({
      nodeRepository: repository,
    });

    const registration = await register.execute({
      actorUserIdentityId: "admin:node-operator",
      nodeId: "node:sqlite:execution:1",
      displayName: "SQLite Execution Node",
      nodeType: NodeTypes.compute,
      capabilityProfile: createNodeCapabilityProfile({
        enabledCapabilities: [NodeRoleCapabilities.executor, NodeRoleCapabilities.storageAccess],
        supportsRemoteScheduling: true,
        maxConcurrentWorkloads: 4,
      }),
      backendFamilyCapabilities: [{
        backendFamily: "comfyui",
        supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
        supportedOperationKinds: ["image-to-image"],
      }],
      endpointRef: "node://sqlite-execution-1",
      configurationRef: "config://sqlite-execution-1",
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      activationStatus: ExecutionNodeActivationStatuses.approved,
      healthStatus: ExecutionNodeHealthStatuses.unknown,
      certificateRef: "cert:node:sqlite:execution:1:v1",
      deploymentTags: ["region-east", "gpu"],
      metadata: {
        owner: "platform",
      },
      createdAt: "2026-04-08T15:00:00.000Z",
      reason: "bootstrap",
      correlationId: "corr:node:sqlite:execution:1",
    });

    expect(registration.ok).toBeTrue();
    if (!registration.ok) {
      repository.dispose();
      return;
    }

    const activation = await activate.execute({
      actorUserIdentityId: "admin:node-operator",
      nodeId: "node:sqlite:execution:1",
      activatedAt: "2026-04-08T15:02:00.000Z",
      healthStatus: ExecutionNodeHealthStatuses.ready,
      reason: "promote-to-active",
      correlationId: "corr:node:sqlite:execution:1:activate",
    });

    expect(activation.ok).toBeTrue();
    if (!activation.ok) {
      repository.dispose();
      return;
    }

    const persisted = await repository.findExecutionNodeById("node:sqlite:execution:1");
    expect(persisted?.activationStatus).toBe(ExecutionNodeActivationStatuses.active);
    expect(persisted?.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
    expect(persisted?.backendFamilyCapabilities[0]?.backendFamily).toBe("comfyui");

    const listed = await repository.listExecutionNodes({
      backendFamilies: ["comfyui"],
      activationStatuses: [ExecutionNodeActivationStatuses.active],
      healthStatuses: [ExecutionNodeHealthStatuses.ready],
      requiredCapabilitiesAnyOf: [NodeRoleCapabilities.executor],
      requireCertificateRef: true,
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]?.nodeId).toBe("node:sqlite:execution:1");

    repository.dispose();

    const reopened = new SqliteExecutionNodeRepository(path.join(root, "execution-node.sqlite"));
    const reopenedRecord = await reopened.findExecutionNodeById("node:sqlite:execution:1");
    expect(reopenedRecord?.activationStatus).toBe(ExecutionNodeActivationStatuses.active);
    expect(reopenedRecord?.healthStatus).toBe(ExecutionNodeHealthStatuses.ready);
    reopened.dispose();
  });
});
