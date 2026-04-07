import { z } from "zod";
import {
  ComfyRuntimeLifecycleResultSchema,
  type ComfyRuntimeLifecycleResult,
  createComfyRuntimeLifecycleResult,
} from "./ComfyRuntimeLifecycleContract";
import { type RuntimeRepositoryInstallationState } from "./RuntimeRepositoryInstallerContract";

const nonEmptyStringSchema = z.string().trim().min(1);

export type ComfyRuntimeInstallerStateIssue = Readonly<{
  code: string;
  severity: "error" | "warning";
  message: string;
  phase: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ComfyRuntimeInstallerStatePhaseResult = Readonly<{
  phase: string;
  status: "completed" | "failed" | "skipped" | "not-implemented";
  message: string;
  startedAt: string;
  finishedAt: string;
  issues: ReadonlyArray<ComfyRuntimeInstallerStateIssue>;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ComfyRuntimeInstallerStateOrchestrationState = "ready" | "partial" | "failed";

export const ComfyRuntimeInstallerPersistedStateSchemaVersion = 1;

export const ComfyRuntimeInstallerPersistedPhaseStateSchema = z.object({
  status: z.enum([
    "completed",
    "failed",
    "skipped",
    "not-implemented",
  ]),
  updatedAt: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  issues: z.array(z.object({
    code: nonEmptyStringSchema,
    severity: z.enum(["error", "warning"]),
    message: nonEmptyStringSchema,
    phase: nonEmptyStringSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
});

export type ComfyRuntimeInstallerPersistedPhaseState = z.infer<typeof ComfyRuntimeInstallerPersistedPhaseStateSchema>;

export const ComfyRuntimeInstallerPersistedStateSchema = z.object({
  schemaVersion: z.literal(ComfyRuntimeInstallerPersistedStateSchemaVersion),
  runtimeDependencyId: nonEmptyStringSchema,
  runtimeAssetId: nonEmptyStringSchema,
  runtimeAssetVersionId: nonEmptyStringSchema,
  installLocationKey: nonEmptyStringSchema,
  installDirectory: nonEmptyStringSchema,
  runtimeWorkingDirectory: nonEmptyStringSchema,
  runtimeEndpoint: nonEmptyStringSchema,
  repositoryState: nonEmptyStringSchema,
  repositoryRevision: nonEmptyStringSchema.optional(),
  orchestrationState: z.enum(["ready", "partial", "failed"]),
  phases: z.record(nonEmptyStringSchema, ComfyRuntimeInstallerPersistedPhaseStateSchema).default({}),
  lastLifecycle: ComfyRuntimeLifecycleResultSchema.optional(),
  issues: z.array(z.object({
    code: nonEmptyStringSchema,
    severity: z.enum(["error", "warning"]),
    message: nonEmptyStringSchema,
    phase: nonEmptyStringSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
  diagnostics: z.record(z.string(), z.unknown()).default({}),
  startedAt: nonEmptyStringSchema,
  updatedAt: nonEmptyStringSchema,
  completedAt: nonEmptyStringSchema.optional(),
});

export type ComfyRuntimeInstallerPersistedState = z.infer<typeof ComfyRuntimeInstallerPersistedStateSchema>;

export interface ComfyRuntimeInstallerStateLoadResult {
  readonly state?: ComfyRuntimeInstallerPersistedState;
  readonly diagnostics: ReadonlyArray<ComfyRuntimeInstallerStateIssue>;
}

export interface IComfyRuntimeInstallerStateStore {
  load(input: {
    readonly installDirectory: string;
  }): Promise<ComfyRuntimeInstallerStateLoadResult>;
  save(state: ComfyRuntimeInstallerPersistedState): Promise<void>;
}

export function createComfyRuntimeInstallerPersistedState(input: {
  readonly runtimeDependencyId: string;
  readonly runtimeAssetId: string;
  readonly runtimeAssetVersionId: string;
  readonly installLocationKey: string;
  readonly installDirectory: string;
  readonly runtimeWorkingDirectory: string;
  readonly runtimeEndpoint: string;
  readonly repositoryState: RuntimeRepositoryInstallationState;
  readonly repositoryRevision?: string;
  readonly orchestrationState: ComfyRuntimeInstallerStateOrchestrationState;
  readonly phases: ReadonlyArray<ComfyRuntimeInstallerStatePhaseResult>;
  readonly lastLifecycle?: ComfyRuntimeLifecycleResult;
  readonly issues: ReadonlyArray<ComfyRuntimeInstallerStateIssue>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}): ComfyRuntimeInstallerPersistedState {
  const phases = Object.fromEntries(input.phases.map((entry) => [entry.phase, {
    status: entry.status,
    updatedAt: entry.finishedAt,
    message: entry.message,
    metadata: entry.metadata ?? {},
    issues: entry.issues,
  }])) as Record<string, ComfyRuntimeInstallerPersistedPhaseState>;

  const parsed = ComfyRuntimeInstallerPersistedStateSchema.parse({
    schemaVersion: ComfyRuntimeInstallerPersistedStateSchemaVersion,
    runtimeDependencyId: input.runtimeDependencyId,
    runtimeAssetId: input.runtimeAssetId,
    runtimeAssetVersionId: input.runtimeAssetVersionId,
    installLocationKey: input.installLocationKey,
    installDirectory: input.installDirectory,
    runtimeWorkingDirectory: input.runtimeWorkingDirectory,
    runtimeEndpoint: input.runtimeEndpoint,
    repositoryState: input.repositoryState,
    repositoryRevision: input.repositoryRevision,
    orchestrationState: input.orchestrationState,
    phases,
    lastLifecycle: input.lastLifecycle,
    issues: input.issues,
    diagnostics: input.diagnostics ?? {},
    startedAt: input.startedAt,
    updatedAt: input.updatedAt,
    completedAt: input.completedAt,
  });

  return Object.freeze({
    ...parsed,
    phases: Object.freeze(Object.fromEntries(Object.entries(parsed.phases).map(([key, value]) => [
      key,
      Object.freeze({
        ...value,
        metadata: Object.freeze({ ...value.metadata }),
        issues: Object.freeze(value.issues.map((entry) => Object.freeze({
          ...entry,
          metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined,
        }))),
      }),
    ]))),
    lastLifecycle: parsed.lastLifecycle ? createComfyRuntimeLifecycleResult(parsed.lastLifecycle) : undefined,
    issues: Object.freeze(parsed.issues.map((entry) => Object.freeze({
      ...entry,
      metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined,
    }))),
    diagnostics: Object.freeze({ ...parsed.diagnostics }),
  });
}
