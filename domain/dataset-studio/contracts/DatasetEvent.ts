import { z } from "zod";
import {
  createDatasetAssetReference,
  createDatasetInstanceReference,
  createDatasetRecordReference,
  type DatasetAssetReference,
  type DatasetInstanceReference,
  type DatasetRecordReference,
} from "./StudioDatasetCompatibility";

export const DatasetEventTypes = Object.freeze({
  imageAdded: "image_added",
  imageUpdated: "image_updated",
  imageGenerated: "image_generated",
  imageSelected: "image_selected",
} as const);

export type DatasetEventType = typeof DatasetEventTypes[keyof typeof DatasetEventTypes];

export const DatasetEventContractVersions = Object.freeze({
  v1: "1.0.0",
} as const);

export type DatasetEventContractVersion =
  typeof DatasetEventContractVersions[keyof typeof DatasetEventContractVersions];

export const DatasetEventActorKinds = Object.freeze({
  user: "user",
  workflow: "workflow",
  system: "system",
  service: "service",
  runtime: "runtime",
  unknown: "unknown",
} as const);

export type DatasetEventActorKind = typeof DatasetEventActorKinds[keyof typeof DatasetEventActorKinds];

export interface DatasetEventActor {
  readonly actorKind: DatasetEventActorKind;
  readonly actorId?: string;
  readonly source: string;
  readonly sessionId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface DatasetEventPayloadMetadata {
  readonly workflowId?: string;
  readonly workflowRunId?: string;
  readonly systemId?: string;
  readonly lineage?: Readonly<Record<string, string>>;
}

export interface DatasetImageAddedPayload {
  readonly record: DatasetRecordReference;
  readonly derivedMetadata?: Readonly<Record<string, unknown>>;
}

export interface DatasetImageUpdatedPayload {
  readonly record: DatasetRecordReference;
  readonly previousRecord?: DatasetRecordReference;
  readonly updatedFields: ReadonlyArray<string>;
  readonly derivedMetadata?: Readonly<Record<string, unknown>>;
}

export interface DatasetImageGeneratedPayload {
  readonly record: DatasetRecordReference;
  readonly generationContext?: Readonly<Record<string, string>>;
  readonly derivedMetadata?: Readonly<Record<string, unknown>>;
}

export interface DatasetImageSelectedPayload {
  readonly record: DatasetRecordReference;
  readonly selectionContext?: {
    readonly selectionMode?: string;
    readonly reason?: string;
    readonly rank?: number;
  };
  readonly derivedMetadata?: Readonly<Record<string, unknown>>;
}

export type DatasetEventPayload =
  | DatasetImageAddedPayload
  | DatasetImageUpdatedPayload
  | DatasetImageGeneratedPayload
  | DatasetImageSelectedPayload;

interface DatasetEventBase {
  readonly eventId: string;
  readonly eventType: DatasetEventType;
  readonly occurredAt: string;
  readonly contractVersion: DatasetEventContractVersion;
  readonly dataset: DatasetAssetReference;
  readonly instance?: DatasetInstanceReference;
  readonly actor: DatasetEventActor;
  readonly payloadMetadata?: DatasetEventPayloadMetadata;
}

export interface DatasetImageAddedEvent extends DatasetEventBase {
  readonly eventType: typeof DatasetEventTypes.imageAdded;
  readonly payload: DatasetImageAddedPayload;
}

export interface DatasetImageUpdatedEvent extends DatasetEventBase {
  readonly eventType: typeof DatasetEventTypes.imageUpdated;
  readonly payload: DatasetImageUpdatedPayload;
}

export interface DatasetImageGeneratedEvent extends DatasetEventBase {
  readonly eventType: typeof DatasetEventTypes.imageGenerated;
  readonly payload: DatasetImageGeneratedPayload;
}

export interface DatasetImageSelectedEvent extends DatasetEventBase {
  readonly eventType: typeof DatasetEventTypes.imageSelected;
  readonly payload: DatasetImageSelectedPayload;
}

export type DatasetEvent =
  | DatasetImageAddedEvent
  | DatasetImageUpdatedEvent
  | DatasetImageGeneratedEvent
  | DatasetImageSelectedEvent;

const NonEmptyStringSchema = z.string().trim().min(1);
const UnknownRecordSchema = z.record(z.string(), z.unknown());
const StringRecordSchema = z.record(z.string(), NonEmptyStringSchema);

const DatasetAssetReferenceSchema = z.object({
  assetId: NonEmptyStringSchema,
  versionId: NonEmptyStringSchema.optional(),
}).strict();

const DatasetInstanceReferenceSchema = z.object({
  systemId: NonEmptyStringSchema,
  instanceId: NonEmptyStringSchema,
  dataset: DatasetAssetReferenceSchema,
}).strict();

const DatasetRecordReferenceSchema = z.object({
  dataset: DatasetAssetReferenceSchema,
  selectionId: NonEmptyStringSchema,
  recordId: NonEmptyStringSchema,
  instance: DatasetInstanceReferenceSchema.optional(),
  imageReference: NonEmptyStringSchema.optional(),
}).strict();

const DatasetEventActorSchema = z.object({
  actorKind: z.nativeEnum(DatasetEventActorKinds),
  actorId: NonEmptyStringSchema.optional(),
  source: NonEmptyStringSchema,
  sessionId: NonEmptyStringSchema.optional(),
  metadata: StringRecordSchema.optional(),
}).strict();

const DatasetEventPayloadMetadataSchema = z.object({
  workflowId: NonEmptyStringSchema.optional(),
  workflowRunId: NonEmptyStringSchema.optional(),
  systemId: NonEmptyStringSchema.optional(),
  lineage: StringRecordSchema.optional(),
}).strict();

const DatasetEventBaseSchema = z.object({
  eventId: NonEmptyStringSchema,
  occurredAt: NonEmptyStringSchema,
  contractVersion: z.literal(DatasetEventContractVersions.v1),
  dataset: DatasetAssetReferenceSchema,
  instance: DatasetInstanceReferenceSchema.optional(),
  actor: DatasetEventActorSchema,
  payloadMetadata: DatasetEventPayloadMetadataSchema.optional(),
}).strict();

export const DatasetImageAddedPayloadSchema = z.object({
  record: DatasetRecordReferenceSchema,
  derivedMetadata: UnknownRecordSchema.optional(),
}).strict();

export const DatasetImageUpdatedPayloadSchema = z.object({
  record: DatasetRecordReferenceSchema,
  previousRecord: DatasetRecordReferenceSchema.optional(),
  updatedFields: z.array(NonEmptyStringSchema).min(1),
  derivedMetadata: UnknownRecordSchema.optional(),
}).strict();

export const DatasetImageGeneratedPayloadSchema = z.object({
  record: DatasetRecordReferenceSchema,
  generationContext: StringRecordSchema.optional(),
  derivedMetadata: UnknownRecordSchema.optional(),
}).strict();

export const DatasetImageSelectedPayloadSchema = z.object({
  record: DatasetRecordReferenceSchema,
  selectionContext: z.object({
    selectionMode: NonEmptyStringSchema.optional(),
    reason: NonEmptyStringSchema.optional(),
    rank: z.number().int().min(0).optional(),
  }).strict().optional(),
  derivedMetadata: UnknownRecordSchema.optional(),
}).strict();

export const DatasetEventSchema = z.discriminatedUnion("eventType", [
  DatasetEventBaseSchema.extend({
    eventType: z.literal(DatasetEventTypes.imageAdded),
    payload: DatasetImageAddedPayloadSchema,
  }),
  DatasetEventBaseSchema.extend({
    eventType: z.literal(DatasetEventTypes.imageUpdated),
    payload: DatasetImageUpdatedPayloadSchema,
  }),
  DatasetEventBaseSchema.extend({
    eventType: z.literal(DatasetEventTypes.imageGenerated),
    payload: DatasetImageGeneratedPayloadSchema,
  }),
  DatasetEventBaseSchema.extend({
    eventType: z.literal(DatasetEventTypes.imageSelected),
    payload: DatasetImageSelectedPayloadSchema,
  }),
]);

function normalizeTimestamp(value: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new Error("DatasetEvent.occurredAt must be a valid ISO timestamp.");
  }
  return normalized;
}

