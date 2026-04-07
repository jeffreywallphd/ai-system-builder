import {
  ContextFragment,
  type IContextFragment,
} from "./ContextFragment";
import {
  ContextPackageReference,
  type IContextPackageReference,
} from "./ContextPackageReference";

export interface IContextPackageAuditInfo {
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface IContextPackage {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags: ReadonlyArray<string>;
  readonly fragments: ReadonlyArray<IContextFragment>;
  readonly references: ReadonlyArray<IContextPackageReference>;
  readonly audit?: IContextPackageAuditInfo;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextPackage.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  const normalized = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  return Object.freeze(normalized);
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

function freezeAudit(audit?: IContextPackageAuditInfo): IContextPackageAuditInfo | undefined {
  if (!audit) {
    return undefined;
  }

  return Object.freeze({
    createdAt: cloneDate(audit.createdAt),
    updatedAt: cloneDate(audit.updatedAt),
  });
}

function freezeFragments(
  fragments?: ReadonlyArray<IContextFragment>
): ReadonlyArray<ContextFragment> {
  const deduped = new Map<string, ContextFragment>();

  for (const fragment of fragments ?? []) {
    const normalized = ContextFragment.from(fragment);
    deduped.set(normalized.id, normalized);
  }

  return Object.freeze(
    [...deduped.values()].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    )
  );
}

function freezeReferences(
  references?: ReadonlyArray<IContextPackageReference>
): ReadonlyArray<ContextPackageReference> {
  return Object.freeze(
    (references ?? []).map((reference) => ContextPackageReference.from(reference))
  );
}

export class ContextPackage implements IContextPackage {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly version?: string;
  public readonly tags: ReadonlyArray<string>;
  public readonly fragments: ReadonlyArray<ContextFragment>;
  public readonly references: ReadonlyArray<ContextPackageReference>;
  public readonly audit?: IContextPackageAuditInfo;

  constructor(params: {
    id: string;
    name: string;
    description?: string;
    version?: string;
    tags?: ReadonlyArray<string>;
    fragments?: ReadonlyArray<IContextFragment>;
    references?: ReadonlyArray<IContextPackageReference>;
    audit?: IContextPackageAuditInfo;
  }) {
    this.id = normalizeRequired(params.id, "id");
    this.name = normalizeRequired(params.name, "name");
    this.description = normalizeOptional(params.description);
    this.version = normalizeOptional(params.version);
    this.tags = freezeTags(params.tags);
    this.fragments = freezeFragments(params.fragments);
    this.references = freezeReferences(params.references);
    this.audit = freezeAudit(params.audit);
  }

  public getFragmentById(fragmentId: string): ContextFragment | undefined {
    const normalizedId = fragmentId.trim();
    return this.fragments.find((fragment) => fragment.id === normalizedId);
  }

  public getFragmentText(): string {
    return this.fragments.map((fragment) => fragment.content).join("\n\n");
  }

  public static from(contextPackage: IContextPackage): ContextPackage {
    return new ContextPackage({
      id: contextPackage.id,
      name: contextPackage.name,
      description: contextPackage.description,
      version: contextPackage.version,
      tags: contextPackage.tags,
      fragments: contextPackage.fragments,
      references: contextPackage.references,
      audit: contextPackage.audit,
    });
  }
}
