export type FileStorageEntryKind = "file" | "directory" | "missing" | "unknown";

export interface IFileStorageEntryInfo {
  readonly path: string;
  readonly kind: FileStorageEntryKind;

  /**
   * Optional size in bytes for file entries.
   */
  readonly sizeBytes?: number;

  /**
   * Optional timestamps when available.
   */
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface IFileStorageReadResult {
  readonly path: string;

  /**
   * Raw bytes for binary-safe handling.
   */
  readonly content: Uint8Array;
}

export interface IFileStorageWriteRequest {
  readonly path: string;
  readonly content: Uint8Array | string;

  /**
   * Whether parent directories should be created automatically.
   */
  readonly createDirectories?: boolean;

  /**
   * Whether existing content may be overwritten.
   */
  readonly overwrite?: boolean;
}

export interface IFileStorageMoveRequest {
  readonly fromPath: string;
  readonly toPath: string;
  readonly overwrite?: boolean;
  readonly createDirectories?: boolean;
}

export interface IFileStorageCopyRequest {
  readonly fromPath: string;
  readonly toPath: string;
  readonly overwrite?: boolean;
  readonly createDirectories?: boolean;
}

export interface IFileStorageListOptions {
  /**
   * Whether listing should recurse into subdirectories.
   */
  readonly recursive?: boolean;

  /**
   * Whether hidden entries should be included.
   */
  readonly includeHidden?: boolean;

  /**
   * Maximum number of entries to return.
   */
  readonly limit?: number;
}

export interface IFileStorage {
  /**
   * Returns whether the path exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Returns information about a file or directory.
   */
  stat(path: string): Promise<IFileStorageEntryInfo>;

  /**
   * Reads file contents as raw bytes.
   */
  read(path: string): Promise<IFileStorageReadResult>;

  /**
   * Reads file contents as text using the requested encoding.
   */
  readText(path: string, encoding?: string): Promise<string>;

  /**
   * Writes bytes or text to storage.
   */
  write(request: IFileStorageWriteRequest): Promise<void>;

  /**
   * Deletes a file or directory.
   * Implementations may define how directory deletion behaves.
   */
  delete(path: string): Promise<void>;

  /**
   * Creates a directory if it does not already exist.
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Lists entries beneath a directory.
   */
  list(
    path: string,
    options?: IFileStorageListOptions
  ): Promise<ReadonlyArray<IFileStorageEntryInfo>>;

  /**
   * Moves/renames an entry.
   */
  move(request: IFileStorageMoveRequest): Promise<void>;

  /**
   * Copies an entry.
   */
  copy(request: IFileStorageCopyRequest): Promise<void>;
}
