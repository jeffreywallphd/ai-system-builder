export interface IContextPackageReference {
  readonly packageId: string;
  readonly alias?: string;
  readonly version?: string;
  readonly fragmentIds?: ReadonlyArray<string>;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextPackageReference.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeFragmentIds(fragmentIds?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!fragmentIds || fragmentIds.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(fragmentIds.map((fragmentId) => fragmentId.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export class ContextPackageReference implements IContextPackageReference {
  public readonly packageId: string;
  public readonly alias?: string;
  public readonly version?: string;
  public readonly fragmentIds?: ReadonlyArray<string>;

  constructor(params: {
    packageId: string;
    alias?: string;
    version?: string;
    fragmentIds?: ReadonlyArray<string>;
  }) {
    this.packageId = normalizeRequired(params.packageId, "packageId");
    this.alias = normalizeOptional(params.alias);
    this.version = normalizeOptional(params.version);
    this.fragmentIds = freezeFragmentIds(params.fragmentIds);
  }

  public static from(reference: IContextPackageReference): ContextPackageReference {
    return new ContextPackageReference(reference);
  }
}
