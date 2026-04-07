import type { ExchangeAccessContext } from "./ExchangeAccessControl";
import {
  ExchangeAccessActions,
  ExchangeAccessDeniedError,
  ExchangeAccessEvaluator,
} from "./ExchangeAccessControl";
import {
  createExchangeCatalogEntry,
  type ExchangeCatalogEntry,
  type ExchangeCatalogStorageReference,
} from "@domain/exchange/ExchangeCatalog";
import type { PublishablePackage } from "@domain/exchange/PublishablePackage";

export interface ExchangeCatalogListCriteria {
  readonly catalogId: string;
  readonly packageKinds?: ReadonlyArray<PublishablePackage["source"]["rootSubject"]["kind"]>;
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface ExchangeCatalogRepository {
  saveEntry(entry: ExchangeCatalogEntry): Promise<void>;
  getEntry(catalogId: string, packageId: string): Promise<ExchangeCatalogEntry | undefined>;
  listEntries(criteria: ExchangeCatalogListCriteria): Promise<ReadonlyArray<ExchangeCatalogEntry>>;
  resolveStorageReference(catalogId: string, packageId: string): Promise<ExchangeCatalogStorageReference | undefined>;
}

export interface ExchangeCatalogQueryService {
  listCatalogEntries(criteria: ExchangeCatalogListCriteria, context?: ExchangeAccessContext): Promise<ReadonlyArray<ExchangeCatalogEntry>>;
  getCatalogEntry(catalogId: string, packageId: string, context?: ExchangeAccessContext): Promise<ExchangeCatalogEntry | undefined>;
  resolveCatalogArtifactReference(catalogId: string, packageId: string, context?: ExchangeAccessContext): Promise<ExchangeCatalogStorageReference | undefined>;
}

export type RegisterExchangeCatalogEntryResult = {
  readonly ok: true;
  readonly entry: ExchangeCatalogEntry;
} | {
  readonly ok: false;
  readonly code: "invalid-request" | "forbidden";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

function normalizeArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])].map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

