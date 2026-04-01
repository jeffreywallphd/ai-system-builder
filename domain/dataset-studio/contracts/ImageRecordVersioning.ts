import {
  compareDataAssetVersions,
  parseDataAssetVersion,
} from "../DataAssetVersioning";

export const ImageRecordContractIdentifier = "image-record" as const;

export const ImageRecordSchemaVersions = Object.freeze({
  minimumCompatible: "1.0.0",
  current: "1.1.0",
} as const);

export interface ImageRecordVersionCompatibility {
  readonly declaredSchemaVersion?: string;
  readonly resolvedSchemaVersion: string;
  readonly compatible: boolean;
  readonly reason:
    | "compatible"
    | "schema-version-missing"
    | "schema-version-below-minimum"
    | "schema-version-invalid"
    | "schema-version-incompatible-major";
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveImageRecordSchemaVersion(schemaVersion?: string): string {
  return normalizeOptional(schemaVersion) ?? ImageRecordSchemaVersions.minimumCompatible;
}

export function assessImageRecordVersionCompatibility(
  schemaVersion?: string,
): ImageRecordVersionCompatibility {
  const declaredSchemaVersion = normalizeOptional(schemaVersion);
  const resolvedSchemaVersion = resolveImageRecordSchemaVersion(declaredSchemaVersion);
  const parsedResolved = parseDataAssetVersion(resolvedSchemaVersion);

  if (!declaredSchemaVersion) {
    return Object.freeze({
      declaredSchemaVersion: undefined,
      resolvedSchemaVersion,
      compatible: true,
      reason: "schema-version-missing",
    });
  }

  if (parsedResolved.scheme !== "semantic") {
    return Object.freeze({
      declaredSchemaVersion,
      resolvedSchemaVersion,
      compatible: false,
      reason: "schema-version-invalid",
    });
  }

  if (compareDataAssetVersions(
    resolvedSchemaVersion,
    ImageRecordSchemaVersions.minimumCompatible,
  ) < 0) {
    return Object.freeze({
      declaredSchemaVersion,
      resolvedSchemaVersion,
      compatible: false,
      reason: "schema-version-below-minimum",
    });
  }

  const current = parseDataAssetVersion(ImageRecordSchemaVersions.current);
  if (
    current.scheme === "semantic"
    && parsedResolved.major !== current.major
    && compareDataAssetVersions(resolvedSchemaVersion, ImageRecordSchemaVersions.current) > 0
  ) {
    return Object.freeze({
      declaredSchemaVersion,
      resolvedSchemaVersion,
      compatible: false,
      reason: "schema-version-incompatible-major",
    });
  }

  return Object.freeze({
    declaredSchemaVersion,
    resolvedSchemaVersion,
    compatible: true,
    reason: "compatible",
  });
}
