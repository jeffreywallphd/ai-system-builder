import { createDatasetStudioTaxonomy } from "../../domain/dataset-studio/DatasetStudioDomain";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetBase } from "../../domain/dataset-studio/DataAssetBase";
import type { DataAssetVersionDescriptor } from "../../domain/dataset-studio/DataAssetVersioning";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
  type DatasetSchemaIntentValidationIssue,
  type IDatasetSchemaIntent,
  type IDatasetSchemaIntentRegistry,
} from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import {
  assertValidDataAssetVersion,
  compareDataAssetVersions,
} from "../../domain/dataset-studio/DataAssetVersioning";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import {
  createDataAssetConfigSchema,
  inferDataAssetConfigSchema,
  resolveDataAssetConfigDefaults,
  type DataAssetConfigFieldSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import { createDefaultDatasetSchemaIntentRegistry } from "./DatasetSchemaIntentRegistry";

export const DataAssetRegistrySpecializations = Object.freeze({
  dataset: "dataset",
  converter: "converter",
  preview: "preview",
  ingestion: "ingestion",
  transformation: "transformation",
} as const);

export type DataAssetRegistrySpecialization =
  typeof DataAssetRegistrySpecializations[keyof typeof DataAssetRegistrySpecializations];

export interface DataAssetRegistryDisplayMetadata {
  readonly title?: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface DataAssetRegistryContractReferences {
  readonly inputShapeKind: NonNullable<DataAssetBase["contract"]["input"]>["kind"];
  readonly outputShapeKind: NonNullable<DataAssetBase["contract"]["output"]>["kind"];
  readonly contractVersion: string;
  readonly inputDescription?: string;
  readonly outputDescription?: string;
}

export interface DataAssetRegistryCapabilities {
  readonly configurable: boolean;
  readonly previewable: boolean;
  readonly executable: boolean;
}

export interface DataAssetRegistryInspectabilityMetadata {
  readonly supportedSourceKinds: ReadonlyArray<string>;
  readonly supportedFileExtensions: ReadonlyArray<string>;
  readonly supportedMediaTypes: ReadonlyArray<string>;
  readonly keyConfigKeys: ReadonlyArray<string>;
  readonly previewModes: ReadonlyArray<string>;
  readonly executionModes: ReadonlyArray<string>;
}

export const DataAssetDiscoverabilityScopes = Object.freeze({
  default: "default",
  advanced: "advanced",
  internal: "internal",
} as const);

export type DataAssetDiscoverabilityScope =
  typeof DataAssetDiscoverabilityScopes[keyof typeof DataAssetDiscoverabilityScopes];

export interface DataAssetRegistryDiscoverabilityMetadata {
  readonly scope: DataAssetDiscoverabilityScope;
  readonly defaultEntryPoint: boolean;
  readonly inspectable: boolean;
}

export interface DataAssetRegistryDescriptor {
  readonly assetId: string;
  readonly versionId?: string;
  readonly version: DataAssetVersionDescriptor;
  readonly name: string;
  readonly category: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly specialization: DataAssetRegistrySpecialization;
  readonly outputShapeKind: CanonicalDataShapeKind;
  readonly composableInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
  readonly display: DataAssetRegistryDisplayMetadata;
  readonly contracts: DataAssetRegistryContractReferences;
  readonly capabilities: DataAssetRegistryCapabilities;
  readonly schemaIntent: {
    readonly id: DatasetSchemaIntentId;
    readonly name: string;
    readonly description: string;
    readonly contractVersion: string;
    readonly supportedShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly validationIssues: ReadonlyArray<DatasetSchemaIntentValidationIssue>;
  };
  readonly configSchema: DataAssetConfigSchema;
  readonly inspectability: DataAssetRegistryInspectabilityMetadata;
  readonly discoverability: DataAssetRegistryDiscoverabilityMetadata;
}

export interface DataAssetRegistryEntry {
  readonly descriptor: DataAssetRegistryDescriptor;
  readonly baseConfig: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface RegisterDataAssetRequest {
  readonly asset: DataAssetBase;
  readonly category?: string;
  readonly specialization?: DataAssetRegistrySpecialization;
  readonly display?: DataAssetRegistryDisplayMetadata;
  readonly inspectability?: Partial<DataAssetRegistryInspectabilityMetadata>;
  readonly discoverability?: Partial<DataAssetRegistryDiscoverabilityMetadata>;
  readonly configSchema?: DataAssetConfigSchema;
  readonly configFields?: ReadonlyArray<DataAssetConfigFieldSchema>;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly schemaIntentId?: DatasetSchemaIntentId;
  readonly assetFactory?: (config: Readonly<Record<string, CanonicalRecordValue>>) => DataAssetBase;
}

export interface DataAssetLookup {
  readonly assetId: string;
  readonly versionId?: string;
}

export interface ResolveDataAssetRequest extends DataAssetLookup {
  readonly configOverride?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface QueryDataAssets {
  readonly category?: string;
  readonly specialization?: DataAssetRegistrySpecialization;
  readonly outputShapeKind?: CanonicalDataShapeKind;
  readonly schemaIntentId?: DatasetSchemaIntentId;
  readonly previewable?: boolean;
  readonly configurable?: boolean;
  readonly executable?: boolean;
}

interface InternalDataAssetRegistration {
  readonly entry: DataAssetRegistryEntry;
  readonly baseAsset: DataAssetBase;
  readonly assetFactory?: (config: Readonly<Record<string, CanonicalRecordValue>>) => DataAssetBase;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = [...new Set((tags ?? []).map((entry) => entry.trim()).filter(Boolean))];
  return Object.freeze(deduped);
}

function normalizeMetadataList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = [...new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))];
  return Object.freeze(deduped);
}

function normalizeConfigRecord(config: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(config)
      .map(([key, value]) => [key.trim(), value] as const)
      .filter(([key]) => key.length > 0),
  ));
}

