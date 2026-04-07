const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

export const DataAssetVersionSchemes = Object.freeze({
  semantic: "semantic",
  label: "label",
  unversioned: "unversioned",
} as const);

export type DataAssetVersionScheme = typeof DataAssetVersionSchemes[keyof typeof DataAssetVersionSchemes];

export interface DataAssetVersionDescriptor {
  readonly raw?: string;
  readonly normalized?: string;
  readonly scheme: DataAssetVersionScheme;
  readonly comparable: boolean;
  readonly major?: number;
  readonly minor?: number;
  readonly patch?: number;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function parseDataAssetVersion(version?: string): DataAssetVersionDescriptor {
  const normalized = normalizeOptional(version);
  if (!normalized) {
    return Object.freeze({
      raw: version,
      normalized: undefined,
      scheme: DataAssetVersionSchemes.unversioned,
      comparable: true,
    });
  }

  const semverMatch = SEMVER_PATTERN.exec(normalized);
  if (!semverMatch) {
    return Object.freeze({
      raw: version,
      normalized,
      scheme: DataAssetVersionSchemes.label,
      comparable: false,
    });
  }

  return Object.freeze({
    raw: version,
    normalized,
    scheme: DataAssetVersionSchemes.semantic,
    comparable: true,
    major: Number(semverMatch[1]),
    minor: Number(semverMatch[2]),
    patch: Number(semverMatch[3]),
  });
}

export function isValidDataAssetVersion(
  version?: string,
  options: { readonly allowLabel?: boolean } = {},
): boolean {
  const parsed = parseDataAssetVersion(version);
  if (parsed.scheme === DataAssetVersionSchemes.label) {
    return options.allowLabel === true;
  }

  return true;
}

export function compareDataAssetVersions(left?: string, right?: string): number {
  const lhs = parseDataAssetVersion(left);
  const rhs = parseDataAssetVersion(right);

  if (lhs.comparable && rhs.comparable) {
    if ((lhs.major ?? 0) !== (rhs.major ?? 0)) {
      return (lhs.major ?? 0) - (rhs.major ?? 0);
    }
    if ((lhs.minor ?? 0) !== (rhs.minor ?? 0)) {
      return (lhs.minor ?? 0) - (rhs.minor ?? 0);
    }
    if ((lhs.patch ?? 0) !== (rhs.patch ?? 0)) {
      return (lhs.patch ?? 0) - (rhs.patch ?? 0);
    }
    return 0;
  }

  if (lhs.comparable !== rhs.comparable) {
    return lhs.comparable ? 1 : -1;
  }

  const leftNormalized = lhs.normalized ?? "";
  const rightNormalized = rhs.normalized ?? "";
  return leftNormalized.localeCompare(rightNormalized);
}

export function assertValidDataAssetVersion(
  version: string | undefined,
  fieldName: string,
  options: { readonly allowLabel?: boolean } = {},
): void {
  if (!isValidDataAssetVersion(version, options)) {
    throw new Error(`${fieldName} must be empty or a semantic version like '1.2.3' (optional 'v' prefix).`);
  }
}
