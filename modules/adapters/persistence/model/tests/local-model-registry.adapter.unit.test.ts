import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "../../../../testing/node-test";
import { createLocalModelRegistryAdapter } from "../createLocalModelRegistryAdapter";

describe("createLocalModelRegistryAdapter", () => {
  it("creates and saves remote model references", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-registry-"));
    const filePath = join(dir, "models.json");
    const adapter = createLocalModelRegistryAdapter({ filePath, now: () => "2026-04-27T00:00:00.000Z" });

    const saved = await adapter.saveModelReference({
      provider: "huggingface",
      modelId: "openai/demo-model",
      displayName: "Demo",
      taskTags: ["text-generation"],
      metadata: { likes: 1 },
    });

    expect(saved.model.modelRecordId.startsWith("model_")).toBe(true);
    expect(saved.model.lifecycleStatus).toBe("saved-reference");
    expect(saved.model.localPath).toBeUndefined();
  });

  it("lists with filter/search and updates/deletes records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-registry-"));
    const filePath = join(dir, "models.json");
    const adapter = createLocalModelRegistryAdapter({ filePath, now: () => "2026-04-27T00:00:00.000Z" });

    await adapter.registerDownloadedModel({
      modelRecordId: "m1",
      displayName: "Local Llama",
      source: "local",
      provider: "huggingface",
      artifactForm: "full-model",
      localPath: "/models/llama",
    });

    await adapter.registerGeneratedModel({
      modelRecordId: "m2",
      displayName: "Adapter Alpha",
      artifactForm: "adapter",
      localPath: "/models/adapter-alpha",
      baseModelId: "m1",
      generatedFromRunId: "run-1",
      metadata: { custom: { nested: true } },
    });

    const list = await adapter.listModels({ search: "adapter", source: "generated", limit: 10 });
    expect(list.models.map((model) => model.modelRecordId)).toEqual(["m2"]);

    const updated = await adapter.updateModelRecord({
      modelRecordId: "m2",
      patch: { validationStatus: "valid", validationReportPath: "/reports/m2.json" },
    });
    expect(updated.model.updatedAt).toBe("2026-04-27T00:00:00.000Z");
    expect(updated.model.validationStatus).toBe("valid");

    await adapter.deleteModelRecord({ modelRecordId: "m2" });
    const afterDelete = await adapter.listModels({ limit: 10 });
    expect(afterDelete.models.map((model) => model.modelRecordId)).toEqual(["m1"]);
  });

  it("preserves unknown root metadata and does not manage files directly", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-registry-"));
    const filePath = join(dir, "models.json");
    await writeFile(filePath, JSON.stringify({ schemaVersion: 3, models: [] }), "utf8");

    const adapter = createLocalModelRegistryAdapter({ filePath, now: () => "2026-04-27T00:00:00.000Z" });
    await adapter.saveModelReference({ provider: "huggingface", modelId: "org/demo", displayName: "Demo" });

    const document = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    expect(document.schemaVersion).toBe(3);

    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain("huggingface.token");
    expect(serialized).not.toContain("deleteFile");
    expect(serialized).not.toContain("unlink");
  });
});
