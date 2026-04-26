import { describe, expect, it } from "../../../../testing/node-test";

import { DefaultModelDefaultResolver } from "../default-model-default-resolver";
import type { ApplicationSettingsPort } from "../../../ports/settings";

function createSettingsPort(values: Record<string, unknown>): ApplicationSettingsPort {
  return {
    async listDefinitions() {
      return [];
    },
    async readValues(request) {
      return (request.keys ?? []).map((key) => ({
        key,
        configured: key in values,
        value: values[key],
      }));
    },
    async updateValue(request) {
      return { key: request.key, configured: true, value: request.value };
    },
    async clearValue(request) {
      return { key: request.key, configured: false };
    },
  };
}

describe("DefaultModelDefaultResolver", () => {
  it("uses feature override first", async () => {
    const resolver = new DefaultModelDefaultResolver({
      settings: createSettingsPort({
        "features.datasetPreparation.qaGeneration.default": {
          modelId: "feature/model",
          inferenceMode: "chat",
        },
      }),
    });

    const resolved = await resolver.resolve({ taskKey: "qaGeneration", featureKey: "datasetPreparation" });
    expect(resolved.source).toBe("feature");
    expect(resolved.modelId).toBe("feature/model");
    expect(resolved.inferenceMode).toBe("chat");
  });

  it("falls back to task default", async () => {
    const resolver = new DefaultModelDefaultResolver({
      settings: createSettingsPort({
        "models.tasks.qaGeneration.default": {
          modelId: "task/model",
          inferenceMode: "causal",
        },
      }),
    });

    const resolved = await resolver.resolve({ taskKey: "qaGeneration", featureKey: "datasetPreparation" });
    expect(resolved.source).toBe("task");
    expect(resolved.modelId).toBe("task/model");
  });

  it("falls back to global default", async () => {
    const resolver = new DefaultModelDefaultResolver({
      settings: createSettingsPort({
        "models.default": {
          modelId: "global/model",
          inferenceMode: "text2text",
        },
      }),
    });

    const resolved = await resolver.resolve({ taskKey: "qaGeneration" });
    expect(resolved.source).toBe("global");
    expect(resolved.modelId).toBe("global/model");
  });

  it("falls back to builtin default", async () => {
    const resolver = new DefaultModelDefaultResolver({ settings: createSettingsPort({}) });
    const resolved = await resolver.resolve({ taskKey: "qaGeneration" });

    expect(resolved.source).toBe("builtin");
    expect(resolved.modelId).toBe("google/flan-t5-small");
    expect(resolved.inferenceMode).toBe("text2text");
  });

  it("requires inferenceMode on configured values and skips invalid entries", async () => {
    const resolver = new DefaultModelDefaultResolver({
      settings: createSettingsPort({
        "models.tasks.qaGeneration.default": {
          modelId: "task/model-without-mode",
        },
        "models.default": {
          modelId: "global/model",
          inferenceMode: "causal",
        },
      }),
    });

    const resolved = await resolver.resolve({ taskKey: "qaGeneration" });
    expect(resolved.source).toBe("global");
    expect(resolved.modelId).toBe("global/model");
    expect(resolved.inferenceMode).toBe("causal");
  });
});

  it("uses deterministic fallback order feature -> task -> global -> builtin", async () => {
    const resolver = new DefaultModelDefaultResolver({
      settings: createSettingsPort({
        "features.datasetPreparation.qaGeneration.default": { modelId: "", inferenceMode: "chat" },
        "models.tasks.qaGeneration.default": { modelId: "task/model", inferenceMode: "chat" },
        "models.default": { modelId: "global/model", inferenceMode: "causal" },
      }),
    });

    const resolved = await resolver.resolve({ taskKey: "qaGeneration", featureKey: "datasetPreparation" });
    expect(resolved.source).toBe("task");
    expect(resolved.modelId).toBe("task/model");
    expect(resolved.inferenceMode).toBe("chat");
  });
