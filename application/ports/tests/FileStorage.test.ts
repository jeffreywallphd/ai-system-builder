import { describe, expect, it } from "bun:test";
import {
  FileStorage,
  FileStorageCopyRequest,
  FileStorageEntryInfo,
  FileStorageMoveRequest,
  FileStorageReadResult,
  FileStorageWriteRequest,
} from "../FileStorage";
import type { IFileStorage, IFileStorageReadResult } from "../interfaces/IFileStorage";

class MemoryStorage implements IFileStorage {
  public readonly name: string;
  public readonly files = new Map<string, Uint8Array>();

  constructor(name: string, initial: Record<string, string> = {}) {
    this.name = name;
    Object.entries(initial).forEach(([path, content]) => {
      this.files.set(path, new TextEncoder().encode(content));
    });
  }

  async exists(path: string): Promise<boolean> { return this.files.has(path); }
  async stat(path: string): Promise<FileStorageEntryInfo> { return new FileStorageEntryInfo({ path, kind: this.files.has(path) ? "file" : "missing" }); }
  async read(path: string): Promise<IFileStorageReadResult> { return { path, content: this.files.get(path) ?? new Uint8Array() }; }
  async readText(path: string): Promise<string> { return new TextDecoder().decode(this.files.get(path)); }
  async write(request: { path: string; content: Uint8Array | string }): Promise<void> {
    this.files.set(request.path, typeof request.content === "string" ? new TextEncoder().encode(request.content) : new Uint8Array(request.content));
  }
  async delete(path: string): Promise<void> { this.files.delete(path); }
  async createDirectory(): Promise<void> {}
  async list(path: string): Promise<ReadonlyArray<FileStorageEntryInfo>> {
    return [...this.files.keys()].filter((p) => p.startsWith(path)).map((p) => new FileStorageEntryInfo({ path: p, kind: "file" }));
  }
  async move(request: { fromPath: string; toPath: string }): Promise<void> {
    const content = this.files.get(request.fromPath);
    if (content) this.files.set(request.toPath, content);
    this.files.delete(request.fromPath);
  }
  async copy(request: { fromPath: string; toPath: string }): Promise<void> {
    const content = this.files.get(request.fromPath);
    if (content) this.files.set(request.toPath, new Uint8Array(content));
  }
}

describe("FileStorage value objects", () => {
  it("normalizes and clones inputs", () => {
    const date = new Date();
    const entry = new FileStorageEntryInfo({ path: " /x ", kind: "file", sizeBytes: 3, createdAt: date, updatedAt: date });
    const read = new FileStorageReadResult({ path: " /a ", content: new Uint8Array([1, 2]) });
    const write = new FileStorageWriteRequest({ path: " /w ", content: new Uint8Array([3]) });
    const move = new FileStorageMoveRequest({ fromPath: " /f ", toPath: " /t " });
    const copy = new FileStorageCopyRequest({ fromPath: " /f ", toPath: " /t " });

    expect(entry.path).toBe("/x");
    expect(read.path).toBe("/a");
    expect(write.path).toBe("/w");
    expect(move.fromPath).toBe("/f");
    expect(copy.toPath).toBe("/t");
    expect(() => new FileStorageEntryInfo({ path: "/x", kind: "file", sizeBytes: -1 })).toThrow();
  });
});

describe("FileStorage", () => {
  it("resolves providers, reads, writes and lists", async () => {
    const one = new MemoryStorage("one", { "/one.txt": "1" });
    const two = new MemoryStorage("two", { "/two.txt": "2" });
    const storage = new FileStorage([one, two]);

    expect(await storage.exists("/one.txt")).toBeTrue();
    expect(await storage.exists("/missing.txt")).toBeFalse();
    expect(await storage.readText("/two.txt")).toBe("2");

    await storage.write({ path: "/new.txt", content: "new" });
    expect(await one.exists("/new.txt")).toBeTrue();

    const listed = await storage.list("/one.txt");
    expect(listed.length).toBeGreaterThan(0);
  });

  it("moves and copies across providers when needed", async () => {
    const one = new MemoryStorage("one", { "/src.txt": "source" });
    const two = new MemoryStorage("two", { "/dest/existing.txt": "x" });
    const storage = new FileStorage([one, two]);

    await storage.copy({ fromPath: "/src.txt", toPath: "/dest/copied.txt" });
    expect(await one.exists("/dest/copied.txt")).toBeTrue();

    await storage.move({ fromPath: "/src.txt", toPath: "/dest/moved.txt" });
    expect(await one.exists("/src.txt")).toBeFalse();
    expect(await one.exists("/dest/moved.txt")).toBeTrue();
  });

  it("throws helpful errors for invalid paths and missing providers", async () => {
    const storage = new FileStorage();

    expect(storage.stat("/x")).rejects.toThrow("No file storage provider contains path '/x'.");
    expect(storage.write({ path: "/x", content: "x" })).rejects.toThrow("No file storage providers are configured.");
    expect(storage.exists("  ")).rejects.toThrow("Path cannot be empty.");
  });

  it("falls through providers when one throws exists", async () => {
    const broken: IFileStorage = {
      exists: async () => { throw new Error("boom"); },
      stat: async () => ({ path: "/x", kind: "file" }),
      read: async () => ({ path: "/x", content: new Uint8Array() }),
      readText: async () => "",
      write: async () => {},
      delete: async () => {},
      createDirectory: async () => {},
      list: async () => [],
      move: async () => {},
      copy: async () => {},
    };
    const good = new MemoryStorage("good", { "/x": "1" });
    const storage = new FileStorage([broken, good]);

    expect(await storage.exists("/x")).toBeTrue();
  });
});
