import { describe, expect, it } from "bun:test";
import { Model, ModelArtifact, ModelSource } from "../../../domain/models/Model";
import { ModelCompatibility } from "../../../domain/models/ModelCompatibility";
import type { IFileStorage } from "../../../application/ports/interfaces/IFileStorage";
import { HuggingFaceModelDownloader } from "../HuggingFaceModelDownloader";

class InMemoryFileStorage implements IFileStorage {
  public writes: Array<{ path: string; size: number; overwrite?: boolean; createDirectories?: boolean }> = [];

  public async exists(): Promise<boolean> { return false; }
  public async stat() { return { path: "", kind: "missing" as const }; }
  public async read() { throw new Error("not needed"); }
  public async readText() { throw new Error("not needed"); }
  public async write(request: { path: string; content: Uint8Array | string; createDirectories?: boolean; overwrite?: boolean; }): Promise<void> {
    const size = typeof request.content === "string" ? request.content.length : request.content.byteLength;
    this.writes.push({ path: request.path, size, overwrite: request.overwrite, createDirectories: request.createDirectories });
  }
  public async delete(): Promise<void> {}
  public async createDirectory(): Promise<void> {}
  public async list() { return []; }
  public async move(): Promise<void> {}
  public async copy(): Promise<void> {}
}

describe("HuggingFaceModelDownloader", () => {
  it("downloads a resolved file and writes it to storage", async () => {
    const apiClient = {
      resolveDownloadFile: async () => ({
        path: "weights/model.safetensors",
        sizeBytes: 3,
        sha256: undefined,
        downloadUrl: "https://example.test/model.safetensors",
      }),
      downloadToBuffer: async () => new Uint8Array([1, 2, 3]),
    } as any;

    const fileStorage = new InMemoryFileStorage();
    const downloader = new HuggingFaceModelDownloader({
      apiClient,
      fileStorage,
      createId: () => "op-test",
    });

    const model = new Model({
      id: "org/model",
      name: "model",
      kind: "completion-model",
      source: new ModelSource({ type: "huggingface", repository: "org/model" }),
      artifact: new ModelArtifact({ name: "model.safetensors", accessMethod: "remote-download", location: "weights/model.safetensors" }),
      compatibility: ModelCompatibility.any(),
      tags: [],
      languageCodes: [],
    });

    const handle = await downloader.startDownload({
      model,
      destination: "/tmp/models/",
      verifyIntegrity: false,
      overwrite: true,
    });

    const result = await handle.waitForCompletion();

    expect(result.status).toBe("completed");
    expect(fileStorage.writes[0]?.path).toBe("/tmp/models/model.safetensors");
    expect(fileStorage.writes[0]?.size).toBe(3);
    expect(fileStorage.writes[0]?.overwrite).toBeTrue();
    expect(fileStorage.writes[0]?.createDirectories).toBeTrue();
  });
});
