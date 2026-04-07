import path from "node:path";
import { FileStorageEntryInfo, FileStorageReadResult } from "@application/ports/FileStorage";
import type {
  IFileStorage,
  IFileStorageCopyRequest,
  IFileStorageEntryInfo,
  IFileStorageListOptions,
  IFileStorageMoveRequest,
  IFileStorageReadResult,
  IFileStorageWriteRequest,
} from "@application/ports/interfaces/IFileStorage";
import type { DesktopModelFileBridge } from "../../../electron/shared/DesktopContracts";

export class DesktopBridgeFileStorage implements IFileStorage {
  constructor(
    private readonly bridge: DesktopModelFileBridge,
    private readonly options: { readonly rootDirectory?: string } = {},
  ) {}

  private toBridgePath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (!this.options.rootDirectory) {
      return trimmed.split("\\").join("/");
    }

    if (path.isAbsolute(trimmed)) {
      const relative = path.relative(this.options.rootDirectory, trimmed);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Path '${trimmed}' is outside the managed model root.`);
      }
      return relative.split(path.sep).join("/");
    }

    return trimmed.split("\\").join("/");
  }

  private fromBridgePath(value: string): string {
    if (!this.options.rootDirectory) {
      return value;
    }
    return value ? path.resolve(this.options.rootDirectory, ...value.split("/")) : this.options.rootDirectory;
  }

  public async exists(path: string): Promise<boolean> {
    return this.bridge.exists(this.toBridgePath(path));
  }

  public async stat(path: string): Promise<IFileStorageEntryInfo> {
    const entry = this.bridge.stat(this.toBridgePath(path));
    return new FileStorageEntryInfo({
      path: this.fromBridgePath(entry.path),
      kind: entry.kind,
      sizeBytes: entry.size,
      updatedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : undefined,
    });
  }

  public async read(path: string): Promise<IFileStorageReadResult> {
    return new FileStorageReadResult({ path, content: this.bridge.read(this.toBridgePath(path)) });
  }

  public async readText(path: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    return new TextDecoder(encoding === "utf-8" ? "utf-8" : undefined).decode(this.bridge.read(this.toBridgePath(path)));
  }

  public async write(request: IFileStorageWriteRequest): Promise<void> {
    const content = typeof request.content === "string"
      ? new TextEncoder().encode(request.content)
      : request.content;
    this.bridge.write({
      path: this.toBridgePath(request.path),
      content,
      overwrite: request.overwrite,
      createDirectories: request.createDirectories,
    });
  }

  public async delete(path: string): Promise<void> {
    this.bridge.delete(this.toBridgePath(path));
  }

  public async createDirectory(path: string): Promise<void> {
    const normalized = this.toBridgePath(path).replace(/\/$/, "");
    const markerPath = normalized ? `${normalized}/.keep` : ".keep";
    this.bridge.write({ path: markerPath, content: new Uint8Array(), overwrite: true, createDirectories: true });
    this.bridge.delete(markerPath);
  }

  public async list(path: string, options: IFileStorageListOptions = {}): Promise<ReadonlyArray<IFileStorageEntryInfo>> {
    return Object.freeze(this.bridge.list(this.toBridgePath(path), options).map((entry) => new FileStorageEntryInfo({
      path: this.fromBridgePath(entry.path),
      kind: entry.kind,
      sizeBytes: entry.size,
      updatedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : undefined,
    })));
  }

  public async move(request: IFileStorageMoveRequest): Promise<void> {
    this.bridge.move({
      from: this.toBridgePath(request.fromPath),
      to: this.toBridgePath(request.toPath),
      overwrite: request.overwrite,
    });
  }

  public async copy(request: IFileStorageCopyRequest): Promise<void> {
    this.bridge.copy({
      from: this.toBridgePath(request.fromPath),
      to: this.toBridgePath(request.toPath),
      overwrite: request.overwrite,
    });
  }
}