function normalizeQuery(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function matchesCriteria(entry: ExchangeCatalogEntry, criteria: ExchangeCatalogListCriteria): boolean {
  if (entry.catalogId.value !== criteria.catalogId.trim()) {
    return false;
  }

  const query = normalizeQuery(criteria.query);
  if (query) {
    const haystack = [
      entry.packageId.value,
      entry.metadata.title,
      entry.metadata.summary,
      entry.metadata.sourceRootAssetId,
      entry.metadata.sourceRootVersionId,
      ...entry.metadata.tags,
      ...entry.metadata.capabilityHints,
    ].filter(Boolean).map((value) => String(value).toLowerCase());

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  if (criteria.packageKinds && criteria.packageKinds.length > 0 && !criteria.packageKinds.includes(entry.metadata.sourceRootKind)) {
    return false;
  }

  const requiredTags = normalizeArray(criteria.tags);
  if (requiredTags.length > 0) {
    const tagSet = new Set(normalizeArray(entry.metadata.tags));
    if (!requiredTags.every((tag) => tagSet.has(tag))) {
      return false;
    }
  }

  return true;
}

export interface LocalExchangeCatalogEntryStore {
  save(entry: ExchangeCatalogEntry): Promise<void>;
  get(catalogId: string, packageId: string): Promise<ExchangeCatalogEntry | undefined>;
  list(catalogId: string): Promise<ReadonlyArray<ExchangeCatalogEntry>>;
}

export type LocalExchangeCatalogEntry = ExchangeCatalogEntry;
export type LocalExchangeCatalogArtifactReference = ExchangeCatalogStorageReference;

export class InMemoryLocalExchangeCatalogEntryStore implements LocalExchangeCatalogEntryStore {
  private readonly records = new Map<string, ExchangeCatalogEntry>();

  public async save(entry: ExchangeCatalogEntry): Promise<void> {
    this.records.set(this.key(entry.catalogId.value, entry.packageId.value), entry);
  }

  public async get(catalogId: string, packageId: string): Promise<ExchangeCatalogEntry | undefined> {
    return this.records.get(this.key(catalogId, packageId));
  }

  public async list(catalogId: string): Promise<ReadonlyArray<ExchangeCatalogEntry>> {
    return Object.freeze([...this.records.values()].filter((entry) => entry.catalogId.value === catalogId));
  }

  private key(catalogId: string, packageId: string): string {
    return `${catalogId.trim()}::${packageId.trim()}`;
  }
}

export class LocalExchangeCatalog implements ExchangeCatalogRepository, ExchangeCatalogQueryService {
  public constructor(
    private readonly store: LocalExchangeCatalogEntryStore = new InMemoryLocalExchangeCatalogEntryStore(),
    private readonly accessEvaluator: ExchangeAccessEvaluator = new ExchangeAccessEvaluator(),
  ) {}

  public async registerPackage(input: {
    readonly catalogId: string;
    readonly package: PublishablePackage;
    readonly storageReference: LocalExchangeCatalogArtifactReference;
    readonly metadata?: {
      readonly title?: string;
      readonly summary?: string;
      readonly tags?: ReadonlyArray<string>;
      readonly capabilityHints?: ReadonlyArray<string>;
      readonly configurationHints?: Readonly<Record<string, unknown>>;
    };
    readonly context?: ExchangeAccessContext;
    readonly resourceTenantId?: string;
  }): Promise<RegisterExchangeCatalogEntryResult> {
    try {
      this.accessEvaluator.assertAllowed({
        action: ExchangeAccessActions.managePublishablePackage,
        context: input.context,
        sourceAssetId: input.package.source.rootSubject.assetId,
        sourceVersionId: input.package.source.rootSubject.versionId,
        bundleId: input.package.source.bundleId.value,
        packageId: input.package.packageId.value,
        resourceTenantId: input.resourceTenantId,
      });

      const entry = createExchangeCatalogEntry({
        catalogId: input.catalogId,
        package: input.package,
        storageReference: input.storageReference,
        metadata: input.metadata,
      });
      await this.saveEntry(entry);
      return { ok: true, entry };
    } catch (error) {
      if (error instanceof ExchangeAccessDeniedError) {
        return {
          ok: false,
          code: "forbidden",
          message: error.decision.message ?? "Exchange catalog registration denied.",
          details: { decision: error.decision },
        };
      }

      return {
        ok: false,
        code: "invalid-request",
        message: error instanceof Error ? error.message : "Exchange catalog registration failed.",
      };
    }
  }

  public async saveEntry(entry: ExchangeCatalogEntry): Promise<void> {
    await this.store.save(entry);
  }

  public async getEntry(catalogId: string, packageId: string): Promise<ExchangeCatalogEntry | undefined> {
    return this.store.get(catalogId.trim(), packageId.trim());
  }

  public async listEntries(criteria: ExchangeCatalogListCriteria): Promise<ReadonlyArray<ExchangeCatalogEntry>> {
    const entries = await this.store.list(criteria.catalogId.trim());
    const filtered = entries
      .filter((entry) => matchesCriteria(entry, criteria))
      .sort((left, right) => {
        if (left.updatedAt !== right.updatedAt) {
          return left.updatedAt.localeCompare(right.updatedAt);
        }
        return left.packageId.value.localeCompare(right.packageId.value);
      });

    if (criteria.limit && criteria.limit > 0) {
      return Object.freeze(filtered.slice(0, criteria.limit));
    }

    return Object.freeze(filtered);
  }

  public async resolveStorageReference(catalogId: string, packageId: string): Promise<ExchangeCatalogStorageReference | undefined> {
    const entry = await this.getEntry(catalogId, packageId);
    return entry?.storageReference;
  }

  public async listCatalogEntries(criteria: ExchangeCatalogListCriteria, context?: ExchangeAccessContext): Promise<ReadonlyArray<ExchangeCatalogEntry>> {
    this.assertCatalogReadAllowed({ criteria, context });
    return this.listEntries(criteria);
  }

  public async getCatalogEntry(catalogId: string, packageId: string, context?: ExchangeAccessContext): Promise<ExchangeCatalogEntry | undefined> {
    const entry = await this.getEntry(catalogId, packageId);
    if (!entry) {
      return undefined;
    }

    this.assertCatalogReadAllowed({
      context,
      criteria: {
        catalogId,
        packageKinds: [entry.metadata.sourceRootKind],
      },
      entry,
    });

    return entry;
  }

  public async resolveCatalogArtifactReference(catalogId: string, packageId: string, context?: ExchangeAccessContext): Promise<ExchangeCatalogStorageReference | undefined> {
    const entry = await this.getCatalogEntry(catalogId, packageId, context);
    return entry?.storageReference;
  }

  private assertCatalogReadAllowed(input: {
    readonly criteria: ExchangeCatalogListCriteria;
    readonly context?: ExchangeAccessContext;
    readonly entry?: ExchangeCatalogEntry;
  }): void {
    this.accessEvaluator.assertAllowed({
      action: ExchangeAccessActions.createPublishablePackage,
      context: input.context,
      sourceAssetId: input.entry?.metadata.sourceRootAssetId,
      sourceVersionId: input.entry?.metadata.sourceRootVersionId,
      bundleId: input.entry?.metadata.sourceBundleId,
      packageId: input.entry?.packageId.value,
    });
  }
}

