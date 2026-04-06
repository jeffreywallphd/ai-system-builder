import { describe, expect, it } from "bun:test";
import path from "node:path";
import { resolveModelFileAbsolutePath, toLogicalModelPath } from "../ModelFilePathPolicy";

describe("ModelFilePathPolicy", () => {
  const root = path.join(path.sep, "var", "lib", "ai-loom", "models");

  it("resolves logical model paths under the managed root", () => {
    const resolved = resolveModelFileAbsolutePath(root, "llama-3/weights/model.gguf");
    expect(resolved).toBe(path.resolve(root, "llama-3", "weights", "model.gguf"));
  });

  it("rejects absolute model path input", () => {
    expect(() => resolveModelFileAbsolutePath(root, "/tmp/model.gguf")).toThrow("relative to the managed model root");
    expect(() => resolveModelFileAbsolutePath(root, "C:/models/model.gguf")).toThrow("relative to the managed model root");
  });

  it("rejects traversal model path input", () => {
    expect(() => resolveModelFileAbsolutePath(root, "../outside/model.gguf")).toThrow("traversal");
    expect(() => resolveModelFileAbsolutePath(root, "nested/../../outside")).toThrow("traversal");
  });

  it("converts absolute paths to logical paths", () => {
    const absolute = path.resolve(root, "family", "model.bin");
    expect(toLogicalModelPath(root, absolute)).toBe("family/model.bin");
  });

  it("rejects absolute paths outside the managed root", () => {
    expect(() => toLogicalModelPath(root, path.join(path.sep, "tmp", "model.bin"))).toThrow("escapes the managed model root");
  });
});

