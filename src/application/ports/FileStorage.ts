import type {
  IFileStorage,
  IFileStorageCopyRequest,
  IFileStorageEntryInfo,
  IFileStorageListOptions,
  IFileStorageMoveRequest,
  IFileStorageReadResult,
  IFileStorageWriteRequest,
} from "./interfaces/IFileStorage";

function normalizePath(path: string): string {
  const normalized = path.trim();

  if (!normalized) {
    throw new Error("Path cannot be empty.");
  }

  return normalized;
}

function normalizeEncoding(encoding?: string): string {
  return (encoding?.trim() || "utf-8").toLowerCase();
}

export class FileStorageEntryInfo implements IFileStorageEntryInfo {
  public readonly path: string;
  public readonly kind: IFileStorageEntryInfo["kind"];
  public readonly sizeBytes?: number;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(params: {
    path: string;
    kind: IFileStorageEntryInfo["kind"];
    sizeBytes?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.path = normalizePath(params.path);
    this.kind = params.kind;
    this.sizeBytes = params.sizeBytes;
    this.createdAt = params.createdAt
      ? new Date(params.createdAt.getTime())
      : undefined;
    this.updatedAt = params.updatedAt
      ? new Date(params.updatedAt.getTime())
      : undefined;

    if (this.sizeBytes !== undefined && this.sizeBytes < 0) {
      throw new Error("FileStorageEntryInfo.sizeBytes cannot be negative.");
    }
  }

  public static from(info: IFileStorageEntryInfo): FileStorageEntryInfo {
    return new FileStorageEntryInfo({
      path: info.path,
      kind: info.kind,
      sizeBytes: info.sizeBytes,
      createdAt: info.createdAt,
      updatedAt: info.updatedAt,
    });
  }
}

export class FileStorageReadResult implements IFileStorageReadResult {
  public readonly path: string;
  public readonly content: Uint8Array;

  constructor(params: { path: string; content: Uint8Array }) {
    this.path = normalizePath(params.path);
    this.content = new Uint8Array(params.content);
  }

  public static from(result: IFileStorageReadResult): FileStorageReadResult {
    return new FileStorageReadResult({
      path: result.path,
      content: result.content,
    });
  }
}

export class FileStorageWriteRequest implements IFileStorageWriteRequest {
  public readonly path: string;
  public readonly content: Uint8Array | string;
  public readonly createDirectories?: boolean;
  public readonly overwrite?: boolean;

  constructor(params: IFileStorageWriteRequest) {
    this.path = normalizePath(params.path);
    this.content =
      typeof params.content === "string"
        ? params.content
        : new Uint8Array(params.content);
    this.createDirectories = params.createDirectories;
    this.overwrite = params.overwrite;
  }

  public static from(request: IFileStorageWriteRequest): FileStorageWriteRequest {
    return new FileStorageWriteRequest(request);
  }
}

export class FileStorageMoveRequest implements IFileStorageMoveRequest {
  public readonly fromPath: string;
  public readonly toPath: string;
  public readonly overwrite?: boolean;
  public readonly createDirectories?: boolean;

  constructor(params: IFileStorageMoveRequest) {
    this.fromPath = normalizePath(params.fromPath);
    this.toPath = normalizePath(params.toPath);
    this.overwrite = params.overwrite;
    this.createDirectories = params.createDirectories;
  }

  public static from(request: IFileStorageMoveRequest): FileStorageMoveRequest {
    return new FileStorageMoveRequest(request);
  }
}

export class FileStorageCopyRequest implements IFileStorageCopyRequest {
  public readonly fromPath: string;
  public readonly toPath: string;
  public readonly overwrite?: boolean;
  public readonly createDirectories?: boolean;

  constructor(params: IFileStorageCopyRequest) {
    this.fromPath = normalizePath(params.fromPath);
    this.toPath = normalizePath(params.toPath);
    this.overwrite = params.overwrite;
    this.createDirectories = params.createDirectories;
  }

  public static from(request: IFileStorageCopyRequest): FileStorageCopyRequest {
    return new FileStorageCopyRequest(request);
  }
}

export class FileStorage implements IFileStorage {
  private readonly providers: ReadonlyArray<IFileStorage>;

