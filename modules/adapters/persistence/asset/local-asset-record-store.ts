import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AssetBinding, AssetComposition, AssetDefinition, AssetInstance } from "../../../contracts/asset";

export const ASSET_KERNEL_LOCAL_STORE_KIND = "asset-kernel-local-store" as const;
export const ASSET_KERNEL_LOCAL_SCHEMA_VERSION = 1 as const;

export interface LocalAssetKernelManifest {
  readonly schemaVersion: typeof ASSET_KERNEL_LOCAL_SCHEMA_VERSION;
  readonly storeKind: typeof ASSET_KERNEL_LOCAL_STORE_KIND;
  readonly updatedAt: string;
}

export interface LocalAssetKernelStoreSnapshot {
  readonly manifest: LocalAssetKernelManifest;
  readonly definitions: readonly AssetDefinition[];
  readonly instances: readonly AssetInstance[];
  readonly compositions: readonly AssetComposition[];
  readonly bindings: readonly AssetBinding[];
}

export interface LocalAssetRecordStoreOptions {
  readonly rootDir: string;
  readonly now?: () => string;
}

export class LocalAssetRecordStoreError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LocalAssetRecordStoreError";
    this.stack = undefined;
  }
}

type AssetKernelCollectionName = "definitions" | "instances" | "compositions" | "bindings";

interface AssetKernelCollectionMap {
  definitions: AssetDefinition;
  instances: AssetInstance;
  compositions: AssetComposition;
  bindings: AssetBinding;
}

const COLLECTION_FILES = {
  definitions: "definitions.json",
  instances: "instances.json",
  compositions: "compositions.json",
  bindings: "bindings.json",
} as const satisfies Record<AssetKernelCollectionName, string>;

export class LocalAssetRecordStore {
  private readonly storeDir: string;
  private readonly now: () => string;
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(options: LocalAssetRecordStoreOptions) {
    this.storeDir = join(options.rootDir, "asset-kernel");
    this.now = options.now ?? (() => new Date().toISOString());
  }

  public async initialize(): Promise<void> {
    await this.ensureStoreFiles();
  }

  public async readManifest(): Promise<LocalAssetKernelManifest> {
    await this.ensureStoreDirectory();
    return this.readJsonFile<LocalAssetKernelManifest>("manifest.json", this.createManifest());
  }

  public async readSnapshot(): Promise<LocalAssetKernelStoreSnapshot> {
    await this.ensureStoreFiles();
    const [manifest, definitions, instances, compositions, bindings] = await Promise.all([
      this.readManifest(),
      this.readCollection("definitions"),
      this.readCollection("instances"),
      this.readCollection("compositions"),
      this.readCollection("bindings"),
    ]);
    return { manifest, definitions, instances, compositions, bindings };
  }

  public async readCollection<Name extends AssetKernelCollectionName>(
    name: Name,
  ): Promise<readonly AssetKernelCollectionMap[Name][]> {
    await this.ensureStoreDirectory();
    return this.readJsonFile<readonly AssetKernelCollectionMap[Name][]>(COLLECTION_FILES[name], []);
  }

  public async writeCollection<Name extends AssetKernelCollectionName>(
    name: Name,
    records: readonly AssetKernelCollectionMap[Name][],
  ): Promise<void> {
    const writeOperation = this.writeQueue.then(
      () => this.writeCollectionNow(name, records),
      () => this.writeCollectionNow(name, records),
    );
    this.writeQueue = writeOperation.catch(() => undefined);
    await writeOperation;
  }

  private async writeCollectionNow<Name extends AssetKernelCollectionName>(
    name: Name,
    records: readonly AssetKernelCollectionMap[Name][],
  ): Promise<void> {
    await this.ensureStoreDirectory();
    await this.writeJsonFile(COLLECTION_FILES[name], cloneJson(records));
    await this.writeJsonFile("manifest.json", this.createManifest());
  }

  private async ensureStoreFiles(): Promise<void> {
    await this.ensureStoreDirectory();
    await this.ensureJsonFile("manifest.json", this.createManifest());
    await Promise.all(
      (Object.keys(COLLECTION_FILES) as AssetKernelCollectionName[]).map((name) =>
        this.ensureJsonFile(COLLECTION_FILES[name], []),
      ),
    );
  }

  private async ensureStoreDirectory(): Promise<void> {
    await mkdir(this.storeDir, { recursive: true });
  }

  private async ensureJsonFile(fileName: string, fallback: unknown): Promise<void> {
    try {
      await this.readJsonFile(fileName, fallback);
    } catch (error) {
      if (error instanceof LocalAssetRecordStoreError) throw error;
      throw error;
    }

    try {
      await readFile(this.filePath(fileName), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.writeJsonFile(fileName, fallback);
    }
  }

  private async readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
    try {
      const source = await readFile(this.filePath(fileName), "utf8");
      const parsed = JSON.parse(source) as unknown;
      return cloneJson(parsed) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return cloneJson(fallback);
      }
      if (error instanceof SyntaxError) {
        throw new LocalAssetRecordStoreError("Asset Kernel local store contains malformed JSON.", { cause: error });
      }
      throw new LocalAssetRecordStoreError("Asset Kernel local store could not be read.", { cause: error });
    }
  }

  private async writeJsonFile(fileName: string, value: unknown): Promise<void> {
    const path = this.filePath(fileName);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await rename(temporaryPath, path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw new LocalAssetRecordStoreError("Asset Kernel local store could not be written.", { cause: error });
    }
  }

  private createManifest(): LocalAssetKernelManifest {
    return {
      schemaVersion: ASSET_KERNEL_LOCAL_SCHEMA_VERSION,
      storeKind: ASSET_KERNEL_LOCAL_STORE_KIND,
      updatedAt: this.now(),
    };
  }

  private filePath(fileName: string): string {
    return join(this.storeDir, fileName);
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
