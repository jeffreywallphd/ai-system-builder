import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  createHuggingFaceModelBrowseDetailsAdapter,
  type CreateHuggingFaceModelBrowseDetailsAdapterOptions,
} from "../createHuggingFaceModelBrowseDetailsAdapter";

function createHubClientDouble(overrides: Partial<NonNullable<CreateHuggingFaceModelBrowseDetailsAdapterOptions["hubClient"]>> = {}) {
  return {
    listModels: testDouble.fn(async function* () {
      yield {
        id: "openai/demo-model",
        author: "openai",
        pipeline_tag: "text-generation",
        tags: ["text-generation", "chat"],
        downloads: 123,
        likes: 45,
        private: false,
        gated: false,
        lastModified: "2026-04-20T00:00:00.000Z",
        cardData: { license: "apache-2.0", summary: "A demo model" },
      };
    }),
    modelInfo: testDouble.fn(async () => ({
      id: "openai/demo-model",
      author: "openai",
      pipeline_tag: "text-generation",
      tags: ["text-generation", "chat"],
      cardData: { content: "# Demo model", license: "apache-2.0" },
      license: "apache-2.0",
      description: "Demo",
      siblings: [
        { rfilename: "model.safetensors", size: 1024, blobId: "blob-1", lfs: { sha256: "abc" } },
        { rfilename: "tokenizer.json", size: 512 },
        { rfilename: "adapter_config.json", size: 12 },
      ],
      config: { architectures: ["DemoModel"] },
      sha: "sha123",
    })),
    ...overrides,
  };
}

describe("createHuggingFaceModelBrowseDetailsAdapter", () => {
  it("maps browse response to model browse contracts", async () => {
    const hubClient = createHubClientDouble();
    const adapter = createHuggingFaceModelBrowseDetailsAdapter({ hubClient });

    const result = await adapter.browseModels({ provider: "huggingface", query: "demo", limit: 25 });

    expect(result.models.length).toBe(1);
    expect(result.models[0]).toMatchObject({
      provider: "huggingface",
      modelId: "openai/demo-model",
      displayName: "demo-model",
      authorOrOrg: "openai",
      downloads: 123,
      likes: 45,
      inferenceMode: "causal",
    });
  });

  it("prefers human-readable repository ids over opaque provider ids", async () => {
    const hubClient = createHubClientDouble({
      listModels: testDouble.fn(async function* () {
        yield {
          id: "69e864fd6b68f7e6cfc63ca3",
          modelId: "sentence-transformers/all-MiniLM-L6-v2",
          name: "sentence-transformers/all-MiniLM-L6-v2",
          downloads: 137784,
          likes: 3003,
        };
      }),
    });
    const adapter = createHuggingFaceModelBrowseDetailsAdapter({ hubClient });

    const result = await adapter.browseModels({ provider: "huggingface", limit: 25 });

    expect(result.models[0]?.modelId).toBe("sentence-transformers/all-MiniLM-L6-v2");
    expect(result.models[0]?.displayName).toBe("all-MiniLM-L6-v2");
    expect(result.models[0]?.authorOrOrg).toBe("sentence-transformers");
  });

  it("maps model details and infers file availability flags", async () => {
    const hubClient = createHubClientDouble();
    const adapter = createHuggingFaceModelBrowseDetailsAdapter({ hubClient });

    const result = await adapter.getModelDetails({ provider: "huggingface", modelId: "openai/demo-model" });

    expect(result.model.files).toEqual([
      { path: "model.safetensors", sizeBytes: 1024, blobId: "blob-1", lfs: true },
      { path: "tokenizer.json", sizeBytes: 512, blobId: undefined, lfs: false },
      { path: "adapter_config.json", sizeBytes: 12, blobId: undefined, lfs: false },
    ]);
    expect(result.model.safetensorsAvailable).toBe(true);
    expect(result.model.tokenizerAvailable).toBe(true);
    expect(result.model.adapterAvailable).toBe(true);
    expect(result.model.recommendedInferenceMode).toBe("causal");
  });

  it("handles missing optional metadata gracefully", async () => {
    const hubClient = createHubClientDouble({
      modelInfo: testDouble.fn(async () => ({
        id: "openai/minimal",
        siblings: [],
      })),
    });
    const adapter = createHuggingFaceModelBrowseDetailsAdapter({ hubClient });

    const result = await adapter.getModelDetails({ provider: "huggingface", modelId: "openai/minimal" });

    expect(result.model.modelId).toBe("openai/minimal");
    expect(result.model.tags).toBeUndefined();
    expect(result.model.tokenizerAvailable).toBeUndefined();
    expect(result.model.safetensorsAvailable).toBeUndefined();
  });

  it("passes access token when configured", async () => {
    const hubClient = createHubClientDouble();
    const adapter = createHuggingFaceModelBrowseDetailsAdapter({
      hubClient,
      accessTokenProvider: () => "token-xyz",
    });

    await adapter.browseModels({ provider: "huggingface", query: "demo", limit: 25 });

    const listModelsCall = hubClient.listModels.mock.calls[0]?.[0] as { accessToken?: string };
    expect(listModelsCall.accessToken).toBe("token-xyz");
  });

  it("maps not found and unauthorized errors to clear messages", async () => {
    const notFoundAdapter = createHuggingFaceModelBrowseDetailsAdapter({
      hubClient: createHubClientDouble({
        modelInfo: testDouble.fn(async () => {
          throw { statusCode: 404 };
        }),
      }),
    });

    await expect(notFoundAdapter.getModelDetails({ provider: "huggingface", modelId: "missing/model" }))
      .rejects
      .toThrow("model was not found");

    const unauthorizedAdapter = createHuggingFaceModelBrowseDetailsAdapter({
      hubClient: createHubClientDouble({
        listModels: testDouble.fn(async () => {
          throw { statusCode: 401 };
        }),
      }),
    });

    await expect(unauthorizedAdapter.browseModels({ provider: "huggingface", query: "demo", limit: 25 }))
      .rejects
      .toThrow("unauthorized or access denied");
  });
});
