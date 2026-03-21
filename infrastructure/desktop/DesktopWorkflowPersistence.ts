import fs from "node:fs";
import path from "node:path";
import { SqliteWorkflowIndexDatabase } from "../filesystem/SqliteWorkflowIndexDatabase";
import type { WorkflowRecord } from "../workflows/WorkflowPersistenceCodec";
import { WorkflowPersistenceCodec } from "../workflows/WorkflowPersistenceCodec";

export interface DesktopWorkflowPersistenceOptions {
  readonly workflowsDirectory: string;
  readonly indexDatabasePath: string;
}

export class DesktopWorkflowPersistence {
  private readonly codec = new WorkflowPersistenceCodec();
  private readonly index: SqliteWorkflowIndexDatabase;

  constructor(private readonly options: DesktopWorkflowPersistenceOptions) {
    this.index = new SqliteWorkflowIndexDatabase(options.indexDatabasePath);
    this.initialize();
  }

  public saveWorkflowRecord(recordJson: string): void {
    const record = JSON.parse(recordJson) as WorkflowRecord;
    const filePath = this.resolveWorkflowPath(record.id);
    fs.mkdirSync(this.options.workflowsDirectory, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
    this.index.upsert(record, filePath);
  }

  public loadWorkflowRecord(id: string): string | null {
    const filePath = this.resolveWorkflowPath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, "utf-8");
  }

  public listWorkflowSummaries(): ReadonlyArray<string> {
    return this.index.list().map((summary) => JSON.stringify(summary));
  }

  public deleteWorkflowRecord(id: string): void {
    const filePath = this.resolveWorkflowPath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.index.delete(id);
  }

  public workflowExists(id: string): boolean {
    return this.index.exists(id) || fs.existsSync(this.resolveWorkflowPath(id));
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
      degraded: false,
      detail: "Canonical workflow JSON is stored on disk and indexed in SQLite.",
    };
  }

  private initialize(): void {
    fs.mkdirSync(this.options.workflowsDirectory, { recursive: true });
    this.index.initialize();
    const entries = fs.existsSync(this.options.workflowsDirectory)
      ? fs.readdirSync(this.options.workflowsDirectory, { withFileTypes: true })
      : [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(this.options.workflowsDirectory, entry.name);
      const record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as WorkflowRecord;
      this.index.upsert(record, filePath);
    }
  }

  private resolveWorkflowPath(id: string): string {
    const workflowId = id.trim();
    if (!workflowId) {
      throw new Error("Workflow ID cannot be empty.");
    }

    return path.join(this.options.workflowsDirectory, `${workflowId}.json`);
  }
}