function buildContractReferences(asset: DataAssetBase): DataAssetRegistryContractReferences {
  const input = asset.getInputContract();
  const output = asset.getOutputContract();
  return Object.freeze({
    inputShapeKind: input.kind,
    outputShapeKind: output.kind,
    contractVersion: asset.contract.version,
    inputDescription: normalizeOptional(input.description),
    outputDescription: normalizeOptional(output.description),
  });
}

function toDescriptor(input: {
  readonly asset: DataAssetBase;
  readonly category: string;
  readonly specialization: DataAssetRegistrySpecialization;
  readonly display?: DataAssetRegistryDisplayMetadata;
  readonly inspectability?: Partial<DataAssetRegistryInspectabilityMetadata>;
  readonly discoverability?: Partial<DataAssetRegistryDiscoverabilityMetadata>;
  readonly configSchema: DataAssetConfigSchema;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly schemaIntent: IDatasetSchemaIntent;
  readonly schemaIntentValidationIssues: ReadonlyArray<DatasetSchemaIntentValidationIssue>;
}): DataAssetRegistryDescriptor {
  const inspection = input.asset.inspect();
  const inputShapeKind = inspection.metadata.contracts.input.kind;
  const outputShapeKind = inspection.metadata.contracts.output.kind;
  const inspectability = Object.freeze({
    supportedSourceKinds: normalizeMetadataList(input.inspectability?.supportedSourceKinds),
    supportedFileExtensions: normalizeMetadataList(input.inspectability?.supportedFileExtensions),
    supportedMediaTypes: normalizeMetadataList(input.inspectability?.supportedMediaTypes),
    keyConfigKeys: normalizeMetadataList(input.inspectability?.keyConfigKeys ?? inspection.metadata.configKeys),
    previewModes: normalizeMetadataList(input.inspectability?.previewModes ?? ["preview"]),
    executionModes: normalizeMetadataList(input.inspectability?.executionModes ?? ["execute"]),
  } satisfies DataAssetRegistryInspectabilityMetadata);
  const discoverability = Object.freeze({
    scope: input.discoverability?.scope ?? DataAssetDiscoverabilityScopes.default,
    defaultEntryPoint: input.discoverability?.defaultEntryPoint ?? false,
    inspectable: input.discoverability?.inspectable ?? true,
  } satisfies DataAssetRegistryDiscoverabilityMetadata);
  return Object.freeze({
    assetId: inspection.metadata.identity.assetId,
    versionId: inspection.metadata.identity.versionId,
    version: inspection.metadata.version,
    name: inspection.metadata.display.name,
    category: input.category.trim() || "dataset",
    taxonomy: input.taxonomy,
    specialization: input.specialization,
    outputShapeKind: inspection.outputShapeKind,
    composableInputShapeKinds: inspection.metadata.composableInputShapeKinds,
    display: Object.freeze({
      title: normalizeOptional(input.display?.title) ?? inspection.metadata.display.name,
      summary: normalizeOptional(input.display?.summary) ?? inspection.metadata.display.description,
      tags: normalizeTags(input.display?.tags ?? inspection.metadata.display.tags),
    }),
    contracts: buildContractReferences(input.asset),
    capabilities: inspection.metadata.capabilities,
    schemaIntent: Object.freeze({
      id: input.schemaIntent.descriptor.id,
      name: input.schemaIntent.descriptor.name,
      description: input.schemaIntent.descriptor.description,
      contractVersion: input.schemaIntent.descriptor.contractVersion,
      supportedShapeKinds: Object.freeze([...input.schemaIntent.descriptor.supportedShapeKinds]),
      metadata: input.schemaIntent.descriptor.metadata
        ? Object.freeze({ ...input.schemaIntent.descriptor.metadata })
        : undefined,
      validationIssues: Object.freeze([...input.schemaIntentValidationIssues]),
    }),
    configSchema: input.configSchema,
    discoverability,
    inspectability: Object.freeze({
      ...inspectability,
      previewModes: inspectability.previewModes.length > 0 ? inspectability.previewModes : Object.freeze(["preview"]),
      executionModes: inspectability.executionModes.length > 0 ? inspectability.executionModes : Object.freeze(["execute"]),
      keyConfigKeys: inspectability.keyConfigKeys.length > 0
        ? inspectability.keyConfigKeys
        : Object.freeze([
          ...inspection.metadata.configKeys,
          `input:${inputShapeKind}`,
          `output:${outputShapeKind}`,
        ]),
    }),
  });
}

