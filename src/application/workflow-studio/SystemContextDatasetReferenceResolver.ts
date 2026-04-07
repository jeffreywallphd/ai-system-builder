import type { SystemContextContract, SystemContextDatasetReference } from "@domain/system-studio/SystemContextContract";

export const SystemContextDatasetResolutionIssueCodes = Object.freeze({
  missingReferenceIdentity: "missing-reference-identity",
  unresolvedInstance: "unresolved-instance",
  incompatibleSchemaIntent: "incompatible-schema-intent",
} as const);

export type SystemContextDatasetResolutionIssueCode =
  typeof SystemContextDatasetResolutionIssueCodes[keyof typeof SystemContextDatasetResolutionIssueCodes];

export interface ResolvedSystemContextDatasetRuntimeHandle {
  readonly kind: "dataset-instance";
  readonly instanceId: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly systemAssetId?: string;
  readonly role?: string;
  readonly referenceId: string;
  readonly schemaIntentId?: string;
}

export interface ResolvedSystemContextDatasetRecord {
  readonly recordId: string;
  readonly value: unknown;
}

export interface ResolvedSystemContextDatasetReference {
  readonly referenceId: string;
  readonly role?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly instanceId: string;
  readonly systemAssetId?: string;
  readonly schemaIntentId?: string;
  readonly sampleRecordValue?: unknown;
  readonly sampleRecords?: ReadonlyArray<ResolvedSystemContextDatasetRecord>;
  readonly runtimeHandle: ResolvedSystemContextDatasetRuntimeHandle;
}

export interface SystemContextDatasetResolutionIssue {
  readonly code: SystemContextDatasetResolutionIssueCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly referenceId: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ResolveSystemContextDatasetsRequest {
  readonly datasets: ReadonlyArray<SystemContextDatasetReference>;
}

export interface ResolveSystemContextDatasetsResult {
  readonly resolved: ReadonlyArray<ResolvedSystemContextDatasetReference>;
  readonly unresolved: ReadonlyArray<SystemContextDatasetReference>;
  readonly issues: ReadonlyArray<SystemContextDatasetResolutionIssue>;
  readonly byReferenceId: Readonly<Record<string, ResolvedSystemContextDatasetReference>>;
}

function inferExpectedSchemaIntent(role: string | undefined): string | undefined {
  if (!role) {
    return undefined;
  }
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole.includes("history")) {
    return "media-history";
  }
  if (normalizedRole.includes("output")) {
    return "media-output";
  }
  if (normalizedRole.includes("input")) {
    return "media-input";
  }
  return undefined;
}

function toSampleRecords(value: unknown): ReadonlyArray<ResolvedSystemContextDatasetRecord> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const records = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const record = item as Record<string, unknown>;
      if (typeof record.recordId !== "string" || record.recordId.trim().length === 0) {
        return undefined;
      }
      return Object.freeze({
        recordId: record.recordId,
        value: record.value,
      } satisfies ResolvedSystemContextDatasetRecord);
    })
    .filter((record): record is ResolvedSystemContextDatasetRecord => Boolean(record));

  return records.length > 0 ? Object.freeze(records) : undefined;
}

export interface SystemContextDatasetReferenceResolver {
  readonly resolve: (request: ResolveSystemContextDatasetsRequest) => ResolveSystemContextDatasetsResult;
}

export function createDefaultSystemContextDatasetReferenceResolver(): SystemContextDatasetReferenceResolver {
  return Object.freeze({
    resolve: ({ datasets }) => {
      const resolved: ResolvedSystemContextDatasetReference[] = [];
      const unresolved: SystemContextDatasetReference[] = [];
      const issues: SystemContextDatasetResolutionIssue[] = [];
      const byReferenceId: Record<string, ResolvedSystemContextDatasetReference> = {};

      datasets.forEach((reference, index) => {
        if (!reference.instanceId && !reference.datasetAssetId) {
          unresolved.push(reference);
          issues.push(Object.freeze({
            code: SystemContextDatasetResolutionIssueCodes.missingReferenceIdentity,
            severity: "error",
            message: "Dataset reference must include instanceId or datasetAssetId.",
            referenceId: reference.referenceId,
            path: `datasets[${index}]`,
          }));
          return;
        }

        if (!reference.instanceId) {
          unresolved.push(reference);
          issues.push(Object.freeze({
            code: SystemContextDatasetResolutionIssueCodes.unresolvedInstance,
            severity: "error",
            message: "Dataset reference could not be resolved to a concrete dataset instance.",
            referenceId: reference.referenceId,
            path: `datasets[${index}].instanceId`,
            details: Object.freeze({
              datasetAssetId: reference.datasetAssetId,
              role: reference.role,
            }),
          }));
          return;
        }

        const actualSchemaIntentId = typeof reference.metadata?.schemaIntentId === "string"
          ? reference.metadata.schemaIntentId
          : undefined;
        const expectedSchemaIntentId = inferExpectedSchemaIntent(reference.role);
        if (expectedSchemaIntentId && actualSchemaIntentId && actualSchemaIntentId !== expectedSchemaIntentId) {
          unresolved.push(reference);
          issues.push(Object.freeze({
            code: SystemContextDatasetResolutionIssueCodes.incompatibleSchemaIntent,
            severity: "error",
            message: `Dataset schema intent is incompatible for role '${reference.role}'.`,
            referenceId: reference.referenceId,
            path: `datasets[${index}].metadata.schemaIntentId`,
            details: Object.freeze({
              expectedSchemaIntentId,
              actualSchemaIntentId,
            }),
          }));
          return;
        }

        const resolvedReference = Object.freeze({
          referenceId: reference.referenceId,
          role: reference.role,
          datasetAssetId: reference.datasetAssetId,
          datasetVersionId: reference.datasetVersionId,
          instanceId: reference.instanceId,
          systemAssetId: reference.systemAssetId,
          schemaIntentId: actualSchemaIntentId,
          sampleRecordValue: reference.metadata?.sampleRecordValue,
          sampleRecords: toSampleRecords(reference.metadata?.sampleRecords),
          runtimeHandle: Object.freeze({
            kind: "dataset-instance",
            instanceId: reference.instanceId,
            datasetAssetId: reference.datasetAssetId,
            datasetVersionId: reference.datasetVersionId,
            systemAssetId: reference.systemAssetId,
            role: reference.role,
            referenceId: reference.referenceId,
            schemaIntentId: actualSchemaIntentId,
          } satisfies ResolvedSystemContextDatasetRuntimeHandle),
        } satisfies ResolvedSystemContextDatasetReference);

        resolved.push(resolvedReference);
        byReferenceId[reference.referenceId] = resolvedReference;
      });

      return Object.freeze({
        resolved: Object.freeze(resolved),
        unresolved: Object.freeze(unresolved),
        issues: Object.freeze(issues),
        byReferenceId: Object.freeze(byReferenceId),
      });
    },
  });
}

export function resolveSystemContextDatasets(
  context: Pick<SystemContextContract, "datasets">,
  resolver: SystemContextDatasetReferenceResolver = createDefaultSystemContextDatasetReferenceResolver(),
): ResolveSystemContextDatasetsResult {
  return resolver.resolve({ datasets: context.datasets });
}