  constructor(providers: ReadonlyArray<IFileStorage> = []) {
    this.providers = Object.freeze([...providers]);
  }

  public async exists(path: string): Promise<boolean> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveProviderForPath(normalizedPath, false);

    if (!provider) {
      return false;
    }

    return provider.exists(normalizedPath);
  }

  public async stat(path: string): Promise<IFileStorageEntryInfo> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveProviderForPath(normalizedPath, true);
    return FileStorageEntryInfo.from(await provider.stat(normalizedPath));
  }

  public async read(path: string): Promise<IFileStorageReadResult> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveProviderForPath(normalizedPath, true);
    return FileStorageReadResult.from(await provider.read(normalizedPath));
  }

  public async readText(path: string, encoding?: string): Promise<string> {
    const result = await this.read(path);

    if (typeof TextDecoder === "undefined") {
      throw new Error("TextDecoder is not available in this runtime.");
    }

    return new TextDecoder(normalizeEncoding(encoding)).decode(result.content);
  }

  public async write(request: IFileStorageWriteRequest): Promise<void> {
    const normalizedRequest = FileStorageWriteRequest.from(request);
    const provider = await this.resolveWritableProvider(normalizedRequest.path);
    await provider.write(normalizedRequest);
  }

  public async delete(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveProviderForPath(normalizedPath, true);
    await provider.delete(normalizedPath);
  }

  public async createDirectory(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveWritableProvider(normalizedPath);
    await provider.createDirectory(normalizedPath);
  }

  public async list(
    path: string,
    options?: IFileStorageListOptions
  ): Promise<ReadonlyArray<IFileStorageEntryInfo>> {
    const normalizedPath = normalizePath(path);
    const provider = await this.resolveProviderForPath(normalizedPath, true);
    const entries = await provider.list(normalizedPath, options);
    return Object.freeze(entries.map((entry) => FileStorageEntryInfo.from(entry)));
  }

  public async move(request: IFileStorageMoveRequest): Promise<void> {
    const normalizedRequest = FileStorageMoveRequest.from(request);
    const sourceProvider = await this.resolveProviderForPath(
      normalizedRequest.fromPath,
      true
    );
    const destinationProvider = await this.resolveWritableProvider(
      normalizedRequest.toPath
    );

    if (sourceProvider === destinationProvider) {
      await sourceProvider.move(normalizedRequest);
      return;
    }

    const content = await sourceProvider.read(normalizedRequest.fromPath);
    await destinationProvider.write({
      path: normalizedRequest.toPath,
      content: content.content,
      overwrite: normalizedRequest.overwrite,
      createDirectories: normalizedRequest.createDirectories,
    });
    await sourceProvider.delete(normalizedRequest.fromPath);
  }

  public async copy(request: IFileStorageCopyRequest): Promise<void> {
    const normalizedRequest = FileStorageCopyRequest.from(request);
    const sourceProvider = await this.resolveProviderForPath(
      normalizedRequest.fromPath,
      true
    );
    const destinationProvider = await this.resolveWritableProvider(
      normalizedRequest.toPath
    );

    if (sourceProvider === destinationProvider) {
      await sourceProvider.copy(normalizedRequest);
      return;
    }

    const content = await sourceProvider.read(normalizedRequest.fromPath);
    await destinationProvider.write({
      path: normalizedRequest.toPath,
      content: content.content,
      overwrite: normalizedRequest.overwrite,
      createDirectories: normalizedRequest.createDirectories,
    });
  }

  private async resolveProviderForPath(
    path: string,
    requireExists: boolean
  ): Promise<IFileStorage | undefined> {
    for (const provider of this.providers) {
      try {
        const exists = await provider.exists(path);
        if (exists) {
          return provider;
        }
      } catch {
        // ignore and try next provider
      }
    }

    if (requireExists) {
      throw new Error(`No file storage provider contains path '${path}'.`);
    }

    return undefined;
  }

  private async resolveWritableProvider(path: string): Promise<IFileStorage> {
    const existingProvider = await this.resolveProviderForPath(path, false);
    if (existingProvider) {
      return existingProvider;
    }

    if (this.providers.length === 0) {
      throw new Error("No file storage providers are configured.");
    }

    return this.providers[0];
  }
}
