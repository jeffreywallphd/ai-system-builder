import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image storage lifecycle flow", () => {
  it("supports initialize/reset/archive/cleanup operations and enforces safe deletion guardrails", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const runtimeSystemId = `system:studio:${created.data!.draft!.draftId}`;
    const storage = await api.initializeReferenceImageStorage({
      systemId: runtimeSystemId,
      ownerKind: "system",
      ownerRole: "reference-image-runtime",
    });
    expect(storage.ok).toBeTrue();
    const instanceId = storage.data!.storage.instanceId;

    for (const operation of ["initialize", "reset", "cleanup", "archive"] as const) {
      const result = await api.manageReferenceImageStorageLifecycle({
        systemId: runtimeSystemId,
        storageInstanceId: instanceId,
        operation,
      });
      expect(result.ok).toBeTrue();
      expect(result.data?.storage.instanceId).toBe(instanceId);
    }

    const blockedDelete = await api.deleteReferenceImageStorage({
      systemId: runtimeSystemId,
      storageInstanceId: instanceId,
    });
    expect(blockedDelete.ok).toBeFalse();
    expect(blockedDelete.error?.message).toContain("attachments are present");
  });
});