export class DataAssetRegistry {
  private readonly registrationsByKey = new Map<string, InternalDataAssetRegistration>();
  private readonly keysByAssetId = new Map<string, ReadonlyArray<string>>();

  public constructor(
    private readonly schemaIntentRegistry: IDatasetSchemaIntentRegistry = createDefaultDatasetSchemaIntentRegistry(),
  ) {}

  public register(input: RegisterDataAssetRequest): DataAssetRegistryEntry {
    const assetId = input.asset.id.trim();
    if (!assetId) {
      throw new Error("Data asset id is required for registration.");
    }

    const versionId = normalizeOptional(input.asset.version);
    assertValidDataAssetVersion(versionId, "DataAssetRegistryEntry.versionId", { allowLabel: true });
    const key = `${assetId}::${versionId ?? "latest"}`;
    if (this.registrationsByKey.has(key)) {
      throw new Error(`Data asset '${assetId}' version '${versionId ?? "latest"}' is already registered.`);
    }

    const fieldsSchema = input.configFields
      ? createDataAssetConfigSchema({
        schemaId: `data-asset.${assetId}.config`,
        version: input.asset.versionMetadata.schemaVersion,
        fields: input.configFields,
      })
      : undefined;
    const configSchema = input.configSchema ?? fieldsSchema ?? inferDataAssetConfigSchema(input.asset);
    const schemaIntent = this.resolveSchemaIntent(input);
    const validation = schemaIntent.validateShape(input.asset.toCanonicalDataShape());
    if (!validation.valid) {
      const errors = validation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message);
      if (errors.length > 0) {
        throw new Error(
          `Data asset '${assetId}' schema intent '${schemaIntent.descriptor.id}' validation failed: ${errors.join("; ")}`,
        );
      }
    }

    const descriptor = toDescriptor({
      asset: input.asset,
      category: normalizeOptional(input.category) ?? "dataset",
      specialization: input.specialization ?? DataAssetRegistrySpecializations.dataset,
      display: input.display,
      inspectability: input.inspectability,
      discoverability: input.discoverability,
      configSchema,
      taxonomy: input.taxonomy ?? createDatasetStudioTaxonomy(),
      schemaIntent,
      schemaIntentValidationIssues: validation.issues,
    });

    const entry = Object.freeze({
      descriptor,
      baseConfig: normalizeConfigRecord(resolveDataAssetConfigDefaults(configSchema, input.asset.config.values)),
    } satisfies DataAssetRegistryEntry);

    this.registrationsByKey.set(key, Object.freeze({
      entry,
      baseAsset: input.asset,
      assetFactory: input.assetFactory,
    }));

