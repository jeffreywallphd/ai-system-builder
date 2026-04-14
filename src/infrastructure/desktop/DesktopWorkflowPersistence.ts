import fs from "node:fs";
import path from "node:path";
import { SqliteWorkflowIndexDatabase } from "../filesystem/SqliteWorkflowIndexDatabase";
import type { WorkflowRecord } from "../workflows/WorkflowPersistenceCodec";
import { WorkflowPersistenceCodec } from "../workflows/WorkflowPersistenceCodec";

export interface DesktopWorkflowPersistenceOptions {
  readonly workflowsDirectory: string;
  readonly indexDatabasePath: string;
  readonly createIndexDatabase?: (databasePath: string) => WorkflowIndexDatabase;
}

interface WorkflowIndexDatabase {
  initialize(): void;
  upsert(record: WorkflowRecord, sourcePath: string): void;
  list(): ReadonlyArray<{ readonly id: string }>;
  delete(id: string): void;
  exists(id: string): boolean;
}

export class DesktopWorkflowPersistence {
  private readonly codec = new WorkflowPersistenceCodec();
  private readonly index: WorkflowIndexDatabase;
  private indexDegraded = false;
  private indexDetail = "Canonical workflow JSON is stored on disk and indexed in SQLite.";

  constructor(private readonly options: DesktopWorkflowPersistenceOptions) {
    this.index = (options.createIndexDatabase ?? ((databasePath) => new SqliteWorkflowIndexDatabase(databasePath)))(
      options.indexDatabasePath,
    );
    this.initialize();
  }

  public saveWorkflowRecord(recordJson: string): void {
    const record = JSON.parse(recordJson) as WorkflowRecord;
    const filePath = this.resolveWorkflowPath(record.id);
    fs.mkdirSync(this.options.workflowsDirectory, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
    this.tryIndexOperation(() => this.index.upsert(record, filePath), "save workflow records");
  }

  public loadWorkflowRecord(id: string): string | null {
    const filePath = this.resolveWorkflowPath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, "utf-8");
  }

  public listWorkflowSummaries(): ReadonlyArray<string> {
    if (!this.indexDegraded) {
      try {
        return this.index.list().map((summary) => JSON.stringify(summary));
      } catch (error) {
        this.markIndexDegraded(error, "list workflow summaries");
      }
    }

    return this.listWorkflowSummariesFromCanonicalJson();
  }

  public deleteWorkflowRecord(id: string): void {
    const filePath = this.resolveWorkflowPath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.tryIndexOperation(() => this.index.delete(id), "delete workflow records");
  }

  public workflowExists(id: string): boolean {
    if (!this.indexDegraded) {
      try {
        return this.index.exists(id) || fs.existsSync(this.resolveWorkflowPath(id));
      } catch (error) {
        this.markIndexDegraded(error, "check workflow index existence");
      }
    }

    return fs.existsSync(this.resolveWorkflowPath(id));
  }

  public getWorkflowPersistenceStatus(): {
    readonly provider: string;
    readonly workflowsDirectory: string;
    readonly indexDatabasePath: string;
    readonly degraded: boolean;
    readonly detail: string;
  } {
    return {
      provider: "desktop-filesystem-indexed",
      workflowsDirectory: this.options.workflowsDirectory,
      indexDatabasePath: this.options.indexDatabasePath,
      degraded: this.indexDegraded,
      detail: this.indexDetail,
    };
  }

  private initialize(): void {
    fs.mkdirSync(this.options.workflowsDirectory, { recursive: true });
    try {
      this.index.initialize();
    } catch (error) {
      this.markIndexDegraded(error, "initialize SQLite workflow index");
      return;
    }

    const entries = fs.existsSync(this.options.workflowsDirectory)
      ? fs.readdirSync(this.options.workflowsDirectory, { withFileTypes: true })
      : [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(this.options.workflowsDirectory, entry.name);
      const record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as WorkflowRecord;
      this.tryIndexOperation(() => this.index.upsert(record, filePath), "synchronize canonical workflow JSON into SQLite index");
    }
  }

  private listWorkflowSummariesFromCanonicalJson(): ReadonlyArray<string> {
    const entries = fs.existsSync(this.options.workflowsDirectory)
      ? fs.readdirSync(this.options.workflowsDirectory, { withFileTypes: true })
      : [];
    const summaries = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => {
        const filePath = path.join(this.options.workflowsDirectory, entry.name);
        const record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as WorkflowRecord;
        return this.codec.toSummary(record, "desktop-filesystem-json-fallback");
      })
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    return summaries.map((summary) => JSON.stringify(summary));
  }

  private tryIndexOperation(operation: () => void, activity: string): void {
    if (this.indexDegraded) {
      return;
    }

    try {
      operation();
    } catch (error) {
      this.markIndexDegraded(error, activity);
    }
  }

  private markIndexDegraded(error: unknown, activity: string): void {
    this.indexDegraded = true;
    const message = error instanceof Error ? error.message : String(error);
    this.indexDetail = `SQLite index unavailable (${activity}). Falling back to canonical workflow JSON scan. ${message}`;
  }

  private resolveWorkflowPath(id: string): string {
    const workflowId = id.trim();
    if (!workflowId) {
      throw new Error("Workflow ID cannot be empty.");
    }

    return path.join(this.options.workflowsDirectory, `${workflowId}.json`);
  }
}
