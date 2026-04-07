import {
  DeploymentLogLevels,
  type DeploymentLogEntry,
  type DeploymentDiagnosticRecord,
  type DeploymentLogLevel,
} from "@domain/deployment/DeploymentDiagnosticsDomain";
import type { DeploymentStateTransition } from "@domain/deployment/DeploymentStateDomain";

export interface DeploymentDiagnosticsRepository {
  appendLog(entry: DeploymentLogEntry): DeploymentLogEntry;
  appendDiagnostic(record: DeploymentDiagnosticRecord): DeploymentDiagnosticRecord;
  listLogs(deploymentId: string): ReadonlyArray<DeploymentLogEntry>;
  listDiagnostics(deploymentId: string): ReadonlyArray<DeploymentDiagnosticRecord>;
}

export interface DeploymentDiagnosticsQueryOptions {
  readonly limit?: number;
}

const MAX_QUERY_LIMIT = 500;


export class InMemoryDeploymentDiagnosticsRepository implements DeploymentDiagnosticsRepository {
  private readonly logsByDeployment = new Map<string, Array<DeploymentLogEntry>>();
  private readonly diagnosticsByDeployment = new Map<string, Array<DeploymentDiagnosticRecord>>();

  public appendLog(entry: DeploymentLogEntry): DeploymentLogEntry {
    const existing = this.logsByDeployment.get(entry.deploymentId) ?? [];
    existing.push(entry);
    this.logsByDeployment.set(entry.deploymentId, existing);
    return entry;
  }

  public appendDiagnostic(record: DeploymentDiagnosticRecord): DeploymentDiagnosticRecord {
    const existing = this.diagnosticsByDeployment.get(record.deploymentId) ?? [];
    existing.push(record);
    this.diagnosticsByDeployment.set(record.deploymentId, existing);
    return record;
  }

  public listLogs(deploymentId: string): ReadonlyArray<DeploymentLogEntry> {
    return Object.freeze([...(this.logsByDeployment.get(deploymentId.trim()) ?? [])]);
  }

  public listDiagnostics(deploymentId: string): ReadonlyArray<DeploymentDiagnosticRecord> {
    return Object.freeze([...(this.diagnosticsByDeployment.get(deploymentId.trim()) ?? [])]);
  }
}

export class DeploymentDiagnosticsService {
  public constructor(
    private readonly repository: DeploymentDiagnosticsRepository = new InMemoryDeploymentDiagnosticsRepository(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public logEvent(input: {
    readonly deploymentId: string;
    readonly eventKind: string;
    readonly message: string;
    readonly level?: DeploymentLogLevel;
    readonly transitionId?: string;
    readonly details?: Readonly<Record<string, string>>;
  }): DeploymentLogEntry {
    const timestamp = this.clock().toISOString();
    const entry = Object.freeze({
      entryId: `${input.deploymentId}:log:${timestamp}:${input.eventKind}`,
      deploymentId: input.deploymentId,
      level: input.level ?? DeploymentLogLevels.info,
      eventKind: input.eventKind,
      message: input.message,
      timestamp,
      transitionId: input.transitionId,
      details: input.details,
    } satisfies DeploymentLogEntry);

    return this.repository.appendLog(entry);
  }

  public logStateTransition(input: { readonly deploymentId: string; readonly transition: DeploymentStateTransition }): DeploymentLogEntry {
    return this.logEvent({
      deploymentId: input.deploymentId,
      eventKind: "state-transition",
      message: input.transition.fromState
        ? `Deployment state changed from '${input.transition.fromState}' to '${input.transition.toState}'.`
        : `Deployment state initialized as '${input.transition.toState}'.`,
      transitionId: input.transition.transitionId,
      details: Object.freeze({
        toState: input.transition.toState,
        fromState: input.transition.fromState ?? "",
      }),
    });
  }

  public recordFailure(input: {
    readonly deploymentId: string;
    readonly eventKind: string;
    readonly code: string;
    readonly summary: string;
    readonly details?: Readonly<Record<string, string>>;
  }): DeploymentDiagnosticRecord {
    const timestamp = this.clock().toISOString();
    const record = Object.freeze({
      diagnosticId: `${input.deploymentId}:diagnostic:${timestamp}:${input.code}`,
      deploymentId: input.deploymentId,
      timestamp,
      code: input.code,
      summary: input.summary,
      severity: "error" as const,
      eventKind: input.eventKind,
      details: input.details,
    } satisfies DeploymentDiagnosticRecord);

    this.repository.appendDiagnostic(record);
    this.logEvent({
      deploymentId: input.deploymentId,
      eventKind: input.eventKind,
      message: input.summary,
      level: DeploymentLogLevels.error,
      details: input.details,
    });

    return record;
  }

  public listLogs(deploymentId: string, options?: DeploymentDiagnosticsQueryOptions): ReadonlyArray<DeploymentLogEntry> {
    return this.applyLimit(this.repository.listLogs(deploymentId), options?.limit);
  }

  public listDiagnostics(deploymentId: string, options?: DeploymentDiagnosticsQueryOptions): ReadonlyArray<DeploymentDiagnosticRecord> {
    return this.applyLimit(this.repository.listDiagnostics(deploymentId), options?.limit);
  }

  private applyLimit<T>(entries: ReadonlyArray<T>, requestedLimit?: number): ReadonlyArray<T> {
    const limit = this.normalizeLimit(requestedLimit);
    if (!limit || entries.length <= limit) {
      return entries;
    }
    return Object.freeze(entries.slice(entries.length - limit));
  }

  private normalizeLimit(limit?: number): number | undefined {
    if (limit === undefined) {
      return undefined;
    }
    if (!Number.isFinite(limit)) {
      throw new Error("Diagnostics query limit must be a finite number.");
    }
    const normalized = Math.trunc(limit);
    if (normalized <= 0) {
      throw new Error("Diagnostics query limit must be greater than zero.");
    }
    return Math.min(normalized, MAX_QUERY_LIMIT);
  }
}

