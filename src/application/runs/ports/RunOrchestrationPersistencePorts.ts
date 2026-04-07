import type {
  PlatformAuditEventRecord,
  PlatformRunListQuery,
  PlatformPersistenceMutationContext,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";

export type AuthoritativeRunPersistenceMutationContext = PlatformPersistenceMutationContext;

export interface IAuthoritativeRunPersistenceRepository {
  findRunById(runId: string): Promise<PlatformRunRecord | undefined>;
  listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>>;
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

export const RunQueueEligibilityMarkers = Object.freeze({
  ready: "ready",
  deferred: "deferred",
  blocked: "blocked",
});

export type RunQueueEligibilityMarker =
  typeof RunQueueEligibilityMarkers[keyof typeof RunQueueEligibilityMarkers];

export interface AuthoritativeRunQueueEntryRecord {
  readonly runId: string;
  readonly queueId: string;
  readonly workspaceId?: string;
  readonly lifecycleState: RunLifecycleState;
  readonly enteredAt: string;
  readonly orderKey: string;
  readonly eligibilityMarker: RunQueueEligibilityMarker;
  readonly eligibleAt: string;
  readonly claimToken?: string;
  readonly claimedBy?: string;
  readonly claimedAt?: string;
  readonly claimExpiresAt?: string;
  readonly dequeuedAt?: string;
  readonly updatedAt: string;
  readonly revision: number;
}

export interface AuthoritativeRunQueueMutationResult {
  readonly changed: boolean;
  readonly record: AuthoritativeRunQueueEntryRecord;
}

export interface IRunOrchestrationQueuePersistenceRepository {
  getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined>;
  enqueueRunForAssignment(
    record: Omit<
      AuthoritativeRunQueueEntryRecord,
      "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision"
    >,
    mutation: AuthoritativeRunPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult>;
  listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>;
  claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>>;
  releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean>;
}

