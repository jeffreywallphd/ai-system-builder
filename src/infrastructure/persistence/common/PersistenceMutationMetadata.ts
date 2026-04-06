import {
  resolvePersistenceTimestamp,
  type PersistenceClock,
  SystemPersistenceClock,
} from "../../../shared/persistence/PersistenceTimestamps";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
} from "../../../shared/persistence/PersistenceVersioning";

interface PersistenceAuditStampRecord {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface ResolveMutationMetadataInput {
  readonly existing?: PersistenceAuditStampRecord & { readonly revision: number };
  readonly createdAt: string;
  readonly createdBy: string;
  readonly actorId: string;
  readonly expectedRevision?: number;
  readonly occurredAt?: string;
  readonly entityName: string;
  readonly clock?: PersistenceClock;
}

export interface PersistenceMutationMetadata {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}

export function resolvePersistenceMutationMetadata(input: ResolveMutationMetadataInput): PersistenceMutationMetadata {
  assertExpectedPersistenceRevision(input.expectedRevision, input.existing?.revision, input.entityName);

  const clock = input.clock ?? SystemPersistenceClock;
  const modifiedAt = resolvePersistenceTimestamp(input.occurredAt, clock);

  return Object.freeze({
    createdAt: input.existing?.createdAt ?? input.createdAt,
    createdBy: input.existing?.createdBy ?? input.createdBy,
    lastModifiedAt: modifiedAt,
    lastModifiedBy: input.actorId,
    revision: nextPersistenceRevision(input.existing?.revision),
  });
}

export function resolvePersistenceMutationCreatedAt(
  occurredAt: string | undefined,
  clock: PersistenceClock = SystemPersistenceClock,
): string {
  return resolvePersistenceTimestamp(occurredAt, clock);
}
