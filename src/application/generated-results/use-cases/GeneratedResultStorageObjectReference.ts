export interface GeneratedResultStorageObjectLookup {
  readonly storageInstanceId: string;
  readonly objectKey: string;
}

export function resolveGeneratedResultStorageObjectLookup(input: {
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly logicalAssetVersionId?: string;
}): GeneratedResultStorageObjectLookup | undefined {
  const candidates = [
    input.storageBindingReference,
    input.logicalAssetVersionId,
  ];

  for (const candidate of candidates) {
    const parsed = parseGeneratedResultStorageObjectReference(candidate);
    if (!parsed) {
      continue;
    }
    if (parsed.storageInstanceId !== input.storageInstanceId) {
      continue;
    }
    return parsed;
  }
  return undefined;
}

export function parseGeneratedResultStorageObjectReference(
  reference: string | undefined,
): GeneratedResultStorageObjectLookup | undefined {
  const normalized = reference?.trim();
  if (!normalized) {
    return undefined;
  }

  const withoutGeneratedPrefix = normalized.startsWith("generated-output:")
    ? normalized.slice("generated-output:".length)
    : normalized;
  if (!withoutGeneratedPrefix.startsWith("storage-instance://")) {
    return undefined;
  }

  const remainder = withoutGeneratedPrefix.slice("storage-instance://".length);
  const [encodedStorageInstanceId, ...objectSegments] = remainder.split("/");
  const decodedStorageInstanceId = decodeURIComponent((encodedStorageInstanceId ?? "").trim());
  if (!decodedStorageInstanceId || objectSegments.length < 1) {
    return undefined;
  }

  const objectKey = objectSegments
    .map((segment) => decodeURIComponent(segment))
    .join("/")
    .trim();
  if (!objectKey || objectKey.includes("\\") || objectKey.includes("..")) {
    return undefined;
  }

  return Object.freeze({
    storageInstanceId: decodedStorageInstanceId,
    objectKey,
  });
}
