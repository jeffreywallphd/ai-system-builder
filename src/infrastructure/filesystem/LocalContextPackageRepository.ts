import path from "node:path";
import { ContextPackage } from "../../application/context/models/ContextPackage";
import { ContextFragment } from "../../application/context/models/ContextFragment";
import { ContextPackageReference } from "../../application/context/models/ContextPackageReference";
import type {
  IContextPackageListCriteria,
  IContextPackageRepository,
  IContextPackageSummary,
} from "../../application/ports/interfaces/IContextPackageRepository";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";

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
    const haystack = [
      record.id,
      record.name,
      record.description,
      record.version,
      ...(record.tags ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return includesAny(record.tags ?? [], criteria.tags);
}

export class LocalContextPackageRepository implements IContextPackageRepository {
  private readonly fileStorage: IFileStorage;
  private readonly rootDirectory: string;

  constructor(params: { fileStorage: IFileStorage; rootDirectory: string }) {
    this.fileStorage = params.fileStorage;
    this.rootDirectory = params.rootDirectory.trim();
  }

  public async save(contextPackage: ContextPackage): Promise<ContextPackage> {
    const filePath = this.resolveContextPackagePath(contextPackage.id);
    const record = this.toRecord(contextPackage);

    await this.fileStorage.write({
      path: filePath,
      content: JSON.stringify(record, null, 2),
      createDirectories: true,
      overwrite: true,
    });

    return ContextPackage.from(contextPackage);
  }

  public async load(id: string): Promise<ContextPackage | undefined> {
    const filePath = this.resolveContextPackagePath(id);

    if (!(await this.fileStorage.exists(filePath))) {
      return undefined;
    }

    const content = await this.fileStorage.readText(filePath, "utf-8");
    return this.toDomain(JSON.parse(content) as ContextPackageRecord);
  }

  public async list(
    criteria?: IContextPackageListCriteria
  ): Promise<ReadonlyArray<IContextPackageSummary>> {
    const info = await this.fileStorage.stat(this.rootDirectory);

    if (info.kind === "missing") {
      return Object.freeze([]);
    }

    const entries = await this.fileStorage.list(this.rootDirectory, {
      recursive: false,
      includeHidden: false,
    });

    const summaries: IContextPackageSummary[] = [];

    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const record = JSON.parse(
        await this.fileStorage.readText(entry.path, "utf-8")
      ) as ContextPackageRecord;

      if (!matchesCriteria(record, criteria)) {
        continue;
      }

      summaries.push(this.toSummary(record));
    }

    const sorted = summaries.sort((left, right) => left.name.localeCompare(right.name));
    return Object.freeze(
      criteria?.limit && criteria.limit > 0 ? sorted.slice(0, criteria.limit) : sorted
    );
  }

  public async exists(id: string): Promise<boolean> {
    return this.fileStorage.exists(this.resolveContextPackagePath(id));
  }

  public async delete(id: string): Promise<void> {
    const filePath = this.resolveContextPackagePath(id);

    if (!(await this.fileStorage.exists(filePath))) {
      return;
    }

    await this.fileStorage.delete(filePath);
  }

  private resolveContextPackagePath(id: string): string {
    const contextPackageId = id.trim();

    if (!contextPackageId) {
      throw new Error("Context package ID cannot be empty.");
    }

    return path.join(this.rootDirectory, `${contextPackageId}.json`);
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
          })
      ),
      references: (record.references ?? []).map(
        (reference) => new ContextPackageReference(reference)
      ),
      audit: {
        createdAt: record.audit?.createdAt ? new Date(record.audit.createdAt) : undefined,
        updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
      },
    });
  }
}
