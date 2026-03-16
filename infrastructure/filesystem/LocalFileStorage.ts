import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  IFileStorage,
  IFileStorageCopyRequest,
  IFileStorageEntryInfo,
  IFileStorageListOptions,
  IFileStorageMoveRequest,
  IFileStorageReadResult,
  IFileStorageWriteRequest,
} from "../../application/ports/interfaces/IFileStorage";

function normalizePath(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("File path cannot be empty.");
  }

  return normalized;
}

function toEntryKind(stats: Awaited<ReturnType<typeof fs.stat>>): IFileStorageEntryInfo["kind"] {
  if (stats.isFile()) {
    return "file";
  }

  if (stats.isDirectory()) {
    return "directory";
  }

  return "unknown";
}

export class LocalFileStorage implements IFileStorage {
  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(normalizePath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  public async stat(filePath: string): Promise<IFileStorageEntryInfo> {
    const normalizedPath = normalizePath(filePath);

    try {
      const stats = await fs.stat(normalizedPath);

      return Object.freeze({
        path: normalizedPath,
        kind: toEntryKind(stats),
        sizeBytes: stats.isFile() ? stats.size : undefined,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      });
    } catch (error: unknown) {
      if (isNodeError(error, "ENOENT")) {
        return Object.freeze({
          path: normalizedPath,
          kind: "missing",
        });
      }

      throw error;
    }
  }

  public async read(filePath: string): Promise<IFileStorageReadResult> {
    const normalizedPath = normalizePath(filePath);
    const content = await fs.readFile(normalizedPath);

    return Object.freeze({
      path: normalizedPath,
      content: new Uint8Array(content),
    });
  }

  public async readText(filePath: string, encoding = "utf-8"): Promise<string> {
    const normalizedPath = normalizePath(filePath);
    return fs.readFile(normalizedPath, { encoding: encoding as BufferEncoding });
  }

  public async write(request: IFileStorageWriteRequest): Promise<void> {
    const normalizedPath = normalizePath(request.path);

    if (request.createDirectories) {
      await fs.mkdir(path.dirname(normalizedPath), { recursive: true });
    }

    if (!request.overwrite && (await this.exists(normalizedPath))) {
      throw new Error(`File '${normalizedPath}' already exists.`);
    }

    const content =
      typeof request.content === "string"
        ? request.content
        : Buffer.from(request.content);

    await fs.writeFile(normalizedPath, content);
  }

  public async delete(filePath: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const info = await this.stat(normalizedPath);

    if (info.kind === "missing") {
      return;
    }

    if (info.kind === "directory") {
      await fs.rm(normalizedPath, { recursive: true, force: true });
      return;
    }

    await fs.unlink(normalizedPath);
  }

  public async createDirectory(filePath: string): Promise<void> {
    await fs.mkdir(normalizePath(filePath), { recursive: true });
  }

  public async list(
    filePath: string,
    options: IFileStorageListOptions = {}
  ): Promise<ReadonlyArray<IFileStorageEntryInfo>> {
    const normalizedPath = normalizePath(filePath);
    const results: IFileStorageEntryInfo[] = [];
    const limit = options.limit && options.limit > 0 ? options.limit : undefined;

    const walk = async (currentPath: string): Promise<void> => {
      if (limit !== undefined && results.length >= limit) {
        return;
      }

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!options.includeHidden && entry.name.startsWith(".")) {
          continue;
        }

        const entryPath = path.join(currentPath, entry.name);
        const stats = await fs.stat(entryPath);

        results.push(
          Object.freeze({
            path: entryPath,
            kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "unknown",
            sizeBytes: entry.isFile() ? stats.size : undefined,
            createdAt: stats.birthtime,
            updatedAt: stats.mtime,
          })
        );

        if (limit !== undefined && results.length >= limit) {
          return;
        }

        if (options.recursive && entry.isDirectory()) {
          await walk(entryPath);

          if (limit !== undefined && results.length >= limit) {
            return;
          }
        }
      }
    };

    const rootInfo = await this.stat(normalizedPath);

    if (rootInfo.kind === "missing") {
      return Object.freeze([]);
    }

    if (rootInfo.kind !== "directory") {
      throw new Error(`Path '${normalizedPath}' is not a directory.`);
    }

    await walk(normalizedPath);

    return Object.freeze(results);
  }

  public async move(request: IFileStorageMoveRequest): Promise<void> {
    const fromPath = normalizePath(request.fromPath);
    const toPath = normalizePath(request.toPath);

    if (!(await this.exists(fromPath))) {
      throw new Error(`Source path '${fromPath}' does not exist.`);
    }

    if (request.createDirectories) {
      await fs.mkdir(path.dirname(toPath), { recursive: true });
    }

    if (!request.overwrite && (await this.exists(toPath))) {
      throw new Error(`Destination path '${toPath}' already exists.`);
    }

    if (request.overwrite && (await this.exists(toPath))) {
      await this.delete(toPath);
    }

    await fs.rename(fromPath, toPath);
  }

  public async copy(request: IFileStorageCopyRequest): Promise<void> {
    const fromPath = normalizePath(request.fromPath);
    const toPath = normalizePath(request.toPath);

    if (!(await this.exists(fromPath))) {
      throw new Error(`Source path '${fromPath}' does not exist.`);
    }

    if (request.createDirectories) {
      await fs.mkdir(path.dirname(toPath), { recursive: true });
    }

    if (!request.overwrite && (await this.exists(toPath))) {
      throw new Error(`Destination path '${toPath}' already exists.`);
    }

    if (request.overwrite && (await this.exists(toPath))) {
      await this.delete(toPath);
    }

    const info = await this.stat(fromPath);

    if (info.kind === "directory") {
      await copyDirectory(fromPath, toPath);
      return;
    }

    await fs.copyFile(fromPath, toPath);
  }
}

async function copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function isNodeError(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return !!error && typeof error === "object" && "code" in error && error.code === code;
}
