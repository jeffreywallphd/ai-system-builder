import { ContextPackage } from "@application/context/models/ContextPackage";
import { ContextFragment } from "@application/context/models/ContextFragment";
import { ContextPackageReference } from "@application/context/models/ContextPackageReference";
import type {
  IContextPackageListCriteria,
  IContextPackageRepository,
  IContextPackageSummary,
} from "@application/ports/interfaces/IContextPackageRepository";

interface ContextPackageRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly fragments: ReadonlyArray<{
    readonly id: string;
    readonly kind: ContextFragment["kind"];
    readonly title?: string;
    readonly content: string;
    readonly order: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
  readonly references?: ReadonlyArray<{
    readonly packageId: string;
    readonly alias?: string;
    readonly version?: string;
    readonly fragmentIds?: ReadonlyArray<string>;
  }>;
  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };
}

const defaultStorageKey = "ai-loom-studio.context-packages";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(candidates: ReadonlyArray<string>, filters?: ReadonlyArray<string>): boolean {
  if (!filters || filters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(candidates.map(normalize));
  return filters.some((filter) => normalizedCandidates.has(normalize(filter)));
}

function matchesCriteria(record: ContextPackageRecord, criteria?: IContextPackageListCriteria): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [record.id, record.name, record.description, record.version, ...(record.tags ?? [])]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return includesAny(record.tags ?? [], criteria.tags);
}

export class LocalStorageContextPackageRepository implements IContextPackageRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async save(contextPackage: ContextPackage): Promise<ContextPackage> {
    const records = await this.readRecords();
    records.set(contextPackage.id, this.toRecord(contextPackage));
    this.writeRecords(records);
    return ContextPackage.from(contextPackage);
  }

  public async load(id: string): Promise<ContextPackage | undefined> {
    const record = (await this.readRecords()).get(id.trim());
    return record ? this.toDomain(record) : undefined;
  }

  public async list(
    criteria?: IContextPackageListCriteria
  ): Promise<ReadonlyArray<IContextPackageSummary>> {
    const summaries = [...(await this.readRecords()).values()]
      .filter((record) => matchesCriteria(record, criteria))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((record) => this.toSummary(record));

    return Object.freeze(
      criteria?.limit && criteria.limit > 0 ? summaries.slice(0, criteria.limit) : summaries,
    );
  }

  public async exists(id: string): Promise<boolean> {
    return (await this.readRecords()).has(id.trim());
  }

  public async delete(id: string): Promise<void> {
    const records = await this.readRecords();
    records.delete(id.trim());
    this.writeRecords(records);
  }

  private async readRecords(): Promise<Map<string, ContextPackageRecord>> {
    const raw = this.storage?.getItem(this.storageKey);

    if (!raw) {
      return new Map<string, ContextPackageRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<ContextPackageRecord>;
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      return new Map<string, ContextPackageRecord>();
    }
  }

  private writeRecords(records: Map<string, ContextPackageRecord>): void {
    const serialized = JSON.stringify([...records.values()], null, 2);
    this.storage?.setItem(this.storageKey, serialized);
  }

  private toSummary(record: ContextPackageRecord): IContextPackageSummary {
    return Object.freeze({
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      tags: Object.freeze([...(record.tags ?? [])]),
      fragmentCount: record.fragments.length,
      updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
    });
  }

  private toRecord(contextPackage: ContextPackage): ContextPackageRecord {
    return {
      id: contextPackage.id,
      name: contextPackage.name,
      description: contextPackage.description,
      version: contextPackage.version,
      tags: contextPackage.tags,
      fragments: contextPackage.fragments.map((fragment) => ({
        id: fragment.id,
        kind: fragment.kind,
        title: fragment.title,
        content: fragment.content,
        order: fragment.order,
        metadata: fragment.metadata,
      })),
      references: contextPackage.references.map((reference) => ({
        packageId: reference.packageId,
        alias: reference.alias,
        version: reference.version,
        fragmentIds: reference.fragmentIds,
      })),
      audit: contextPackage.audit
        ? {
            createdAt: contextPackage.audit.createdAt?.toISOString(),
            updatedAt: contextPackage.audit.updatedAt?.toISOString(),
          }
        : undefined,
    };
  }

  private toDomain(record: ContextPackageRecord): ContextPackage {
    return new ContextPackage({
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      tags: record.tags,
      fragments: record.fragments.map(
        (fragment) =>
          new ContextFragment({
            id: fragment.id,
            kind: fragment.kind,
            title: fragment.title,
            content: fragment.content,
            order: fragment.order,
            metadata: fragment.metadata,
          }),
      ),
      references: (record.references ?? []).map(
        (reference) => new ContextPackageReference(reference),
      ),
      audit: {
        createdAt: record.audit?.createdAt ? new Date(record.audit.createdAt) : undefined,
        updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
      },
    });
  }
}

