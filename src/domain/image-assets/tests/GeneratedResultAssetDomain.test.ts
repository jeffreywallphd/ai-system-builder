import { describe, expect, it } from "bun:test";
import {
  GeneratedResultAssetDomainError,
  GeneratedResultAssetLifecycleTransitionError,
  GeneratedResultAssetStatuses,
  createGeneratedResultAsset,
  rehydrateGeneratedResultAsset,
  transitionGeneratedResultAssetStatus,
  updateGeneratedResultAssetVisibility,
} from "../GeneratedResultAssetDomain";

function createPendingGeneratedResult() {
  return createGeneratedResultAsset({
    resultAssetId: "asset-generated-result-001",
    workspaceId: "workspace-alpha",
    source: {
      runId: "run-image-001",
      systemId: "system-image-editor",
      workflowId: "workflow-background-replace",
      workflowTemplateId: "template-background-replace-v1",
      executionNodeId: "node-gpu-01",
      outputSlot: "primary-image",
    },
    lineage: {
      inputAssetIds: ["asset-input-001"],
      workflowTemplateVersionId: "template-background-replace-v1:rev-3",
      workflowTemplateVersionTag: "1.3.0",
      systemSnapshotId: "system-image-editor:snapshot:7",
      systemVersionTag: "2.1.0",
      parameterSnapshotId: "run-image-001:params:v1",
      selectedNodeId: "node-gpu-01",
      executionAdapterKind: "comfyui-adapter",
      executionBackendFamily: "comfyui",
    },
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/output",
    visibility: "workspace",
    createdBy: "user-artist",
    createdAt: "2026-04-08T14:00:00.000Z",
  });
}

