import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

import type { ExecutionPlanRecord } from "../../../contracts/execution-plans";

export const EXECUTION_PLAN_LOCAL_STORE_KIND = "execution-plan-local-store" as const;
export const EXECUTION_PLAN_LOCAL_SCHEMA_VERSION = 1 as const;

export interface LocalExecutionPlanManifest {
  readonly schemaVersion: typeof EXECUTION_PLAN_LOCAL_SCHEMA_VERSION;
  readonly storeKind: typeof EXECUTION_PLAN_LOCAL_STORE_KIND;
  readonly updatedAt: string;
}

export interface LocalExecutionPlanRecordStoreOptions { readonly rootDir: string; readonly now?: () => string; }

export class LocalExecutionPlanRecordStoreError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message); this.name = "LocalExecutionPlanRecordStoreError";
    if (options && "cause" in options) (this as Error & { cause?: unknown }).cause = options.cause;
    this.stack = undefined;
  }
}

export class LocalExecutionPlanRecordStore {
  private readonly storeDir: string; private readonly now: () => string; private writeQueue: Promise<void> = Promise.resolve();
  public constructor(options: LocalExecutionPlanRecordStoreOptions) { this.storeDir = join(options.rootDir, "execution-plans"); this.now = options.now ?? (() => new Date().toISOString()); }
  public async readManifest(): Promise<LocalExecutionPlanManifest> { await this.ensureStoreFiles(); return validateManifest(await this.readJsonFile("manifest.json", this.createManifest())); }
  public async readPlans(): Promise<readonly ExecutionPlanRecord[]> { await this.ensureStoreFiles(); return this.readJsonFile("execution-plans.json", []); }
  public async writePlans(records: readonly ExecutionPlanRecord[]): Promise<void> {
    const op = this.writeQueue.then(() => this.writePlansNow(records), () => this.writePlansNow(records)); this.writeQueue = op.catch(() => undefined); await op;
  }
  private async writePlansNow(records: readonly ExecutionPlanRecord[]): Promise<void> { await this.ensureStoreFiles(); assertJsonCompatible(records); await this.writeJsonFile("execution-plans.json", cloneJson(records)); await this.writeJsonFile("manifest.json", this.createManifest()); }
  private async ensureStoreFiles(): Promise<void> { await mkdir(this.storeDir, { recursive: true }); await this.ensureJsonFile("manifest.json", this.createManifest()); await this.ensureJsonFile("execution-plans.json", []); }
  private async ensureJsonFile(file: string, fallback: unknown): Promise<void> { const value = await this.readJsonFile(file, fallback); if (file === "manifest.json") validateManifest(value); else if (!Array.isArray(value)) throw new LocalExecutionPlanRecordStoreError("Execution plan local store collection is invalid."); try { await readFile(this.path(file), "utf8"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; await this.writeJsonFile(file, fallback);} }
  private async readJsonFile<T>(file: string, fallback: T): Promise<T> { try { return cloneJson(JSON.parse(await readFile(this.path(file), "utf8")) as unknown) as T; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return cloneJson(fallback); if (e instanceof SyntaxError) throw new LocalExecutionPlanRecordStoreError("Execution plan local store contains malformed JSON.", { cause: e }); throw new LocalExecutionPlanRecordStoreError("Execution plan local store could not be read.", { cause: e }); } }
  private async writeJsonFile(file: string, value: unknown): Promise<void> { const path = this.path(file); const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`; try { await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(tmp, path); } catch (e) { await unlink(tmp).catch(() => undefined); throw new LocalExecutionPlanRecordStoreError("Execution plan local store could not be written.", { cause: e }); } }
  private createManifest(): LocalExecutionPlanManifest { return { schemaVersion: EXECUTION_PLAN_LOCAL_SCHEMA_VERSION, storeKind: EXECUTION_PLAN_LOCAL_STORE_KIND, updatedAt: this.now() }; }
  private path(file: string): string { return join(this.storeDir, file); }
}

function validateManifest(value: unknown): LocalExecutionPlanManifest { if (!value || typeof value !== "object") throw new LocalExecutionPlanRecordStoreError("Execution plan local store manifest is invalid."); const m = value as Record<string, unknown>; if (m.schemaVersion !== EXECUTION_PLAN_LOCAL_SCHEMA_VERSION || m.storeKind !== EXECUTION_PLAN_LOCAL_STORE_KIND || typeof m.updatedAt !== "string") throw new LocalExecutionPlanRecordStoreError("Execution plan local store manifest is invalid."); return m as LocalExecutionPlanManifest; }
export function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function assertJsonCompatible(v: unknown): void { try { const s = JSON.stringify(v); if (typeof s !== "string") throw new Error(); } catch { throw new LocalExecutionPlanRecordStoreError("Execution plan local store accepts JSON-compatible records only."); } }
