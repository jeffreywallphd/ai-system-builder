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
});