describe("GeneratedResultAssetDomain", () => {
  it("creates pending generated result assets with authoritative run/workflow lineage references", () => {
    const asset = createPendingGeneratedResult();

    expect(asset.resultAssetId).toBe("asset-generated-result-001");
    expect(asset.workspaceId).toBe("workspace-alpha");
    expect(asset.source.runId).toBe("run-image-001");
    expect(asset.source.systemId).toBe("system-image-editor");
    expect(asset.source.workflowId).toBe("workflow-background-replace");
    expect(asset.source.executionNodeId).toBe("node-gpu-01");
    expect(asset.source.outputSlot).toBe("primary-image");
    expect(asset.lineage.workflowTemplateVersionId).toBe("template-background-replace-v1:rev-3");
    expect(asset.lineage.workflowTemplateVersionTag).toBe("1.3.0");
    expect(asset.lineage.systemSnapshotId).toBe("system-image-editor:snapshot:7");
    expect(asset.lineage.systemVersionTag).toBe("2.1.0");
    expect(asset.lineage.parameterSnapshotId).toBe("run-image-001:params:v1");
    expect(asset.lineage.selectedNodeId).toBe("node-gpu-01");
    expect(asset.lineage.executionAdapterKind).toBe("comfyui-adapter");
    expect(asset.lineage.executionBackendFamily).toBe("comfyui");
    expect(asset.lifecycle.status).toBe(GeneratedResultAssetStatuses.pendingCollection);
    expect(asset.lineage.inputAssetIds).toEqual(["asset-input-001"]);
  });

  it("supports pending -> available -> preview-ready -> archived lifecycle progression", () => {
    const pending = createPendingGeneratedResult();

    const available = transitionGeneratedResultAssetStatus(pending, {
      nextStatus: GeneratedResultAssetStatuses.available,
      actorUserId: "system-result-persistence",
      logicalAssetVersionId: "asset-generated-result-001:v1",
      occurredAt: "2026-04-08T14:01:00.000Z",
    });

    const previewReady = transitionGeneratedResultAssetStatus(available, {
      nextStatus: GeneratedResultAssetStatuses.previewReady,
      actorUserId: "system-preview-service",
      occurredAt: "2026-04-08T14:02:00.000Z",
    });

    const archived = transitionGeneratedResultAssetStatus(previewReady, {
      nextStatus: GeneratedResultAssetStatuses.archived,
      actorUserId: "user-admin",
      occurredAt: "2026-04-08T14:03:00.000Z",
    });

    expect(available.lifecycle.status).toBe(GeneratedResultAssetStatuses.available);
    expect(available.lifecycle.logicalAssetVersionId).toBe("asset-generated-result-001:v1");
    expect(previewReady.lifecycle.status).toBe(GeneratedResultAssetStatuses.previewReady);
    expect(previewReady.lifecycle.previewReadyBy).toBe("system-preview-service");
    expect(archived.lifecycle.status).toBe(GeneratedResultAssetStatuses.archived);
    expect(archived.lifecycle.archivedBy).toBe("user-admin");
  });

  it("supports failed collection and retry back to pending", () => {
    const pending = createPendingGeneratedResult();

    const failed = transitionGeneratedResultAssetStatus(pending, {
      nextStatus: GeneratedResultAssetStatuses.failedCollection,
      actorUserId: "system-result-persistence",
      failureCode: "backend-output-missing",
      failureMessage: "Execution output descriptor could not be resolved.",
      occurredAt: "2026-04-08T14:01:00.000Z",
    });

    const retried = transitionGeneratedResultAssetStatus(failed, {
      nextStatus: GeneratedResultAssetStatuses.pendingCollection,
      actorUserId: "system-result-persistence",
      occurredAt: "2026-04-08T14:02:00.000Z",
    });

    expect(failed.lifecycle.status).toBe(GeneratedResultAssetStatuses.failedCollection);
    expect(failed.lifecycle.failureCode).toBe("backend-output-missing");
    expect(retried.lifecycle.status).toBe(GeneratedResultAssetStatuses.pendingCollection);
  });

  it("rejects invalid lifecycle transitions", () => {
    const pending = createPendingGeneratedResult();

    expect(() => transitionGeneratedResultAssetStatus(pending, {
      nextStatus: GeneratedResultAssetStatuses.previewReady,
      actorUserId: "system-preview-service",
    })).toThrow(GeneratedResultAssetLifecycleTransitionError);
  });

  it("requires persistence metadata before available state", () => {
    const pending = createPendingGeneratedResult();

    expect(() => transitionGeneratedResultAssetStatus(pending, {
      nextStatus: GeneratedResultAssetStatuses.available,
      actorUserId: "system-result-persistence",
    })).toThrow("logicalAssetVersionId");
  });

  it("enforces visibility and sharing invariants", () => {
    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-002",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-002",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
      },
      storageInstanceId: "storage-alpha",
      visibility: "private",
      createdBy: "user-artist",
    })).toThrow("Private generated result assets require ownerUserId");

    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-003",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-artist",
      source: {
        runId: "run-image-003",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
      },
      storageInstanceId: "storage-alpha",
      visibility: "shared",
      createdBy: "user-artist",
    })).toThrow("requires sharingPolicyRef");
  });

  it("rejects lineage loops and invalid storage binding references", () => {
    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-004",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-004",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-generated-result-004"],
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("cannot include resultAssetId itself");

    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-005",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-005",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
      },
      storageInstanceId: "storage-alpha",
      storageBindingReference: "C:\\temp\\result.png",
      createdBy: "user-artist",
    })).toThrow("logical storage reference");
  });

  it("requires coherent lineage context references", () => {
    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-007",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-007",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        workflowTemplateVersionId: "template-background-replace-v1:rev-4",
        workflowTemplateVersionTag: "1.4.0",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("requires source.workflowTemplateId");

    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-008",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-008",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        workflowTemplateId: "template-background-replace-v1",
        executionNodeId: "node-gpu-01",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        selectedNodeId: "node-gpu-02",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("must match source.executionNodeId");
  });

  it("requires paired workflow-template lineage version fields", () => {
    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-009",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-009",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        workflowTemplateId: "template-background-replace-v1",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        workflowTemplateVersionId: "template-background-replace-v1:rev-5",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("workflowTemplateVersionTag is required");

    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-010",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-010",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        workflowTemplateId: "template-background-replace-v1",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        workflowTemplateVersionTag: "1.5.0",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("workflowTemplateVersionId is required");
  });

  it("normalizes adapter lineage fields and rejects invalid version tags", () => {
    const asset = createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-011",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-011",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        workflowTemplateId: "template-background-replace-v1",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        workflowTemplateVersionId: "template-background-replace-v1:rev-6",
        workflowTemplateVersionTag: "1.6.0",
        executionAdapterKind: "ComfyUI-Adapter",
        executionBackendFamily: "ComfyUI",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    });

    expect(asset.lineage.executionAdapterKind).toBe("comfyui-adapter");
    expect(asset.lineage.executionBackendFamily).toBe("comfyui");

    expect(() => createGeneratedResultAsset({
      resultAssetId: "asset-generated-result-012",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-012",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        workflowTemplateId: "template-background-replace-v1",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-001"],
        workflowTemplateVersionId: "template-background-replace-v1:rev-7",
        workflowTemplateVersionTag: "v1",
      },
      storageInstanceId: "storage-alpha",
      createdBy: "user-artist",
    })).toThrow("workflowTemplateVersionTag must use semantic version format");
  });

  it("blocks visibility mutation for archived generated result assets", () => {
    const archived = rehydrateGeneratedResultAsset({
      resultAssetId: "asset-generated-result-006",
      workspaceId: "workspace-alpha",
      source: {
        runId: "run-image-006",
        systemId: "system-image-editor",
        workflowId: "workflow-background-replace",
        outputSlot: "primary-image",
      },
      lineage: {
        inputAssetIds: ["asset-input-010"],
      },
      storageInstanceId: "storage-alpha",
      visibility: "workspace",
      lifecycle: {
        status: GeneratedResultAssetStatuses.archived,
        pendingSince: "2026-04-08T14:00:00.000Z",
        logicalAssetVersionId: "asset-generated-result-006:v1",
        persistedAt: "2026-04-08T14:01:00.000Z",
        persistedBy: "system-result-persistence",
        archivedAt: "2026-04-08T14:02:00.000Z",
        archivedBy: "user-admin",
      },
      createdBy: "user-artist",
      lastModifiedBy: "user-admin",
      createdAt: "2026-04-08T14:00:00.000Z",
      updatedAt: "2026-04-08T14:02:00.000Z",
    });

    expect(() => updateGeneratedResultAssetVisibility(archived, {
      visibility: "shared",
      sharingPolicyRef: {
        policyId: "policy-1",
      },
      actorUserId: "user-admin",
    })).toThrow(GeneratedResultAssetDomainError);
  });
});