    const existingKeys = this.keysByAssetId.get(assetId) ?? Object.freeze([]);
    this.keysByAssetId.set(assetId, Object.freeze([...existingKeys, key]));
    return entry;
  }

  public unregister(query: DataAssetLookup): boolean {
    const key = this.resolveKey(query);
    if (!key) {
      return false;
    }

    const registration = this.registrationsByKey.get(key);
    if (!registration) {
      return false;
    }

    this.registrationsByKey.delete(key);
    const remainingKeys = (this.keysByAssetId.get(registration.entry.descriptor.assetId) ?? []).filter((entryKey) => entryKey !== key);
    if (remainingKeys.length === 0) {
      this.keysByAssetId.delete(registration.entry.descriptor.assetId);
    } else {
      this.keysByAssetId.set(registration.entry.descriptor.assetId, Object.freeze(remainingKeys));
    }

    return true;
  }

  public list(query: QueryDataAssets = {}): ReadonlyArray<DataAssetRegistryEntry> {
    const entries = [...this.registrationsByKey.values()]
      .map((registration) => registration.entry)
      .filter((entry) => this.matchesQuery(entry, query))
      .sort((left, right) => {
        const titleCompare = left.descriptor.display.title?.localeCompare(right.descriptor.display.title ?? "") ?? 0;
        if (titleCompare !== 0) {
          return titleCompare;
        }

        const assetCompare = left.descriptor.assetId.localeCompare(right.descriptor.assetId);
        if (assetCompare !== 0) {
          return assetCompare;
        }

        return (left.descriptor.versionId ?? "").localeCompare(right.descriptor.versionId ?? "");
      });

    return Object.freeze(entries);
  }

  public get(query: DataAssetLookup): DataAssetRegistryEntry | undefined {
    const key = this.resolveKey(query);
    if (!key) {
      return undefined;
    }

    return this.registrationsByKey.get(key)?.entry;
  }

  public resolveAsset(request: ResolveDataAssetRequest): DataAssetBase | undefined {
    const key = this.resolveKey(request);
    if (!key) {
      return undefined;
    }

    const registration = this.registrationsByKey.get(key);
    if (!registration) {
      return undefined;
    }

    const override = request.configOverride ? normalizeConfigRecord(request.configOverride) : undefined;
    if (!override || Object.keys(override).length === 0) {
      return registration.baseAsset;
    }

    const merged = Object.freeze({
      ...registration.entry.baseConfig,
      ...override,
    });

    if (!registration.assetFactory) {
      throw new Error(
        `Data asset '${registration.entry.descriptor.assetId}' does not support config-based loading because no assetFactory was registered.`,
      );
    }

    return registration.assetFactory(merged);
  }

  public clear(): void {
    this.registrationsByKey.clear();
    this.keysByAssetId.clear();
  }

  private resolveKey(query: DataAssetLookup): string | undefined {
    const assetId = query.assetId.trim();
    if (!assetId) {
      return undefined;
    }

    const versionId = normalizeOptional(query.versionId);
    assertValidDataAssetVersion(versionId, "DataAssetLookup.versionId", { allowLabel: true });
    if (versionId) {
      return `${assetId}::${versionId}`;
    }

    const assetKeys = this.keysByAssetId.get(assetId);
    if (!assetKeys || assetKeys.length === 0) {
      return undefined;
    }

    return assetKeys
      .map((key) => {
        const registration = this.registrationsByKey.get(key);
        if (!registration) {
          return undefined;
        }
        return Object.freeze({
          key,
          version: registration.entry.descriptor.version,
        });
      })
      .filter((entry): entry is { readonly key: string; readonly version: DataAssetVersionDescriptor } => Boolean(entry))
      .sort((left, right) => compareDataAssetVersions(left.version.normalized, right.version.normalized))
      .at(-1)?.key;
  }

  private matchesQuery(entry: DataAssetRegistryEntry, query: QueryDataAssets): boolean {
    if (query.category && entry.descriptor.category !== query.category) {
      return false;
    }

    if (query.specialization && entry.descriptor.specialization !== query.specialization) {
      return false;
    }

    if (query.outputShapeKind && entry.descriptor.outputShapeKind !== query.outputShapeKind) {
      return false;
    }

    if (query.schemaIntentId && entry.descriptor.schemaIntent.id !== query.schemaIntentId) {
      return false;
    }

    if (query.previewable !== undefined && entry.descriptor.capabilities.previewable !== query.previewable) {
      return false;
    }

    if (query.configurable !== undefined && entry.descriptor.capabilities.configurable !== query.configurable) {
      return false;
    }

    if (query.executable !== undefined && entry.descriptor.capabilities.executable !== query.executable) {
      return false;
    }

    return true;
  }

  private resolveSchemaIntent(input: RegisterDataAssetRequest): IDatasetSchemaIntent {
    const explicitIntent = input.schemaIntentId
      ? this.schemaIntentRegistry.get(input.schemaIntentId)
      : undefined;
    if (explicitIntent) {
      return explicitIntent;
    }

    if (input.schemaIntentId) {
      throw new Error(`Data asset schema intent '${input.schemaIntentId}' is not registered.`);
    }

    const inferred = this.schemaIntentRegistry.resolveForShapeKind(input.asset.toCanonicalDataShape().kind)
      ?? this.schemaIntentRegistry.get(DatasetSchemaIntentIds.tabular);
    if (!inferred) {
      throw new Error("No schema intent could be resolved for data asset registration.");
    }
    return inferred;
  }
}
