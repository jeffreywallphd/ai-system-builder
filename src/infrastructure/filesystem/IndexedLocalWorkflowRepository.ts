import path from "node:path";
import type { IWorkflowRecordSummary, IWorkflowRepository } from "@application/ports/interfaces/IWorkflowRepository";
import type { IFileStorage } from "@application/ports/interfaces/IFileStorage";
import type { INodeCatalogProvider } from "@application/ports/interfaces/INodeCatalogProvider";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import { LocalWorkflowRepository } from "./LocalWorkflowRepository";
import { SqliteWorkflowIndexDatabase } from "./SqliteWorkflowIndexDatabase";
import { WorkflowPersistenceCodec, type WorkflowRecord } from "../workflows/WorkflowPersistenceCodec";

export interface IndexedLocalWorkflowRepositoryOptions {
  readonly fileStorage: IFileStorage;
  readonly nodeCatalogProvider: INodeCatalogProvider;
  readonly rootDirectory: string;
  readonly indexDatabasePath: string;
}

export class IndexedLocalWorkflowRepository implements IWorkflowRepository {
  private readonly codec = new WorkflowPersistenceCodec();
  private readonly localRepository: LocalWorkflowRepository;
  private readonly fileStorage: IFileStorage;
  private readonly rootDirectory: string;
  private readonly index: SqliteWorkflowIndexDatabase;
  private syncPromise?: Promise<void>;

  constructor(options: IndexedLocalWorkflowRepositoryOptions) {
    this.localRepository = new LocalWorkflowRepository(options);
    this.fileStorage = options.fileStorage;
    this.rootDirectory = options.rootDirectory.trim();
    this.index = new SqliteWorkflowIndexDatabase(options.indexDatabasePath);
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    await this.ensureSynchronized();
    const saved = await this.localRepository.save(workflow);
    this.index.upsert(this.codec.toRecord(saved), this.resolveWorkflowPath(saved.id));
    return saved;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    await this.ensureSynchronized();
    return this.localRepository.load(id);
  }

  public async delete(id: string): Promise<void> {
    await this.ensureSynchronized();
    await this.localRepository.delete(id);
    this.index.delete(id);
  }

  public async exists(id: string): Promise<boolean> {
    await this.ensureSynchronized();
    return this.index.exists(id) || this.localRepository.exists(id);
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    await this.ensureSynchronized();
    return this.index.list();
  }

  private async ensureSynchronized(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = this.performInitialSync();
    }

    await this.syncPromise;
  }

  private async performInitialSync(): Promise<void> {
    this.index.initialize();
    const info = await this.fileStorage.stat(this.rootDirectory);

    if (info.kind === "missing") {
      await this.fileStorage.write({
        path: path.join(this.rootDirectory, ".keep"),
        content: "",
        createDirectories: true,
        overwrite: true,
      });
      await this.fileStorage.delete(path.join(this.rootDirectory, ".keep"));
      return;
    }

    const entries = await this.fileStorage.list(this.rootDirectory, { recursive: false, includeHidden: false });
    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const content = await this.fileStorage.readText(entry.path, "utf-8");
      const record = JSON.parse(content) as WorkflowRecord;
      this.index.upsert(record, entry.path);
    }
  }

  private resolveWorkflowPath(id: string): string {
    return path.join(this.rootDirectory, `${id.trim()}.json`);
  }
}

