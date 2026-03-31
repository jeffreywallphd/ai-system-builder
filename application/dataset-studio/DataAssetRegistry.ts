import { createDatasetStudioTaxonomy } from "../../domain/dataset-studio/DatasetStudioDomain";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetBase } from "../../domain/dataset-studio/DataAssetBase";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import {
  createDataAssetConfigSchema,
  inferDataAssetConfigSchema,
  resolveDataAssetConfigDefaults,
  type DataAssetConfigFieldSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";

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

export interface DataAssetRegistryDescriptor {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly specialization: DataAssetRegistrySpecialization;
  readonly outputShapeKind: CanonicalDataShapeKind;
  readonly composableInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
  readonly display: DataAssetRegistryDisplayMetadata;
  readonly contracts: DataAssetRegistryContractReferences;
  readonly capabilities: DataAssetRegistryCapabilities;
  readonly configSchema: DataAssetConfigSchema;
}

export interface DataAssetRegistryEntry {
  readonly descriptor: DataAssetRegistryDescriptor;
  readonly baseConfig: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface RegisterDataAssetRequest {
  readonly asset: DataAssetBase;
  readonly specialization?: DataAssetRegistrySpecialization;
  readonly display?: DataAssetRegistryDisplayMetadata;
  readonly configSchema?: DataAssetConfigSchema;
  readonly configFields?: ReadonlyArray<DataAssetConfigFieldSchema>;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
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
  readonly specialization?: DataAssetRegistrySpecialization;
  readonly outputShapeKind?: CanonicalDataShapeKind;
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

function normalizeConfigRecord(config: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(config)
      .map(([key, value]) => [key.trim(), value] as const)
      .filter(([key]) => key.length > 0),
  ));
}

function buildCapabilities(asset: DataAssetBase): DataAssetRegistryCapabilities {
  return Object.freeze({
    configurable: Object.keys(asset.config.values).length > 0,
    previewable: asset.supportsPreview,
    executable: true,
  });
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
  readonly specialization: DataAssetRegistrySpecialization;
  readonly display?: DataAssetRegistryDisplayMetadata;
  readonly configSchema: DataAssetConfigSchema;
  readonly taxonomy: CompositionTaxonomyDescriptor;
}): DataAssetRegistryDescriptor {
  const shape = input.asset.toCanonicalDataShape();
  return Object.freeze({
    assetId: input.asset.id,
    versionId: normalizeOptional(input.asset.version),
    name: input.asset.name,
    taxonomy: input.taxonomy,
    specialization: input.specialization,
    outputShapeKind: shape.kind,
    composableInputShapeKinds: input.asset.composableInputShapeKinds,
    display: Object.freeze({
      title: normalizeOptional(input.display?.title) ?? input.asset.name,
      summary: normalizeOptional(input.display?.summary),
      tags: normalizeTags(input.display?.tags),
    }),
    contracts: buildContractReferences(input.asset),
    capabilities: buildCapabilities(input.asset),
    configSchema: input.configSchema,
  });
}

export class DataAssetRegistry {
  private readonly registrationsByKey = new Map<string, InternalDataAssetRegistration>();
  private readonly keysByAssetId = new Map<string, ReadonlyArray<string>>();

  public register(input: RegisterDataAssetRequest): DataAssetRegistryEntry {
    const assetId = input.asset.id.trim();
    if (!assetId) {
      throw new Error("Data asset id is required for registration.");
    }

    const versionId = normalizeOptional(input.asset.version);
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

    const descriptor = toDescriptor({
      asset: input.asset,
      specialization: input.specialization ?? DataAssetRegistrySpecializations.dataset,
      display: input.display,
      configSchema,
      taxonomy: input.taxonomy ?? createDatasetStudioTaxonomy(),
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
    if (versionId) {
      return `${assetId}::${versionId}`;
    }

    const assetKeys = this.keysByAssetId.get(assetId);
    if (!assetKeys || assetKeys.length === 0) {
      return undefined;
    }

    return assetKeys[assetKeys.length - 1];
  }

  private matchesQuery(entry: DataAssetRegistryEntry, query: QueryDataAssets): boolean {
    if (query.specialization && entry.descriptor.specialization !== query.specialization) {
      return false;
    }

    if (query.outputShapeKind && entry.descriptor.outputShapeKind !== query.outputShapeKind) {
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
}
