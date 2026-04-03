import { describe, expect, it } from "bun:test";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "../../../studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "../../../../application/system-studio/ReferenceImageSystemTemplate";

const TinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=";

describe("Reference image FaceID dataset flow", () => {
  it("ingests and retrieves optional FaceID reference images through dataset bindings", async () => {
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

    const inputUpload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "input.png",
      mimeType: "image/png",
      payloadBase64: TinyPngBase64,
    });
    expect(inputUpload.ok).toBeTrue();
    expect(inputUpload.data?.datasetBindingId).toBe("input-image-dataset");
    expect(inputUpload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:input");

    const referenceUpload = await api.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      fileName: "face-reference.png",
      mimeType: "image/png",
      payloadBase64: TinyPngBase64,
      targetDatasetBindingId: "reference-image-dataset",
    });
    expect(referenceUpload.ok).toBeTrue();
    expect(referenceUpload.data?.datasetBindingId).toBe("reference-image-dataset");
    expect(referenceUpload.data?.datasetInstanceId).toBe("dataset-instance:reference-image:faceid");

    const listed = await api.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      datasetBindingId: "reference-image-dataset",
      limit: 10,
      offset: 0,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.summary.datasetInstanceId).toBe("dataset-instance:reference-image:faceid");
    expect(listed.data?.summary.totalItems).toBe(1);
    expect(listed.data?.items[0]?.image.recordId).toBe(referenceUpload.data?.recordId);

    const item = await api.getReferenceImageDatasetItem({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      datasetBindingId: "reference-image-dataset",
      recordId: referenceUpload.data!.recordId,
    });
    expect(item.ok).toBeTrue();
    expect(item.data?.image.recordId).toBe(referenceUpload.data?.recordId);
    expect(item.data?.dataset.instanceId).toBe("dataset-instance:reference-image:faceid");
  });
});
