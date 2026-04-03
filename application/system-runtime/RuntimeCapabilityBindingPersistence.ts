import { z } from "zod";
import {
  createRuntimeCapabilityBindingContract,
  RuntimeCapabilityBindingContractSchema,
  type RuntimeCapabilityBindingContract,
} from "./RuntimeCapabilityBindingContract";
import {
  RuntimeExecutionOptionValuesSchema,
  type RuntimeExecutionOptionValues,
} from "./ExecutionOptionCapabilityContract";

export const RuntimeCapabilityBindingPersistenceSchemaVersion = "1.0.0" as const;

const PersistedRuntimeCapabilityBindingRecordSchema = z.object({
  persistenceVersion: z.literal(RuntimeCapabilityBindingPersistenceSchemaVersion).default(RuntimeCapabilityBindingPersistenceSchemaVersion),
  bindingContract: RuntimeCapabilityBindingContractSchema,
  selectedModelBindingId: z.string().trim().min(1),
  selectedExecutionOptions: RuntimeExecutionOptionValuesSchema.default({}),
  resolved: z.object({
    resolvedAt: z.string().trim().min(1),
    resolverVersion: z.string().trim().min(1).default("1.0.0"),
    resolvedExecutionOptions: RuntimeExecutionOptionValuesSchema,
  }).optional(),
});

const PersistedRuntimeCapabilityBindingEnvelopeSchema = z.object({
  schemaVersion: z.literal(RuntimeCapabilityBindingPersistenceSchemaVersion).default(RuntimeCapabilityBindingPersistenceSchemaVersion),
  bindings: z.array(PersistedRuntimeCapabilityBindingRecordSchema).default([]),
});

export interface PersistedRuntimeCapabilityBindingRecord extends z.infer<typeof PersistedRuntimeCapabilityBindingRecordSchema> {
  readonly bindingContract: RuntimeCapabilityBindingContract;
  readonly selectedExecutionOptions: RuntimeExecutionOptionValues;
  readonly resolved?: {
    readonly resolvedAt: string;
    readonly resolverVersion: string;
    readonly resolvedExecutionOptions: RuntimeExecutionOptionValues;
  };
}

export interface PersistedRuntimeCapabilityBindingEnvelope extends z.infer<typeof PersistedRuntimeCapabilityBindingEnvelopeSchema> {
  readonly bindings: ReadonlyArray<PersistedRuntimeCapabilityBindingRecord>;
}

function normalizeRecord(record: z.infer<typeof PersistedRuntimeCapabilityBindingRecordSchema>): PersistedRuntimeCapabilityBindingRecord {
  return Object.freeze({
    persistenceVersion: record.persistenceVersion,
    bindingContract: createRuntimeCapabilityBindingContract({
      ...record.bindingContract,
      modelBindingId: record.bindingContract.modelBindingId,
      metadata: {},
    }),
    selectedModelBindingId: record.selectedModelBindingId,
    selectedExecutionOptions: RuntimeExecutionOptionValuesSchema.parse(record.selectedExecutionOptions),
    resolved: record.resolved
      ? Object.freeze({
        resolvedAt: record.resolved.resolvedAt,
        resolverVersion: record.resolved.resolverVersion,
        resolvedExecutionOptions: RuntimeExecutionOptionValuesSchema.parse(record.resolved.resolvedExecutionOptions),
      })
      : undefined,
  });
}

export function validatePersistedRuntimeCapabilityBindingEnvelope(input: unknown): PersistedRuntimeCapabilityBindingEnvelope {
  const parsed = PersistedRuntimeCapabilityBindingEnvelopeSchema.parse(input);
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    bindings: Object.freeze(parsed.bindings.map((record) => normalizeRecord(record))),
  });
}

export function parsePersistedRuntimeCapabilityBindingEnvelope(input: unknown): PersistedRuntimeCapabilityBindingEnvelope | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const schemaVersion = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== RuntimeCapabilityBindingPersistenceSchemaVersion) {
    throw new Error(`unsupported-runtime-capability-binding-persistence-version:${String(schemaVersion)}`);
  }
  return validatePersistedRuntimeCapabilityBindingEnvelope(input);
}
