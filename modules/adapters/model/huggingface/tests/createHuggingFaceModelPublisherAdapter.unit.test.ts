import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { createHuggingFaceModelPublisherAdapter } from "../createHuggingFaceModelPublisherAdapter";

describe("createHuggingFaceModelPublisherAdapter", () => {
  it("uploads safetensors model directory files", async () => {
    const root = join(tmpdir(), `hf-publish-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "config.json"), "{}", "utf8");
    await writeFile(join(root, "model.safetensors"), "tensor", "utf8");

    const uploadFile = testDouble.fn(async () => undefined);
    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile } });

    const result = await adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" });
    expect(result.published).toBe(true);
    expect(uploadFile.mock.calls.length).toBe(2);
  });

  it("rejects partial adapter output", async () => {
    const root = join(tmpdir(), `hf-publish-partial-adapter-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "adapter_model.safetensors"), "tensor", "utf8");

    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile: testDouble.fn(async () => undefined) } });
    await expect(adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" })).rejects.toThrow(
      /requires both adapter_config\.json and adapter_model\.safetensors/i,
    );
  });

  it("rejects missing shard index when shard files are present", async () => {
    const root = join(tmpdir(), `hf-publish-missing-index-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "model-00001-of-00002.safetensors"), "tensor", "utf8");
    await writeFile(join(root, "model-00002-of-00002.safetensors"), "tensor", "utf8");
    await writeFile(join(root, "config.json"), "{}", "utf8");

    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile: testDouble.fn(async () => undefined) } });
    await expect(adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" })).rejects.toThrow(
      /requires model\.safetensors\.index\.json/i,
    );
  });

  it("rejects missing shard referenced by index", async () => {
    const root = join(tmpdir(), `hf-publish-missing-shard-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "config.json"), "{}", "utf8");
    await writeFile(
      join(root, "model.safetensors.index.json"),
      JSON.stringify({ weight_map: { "layer.0": "model-00001-of-00002.safetensors", "layer.1": "model-00002-of-00002.safetensors" } }),
      "utf8",
    );
    await writeFile(join(root, "model-00001-of-00002.safetensors"), "tensor", "utf8");

    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile: testDouble.fn(async () => undefined) } });
    await expect(adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" })).rejects.toThrow(
      /missing shard file referenced by index/i,
    );
  });

  it("rejects full model without config", async () => {
    const root = join(tmpdir(), `hf-publish-missing-config-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "model.safetensors"), "tensor", "utf8");

    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile: testDouble.fn(async () => undefined) } });
    await expect(adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" })).rejects.toThrow(
      /requires config\.json/i,
    );
  });

  it("publishes valid adapter directory files", async () => {
    const root = join(tmpdir(), `hf-publish-valid-adapter-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "adapter_config.json"), "{}", "utf8");
    await writeFile(join(root, "adapter_model.safetensors"), "tensor", "utf8");
    await writeFile(join(root, "tokenizer.json"), "{}", "utf8");

    const uploadFile = testDouble.fn(async () => undefined);
    const adapter = createHuggingFaceModelPublisherAdapter({ client: { uploadFile } });
    await adapter.publishModel({ modelRecordId: "m1", modelPath: root, repository: "owner/repo" });

    const uploadedPaths = uploadFile.mock.calls.map((call) => call[0].path).sort();
    expect(uploadedPaths).toEqual(["adapter_config.json", "adapter_model.safetensors", "tokenizer.json"]);
  });
});