export function validateDatasetEvent(value: DatasetEvent): DatasetEvent {
  const parsed = DatasetEventSchema.parse(value) as DatasetEvent;
  normalizeTimestamp(parsed.occurredAt);
  return parsed;
}

export function createDatasetEvent(input: DatasetEvent): DatasetEvent {
  const parsed = validateDatasetEvent(input);
  return Object.freeze({
    ...parsed,
    occurredAt: normalizeTimestamp(parsed.occurredAt),
    dataset: createDatasetAssetReference(parsed.dataset),
    instance: parsed.instance ? createDatasetInstanceReference(parsed.instance) : undefined,
    actor: Object.freeze({
      ...parsed.actor,
      metadata: parsed.actor.metadata ? Object.freeze({ ...parsed.actor.metadata }) : undefined,
    }),
    payloadMetadata: parsed.payloadMetadata
      ? Object.freeze({
        ...parsed.payloadMetadata,
        lineage: parsed.payloadMetadata.lineage
          ? Object.freeze({ ...parsed.payloadMetadata.lineage })
          : undefined,
      })
      : undefined,
    payload: normalizePayload(parsed),
  });
}

function normalizePayload(event: DatasetEvent): DatasetEventPayload {
  switch (event.eventType) {
    case DatasetEventTypes.imageAdded:
      return Object.freeze({
        ...event.payload,
        record: createDatasetRecordReference(event.payload.record),
      });
    case DatasetEventTypes.imageUpdated:
      return Object.freeze({
        ...event.payload,
        record: createDatasetRecordReference(event.payload.record),
        previousRecord: event.payload.previousRecord
          ? createDatasetRecordReference(event.payload.previousRecord)
          : undefined,
        updatedFields: Object.freeze([...new Set(event.payload.updatedFields.map((field) => field.trim()).filter(Boolean))]),
      });
    case DatasetEventTypes.imageGenerated:
      return Object.freeze({
        ...event.payload,
        record: createDatasetRecordReference(event.payload.record),
        generationContext: event.payload.generationContext
          ? Object.freeze({ ...event.payload.generationContext })
          : undefined,
      });
    case DatasetEventTypes.imageSelected:
      return Object.freeze({
        ...event.payload,
        record: createDatasetRecordReference(event.payload.record),
        selectionContext: event.payload.selectionContext
          ? Object.freeze({ ...event.payload.selectionContext })
          : undefined,
      });
    default:
      return event.payload;
  }
}

export function validateDatasetEventPayloadForType(
  eventType: DatasetEventType,
  payload: DatasetEventPayload,
): DatasetEventPayload {
  switch (eventType) {
    case DatasetEventTypes.imageAdded:
      return DatasetImageAddedPayloadSchema.parse(payload) as DatasetImageAddedPayload;
    case DatasetEventTypes.imageUpdated:
      return DatasetImageUpdatedPayloadSchema.parse(payload) as DatasetImageUpdatedPayload;
    case DatasetEventTypes.imageGenerated:
      return DatasetImageGeneratedPayloadSchema.parse(payload) as DatasetImageGeneratedPayload;
    case DatasetEventTypes.imageSelected:
      return DatasetImageSelectedPayloadSchema.parse(payload) as DatasetImageSelectedPayload;
    default: {
      const exhaustive: never = eventType;
      throw new Error(`Unsupported dataset event type '${String(exhaustive)}'.`);
    }
  }
}
