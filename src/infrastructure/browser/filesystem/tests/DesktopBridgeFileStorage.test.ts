import { describe, expect, it } from "bun:test";
import path from "node:path";
import { DesktopBridgeFileStorage } from "../DesktopBridgeFileStorage";
import type { DesktopModelFileBridge } from "../../../../electron/shared/DesktopContracts";

function createBridgeMock(): DesktopModelFileBridge {
  return {
    exists: () => true,
    stat: (modelPath) => ({
      path: modelPath,
      kind: "file",
      size: 16,
      modifiedAt: "2026-04-06T12:00:00.000Z",
    }),
    read: () => new Uint8Array([1, 2, 3]),
    write: () => undefined,
    delete: () => undefined,
    list: (modelPath) => Object.freeze([
      Object.freeze({
        path: modelPath ? `${modelPath}/nested/model.bin` : "nested/model.bin",
        kind: "file" as const,
        size: 5,
        modifiedAt: "2026-04-06T12:00:00.000Z",
      }),
    ]),
    move: () => undefined,
    copy: () => undefined,
  };
}

describe("DesktopBridgeFileStorage", () => {
  it("translates absolute managed-root paths to logical bridge paths", async () => {
    const rootDirectory = path.resolve(path.join(path.sep, "var", "lib", "ai-loom", "models"));
    const recorded: string[] = [];
    const bridge = createBridgeMock();
    bridge.exists = (modelPath: string) => {
      recorded.push(modelPath);
      return true;
    };

    const storage = new DesktopBridgeFileStorage(bridge, { rootDirectory });
    await storage.exists(path.join(rootDirectory, "llama", "model.gguf"));

    expect(recorded).toEqual(["llama/model.gguf"]);
  });

  it("translates logical bridge paths back to managed-root absolute paths", async () => {
    const rootDirectory = path.resolve(path.join(path.sep, "var", "lib", "ai-loom", "models"));
    const storage = new DesktopBridgeFileStorage(createBridgeMock(), { rootDirectory });

    const listed = await storage.list(path.join(rootDirectory, "llama"));
    expect(listed[0]?.path).toBe(path.resolve(rootDirectory, "llama", "nested", "model.bin"));
  });

  it("rejects absolute paths outside the configured managed root", async () => {
    const rootDirectory = path.resolve(path.join(path.sep, "var", "lib", "ai-loom", "models"));
    const storage = new DesktopBridgeFileStorage(createBridgeMock(), { rootDirectory });

    await expect(storage.exists(path.join(path.sep, "tmp", "outside.gguf"))).rejects.toThrow("outside the managed model root");
  });
});

