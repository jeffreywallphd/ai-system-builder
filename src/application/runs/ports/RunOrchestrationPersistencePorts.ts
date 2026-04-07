import type {
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";

export type AuthoritativeRunPersistenceMutationContext = PlatformPersistenceMutationContext;

export interface IAuthoritativeRunPersistenceRepository {
  findRunById(runId: string): Promise<PlatformRunRecord | undefined>;
  createRun(
    record: PlatformRunRecord,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult>;
}

export interface IRunOrchestrationIntentRepository {
  appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }>;
}

