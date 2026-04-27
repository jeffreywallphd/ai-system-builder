import { describe, expect, it, vi, afterEach } from "vitest";

import { createDesktopModelsClient } from "../api/desktopModelsClient";

describe("desktop models client", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("delegates model browse/details/save/list/delete through preload bridge", async () => {
    window.desktopApi = {
      uploadArtifact: vi.fn(),
      getArtifactUploadPolicy: vi.fn(),
      browseArtifacts: vi.fn(),
      readArtifactDetail: vi.fn(),
      readArtifactContentDescriptor: vi.fn(),
      readArtifactViewerMedia: vi.fn(),
      publishArtifactToRepo: vi.fn(),
      verifyPublishedArtifactBacking: vi.fn(),
      registerArtifactFromRepo: vi.fn(),
      localizeArtifactFromRepo: vi.fn(),
      browseModels: vi.fn().mockResolvedValue({ ok: true, value: { models: [{ provider: "huggingface", modelId: "org/model", displayName: "Model" }] } }),
      getModelDetails: vi.fn().mockResolvedValue({ ok: true, value: { model: { provider: "huggingface", modelId: "org/model", displayName: "Model" } } }),
      listModels: vi.fn().mockResolvedValue({ ok: true, value: { models: [] } }),
      saveModelReference: vi.fn().mockResolvedValue({
        ok: true,
        value: { model: { modelRecordId: "m1", displayName: "Model", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", modelId: "org/model", createdAt: "2026-04-27T00:00:00.000Z" } },
      }),
      updateModelRecord: vi.fn().mockResolvedValue({
        ok: true,
        value: { model: { modelRecordId: "m1", displayName: "Model", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", modelId: "org/model", createdAt: "2026-04-27T00:00:00.000Z" } },
      }),
      deleteModelRecord: vi.fn().mockResolvedValue({
        ok: true,
        value: { deletedModelRecordId: "m1", deletedRegistryRecord: true, deletedLocalFiles: false, deletedBackingArtifactIds: [] },
      }),
    } as never;

    const client = createDesktopModelsClient();
    await client.browseModels({ provider: "huggingface", query: "org/model" });
    await client.getModelDetails({ provider: "huggingface", modelId: "org/model" });
    await client.listModels();
    await client.saveModelReference({ modelId: "org/model", displayName: "Model" });
    await client.updateModelRecord({ modelRecordId: "m1", patch: { validationStatus: "valid" } });
    await client.deleteModelRecord({ modelRecordId: "m1" });

    expect(window.desktopApi.browseModels).toHaveBeenCalled();
    expect(window.desktopApi.getModelDetails).toHaveBeenCalledWith({ provider: "huggingface", modelId: "org/model" });
    expect(window.desktopApi.saveModelReference).toHaveBeenCalledWith(expect.objectContaining({ provider: "huggingface", modelId: "org/model" }));
    expect(window.desktopApi.deleteModelRecord).toHaveBeenCalledWith({ modelRecordId: "m1" });
  });
});
