import { z } from "zod";
import {
  PlatformAuditEventKinds,
  PlatformAuditOutcomes,
  PlatformRunKinds,
  PlatformRunStatuses,
} from "../../dto/platform/PlatformPersistenceDtos";
import {
  PersistenceIdentifierSchema,
  PersistenceSensitiveFieldDescriptorSchema,
  PersistenceTenancyMetadataSchema,
  PersistenceTimestampSchema,
  PersistenceVersionMetadataSchema,
  parsePersistenceSchema,
} from "../persistence/PersistenceSchemaPrimitives";

const PlatformRunKindSchema = z.enum([
  PlatformRunKinds.workflow,
  PlatformRunKinds.agent,
  PlatformRunKinds.system,
]);

const PlatformRunStatusSchema = z.enum([
  PlatformRunStatuses.pending,
  PlatformRunStatuses.running,
  PlatformRunStatuses.completed,
  PlatformRunStatuses.failed,
  PlatformRunStatuses.cancelled,
  PlatformRunStatuses.blocked,
]);

const PlatformAuditEventKindSchema = z.enum([
  PlatformAuditEventKinds.identity,
  PlatformAuditEventKinds.workspace,
  PlatformAuditEventKinds.authorization,
  PlatformAuditEventKinds.nodes,
  PlatformAuditEventKinds.storage,
  PlatformAuditEventKinds.assets,
  PlatformAuditEventKinds.runs,
  PlatformAuditEventKinds.security,
  PlatformAuditEventKinds.secrets,
  PlatformAuditEventKinds.sessions,
  PlatformAuditEventKinds.system,
]);

const PlatformAuditOutcomeSchema = z.enum([
  PlatformAuditOutcomes.succeeded,
  PlatformAuditOutcomes.denied,
  PlatformAuditOutcomes.failed,
  PlatformAuditOutcomes.rejected,
]);

export const PlatformRunPersistenceRecordSchema = z.object({
  runId: PersistenceIdentifierSchema,
  runKind: PlatformRunKindSchema,
  status: PlatformRunStatusSchema,
  sourceAggregateRef: PersistenceIdentifierSchema,
  initiatedAt: PersistenceTimestampSchema,
  startedAt: PersistenceTimestampSchema.optional(),
  completedAt: PersistenceTimestampSchema.optional(),
  terminalReason: z.string().trim().min(1).max(1024).optional(),
  metadata: z.record(z.unknown()).optional(),
  tenancy: PersistenceTenancyMetadataSchema,
  actorUserIdentityId: PersistenceIdentifierSchema.optional(),
  correlationId: PersistenceIdentifierSchema.optional(),
}).merge(PersistenceVersionMetadataSchema).superRefine((value, context) => {
  if (
    (value.status === PlatformRunStatuses.completed
      || value.status === PlatformRunStatuses.failed
      || value.status === PlatformRunStatuses.cancelled
      || value.status === PlatformRunStatuses.blocked)
    && !value.completedAt
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: "Terminal run statuses require completedAt.",
    });
  }
});

export const PlatformAuditEventPersistenceRecordSchema = z.object({
  eventId: PersistenceIdentifierSchema,
  eventKind: PlatformAuditEventKindSchema,
  action: z.string().trim().min(1).max(255),
  actorId: PersistenceIdentifierSchema,
  targetRef: PersistenceIdentifierSchema.optional(),
  outcome: PlatformAuditOutcomeSchema,
  occurredAt: PersistenceTimestampSchema,
  details: z.record(z.unknown()).optional(),
  tenancy: PersistenceTenancyMetadataSchema,
  correlationId: PersistenceIdentifierSchema.optional(),
  sensitiveFields: z.array(PersistenceSensitiveFieldDescriptorSchema).optional(),
});

export type PlatformRunPersistenceRecordPayload = z.infer<typeof PlatformRunPersistenceRecordSchema>;
export type PlatformAuditEventPersistenceRecordPayload = z.infer<typeof PlatformAuditEventPersistenceRecordSchema>;

export function parsePlatformRunPersistenceRecord(payload: unknown): PlatformRunPersistenceRecordPayload {
  return parsePersistenceSchema(
    "PlatformRunPersistenceRecord",
    PlatformRunPersistenceRecordSchema,
    payload,
  );
}

export function parsePlatformAuditEventPersistenceRecord(
  payload: unknown,
): PlatformAuditEventPersistenceRecordPayload {
  return parsePersistenceSchema(
    "PlatformAuditEventPersistenceRecord",
    PlatformAuditEventPersistenceRecordSchema,
    payload,
  );
}
