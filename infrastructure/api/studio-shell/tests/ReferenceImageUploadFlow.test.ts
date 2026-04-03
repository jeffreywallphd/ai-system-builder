import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

describe("Reference image upload flow", () => {
  it("ingests uploaded files into the reference-image system input dataset instance", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId,
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

    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "demo.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });

    expect(upload.ok).toBeTrue();
    expect(upload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:input");
    expect(upload.data?.recordId).toContain("record:");
    expect(upload.data?.image.assetId).toContain("generated-output:storage-instance://");
    expect(upload.data?.image.width).toBeGreaterThan(0);
    expect(upload.data?.image.height).toBeGreaterThan(0);
  });
});
