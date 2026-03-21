import { FileStorageEntryInfo, FileStorageReadResult } from "../../../application/ports/FileStorage";
import type {
  IFileStorage,
  IFileStorageCopyRequest,
  IFileStorageEntryInfo,
  IFileStorageListOptions,
  IFileStorageMoveRequest,
  IFileStorageReadResult,
  IFileStorageWriteRequest,
} from "../../../application/ports/interfaces/IFileStorage";
import type { DesktopModelFileBridge } from "../../../electron/shared/DesktopContracts";

export class DesktopBridgeFileStorage implements IFileStorage {
  constructor(private readonly bridge: DesktopModelFileBridge) {}

  public async exists(path: string): Promise<boolean> {
    return this.bridge.exists(path);
  }

  public async stat(path: string): Promise<IFileStorageEntryInfo> {
    const entry = this.bridge.stat(path);
    return new FileStorageEntryInfo({ path: entry.path, kind: entry.kind, sizeBytes: entry.size, updatedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : undefined });
  }

  public async read(path: string): Promise<IFileStorageReadResult> {
    return new FileStorageReadResult({ path, content: this.bridge.read(path) });
  }

  public async readText(path: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    return new TextDecoder(encoding === "utf-8" ? "utf-8" : undefined).decode(this.bridge.read(path));
  }

  public async write(request: IFileStorageWriteRequest): Promise<void> {
    const content = typeof request.content === "string"
      ? new TextEncoder().encode(request.content)
      : request.content;
    this.bridge.write({
      path: request.path,
      content,
      overwrite: request.overwrite,
      createDirectories: request.createDirectories,
    });
  }

  public async delete(path: string): Promise<void> {
    this.bridge.delete(path);
  }

  public async createDirectory(path: string): Promise<void> {
    this.bridge.write({ path: `${path.replace(/\/$/, "")}/.keep`, content: new Uint8Array(), overwrite: true, createDirectories: true });
    this.bridge.delete(`${path.replace(/\/$/, "")}/.keep`);
  }

  public async list(path: string, options: IFileStorageListOptions = {}): Promise<ReadonlyArray<IFileStorageEntryInfo>> {
    return Object.freeze(this.bridge.list(path, options).map((entry) => new FileStorageEntryInfo({ path: entry.path, kind: entry.kind, sizeBytes: entry.size, updatedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : undefined })));
  }

  public async move(request: IFileStorageMoveRequest): Promise<void> {
    this.bridge.move({ from: request.fromPath, to: request.toPath, overwrite: request.overwrite });
  }

  public async copy(request: IFileStorageCopyRequest): Promise<void> {
    this.bridge.copy({ from: request.fromPath, to: request.toPath, overwrite: request.overwrite });
  }
}
