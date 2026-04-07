import type { AssetVersion } from "@domain/assets/AssetVersion";
import {
  SerializedSystemAssetReferenceKinds,
  type SerializedSystemAssetReference,
} from "@domain/system-studio/SystemSerializationContract";
import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";

export const SerializedAssetReferenceResolutionIssueCodes = Object.freeze({
  invalidReference: "invalid-reference",
  missingAsset: "missing-asset",
  incompatibleVersion: "incompatible-version",
  unsupportedSerializedVersion: "unsupported-serialized-version",
});

export type SerializedAssetReferenceResolutionIssueCode =
  typeof SerializedAssetReferenceResolutionIssueCodes[keyof typeof SerializedAssetReferenceResolutionIssueCodes];

export interface SerializedAssetReferenceResolutionIssue {
  readonly code: SerializedAssetReferenceResolutionIssueCode;
  readonly message: string;
  readonly reference: Partial<SerializedSystemAssetReference>;
}

export interface SerializedAssetReferenceResolution {
  readonly reference: SerializedSystemAssetReference;
  readonly resolvedVersion: AssetVersion;
}

export interface SerializedAssetReferenceResolutionResult {
  readonly ok: boolean;
  readonly resolved: ReadonlyArray<SerializedAssetReferenceResolution>;
  readonly issues: ReadonlyArray<SerializedAssetReferenceResolutionIssue>;
}

function classifyVersionKind(version: AssetVersion): "dataset" | "workflow" | "system" | "component" {
  const metadata = version.metadata as { readonly metadata?: { readonly taxonomy?: { readonly structuralKind?: unknown; readonly semanticRole?: unknown } } } | undefined;
  const taxonomy = metadata?.metadata?.taxonomy;
  const structuralKind = typeof taxonomy?.structuralKind === "string" ? taxonomy.structuralKind : undefined;
  const semanticRole = typeof taxonomy?.semanticRole === "string" ? taxonomy.semanticRole : undefined;

  if (version.assetId.value.includes("dataset") || semanticRole === "dataset") {
    return "dataset";
  }
  if (structuralKind === "system" || semanticRole === "system" || version.assetId.value.startsWith("system:")) {
    return "system";
  }
  if (version.assetId.value.includes("workflow") || semanticRole === "workflow" || semanticRole === "workflow-template") {
    return "workflow";
  }
  return "component";
}

function isKindCompatible(reference: SerializedSystemAssetReference, version: AssetVersion): boolean {
  const resolvedKind = classifyVersionKind(version);
  if (reference.kind === SerializedSystemAssetReferenceKinds.component || reference.kind === SerializedSystemAssetReferenceKinds.dependency) {
    return true;
  }
  return resolvedKind === reference.kind;
}

export class SerializedAssetReferenceResolutionService {
  public constructor(private readonly repository: IStudioShellRepository) {}

  public async resolveReferences(input: {
    readonly references: ReadonlyArray<SerializedSystemAssetReference>;
    readonly serializedSchemaVersion: string;
  }): Promise<SerializedAssetReferenceResolutionResult> {
    if (input.serializedSchemaVersion !== "1.0.0") {
      return Object.freeze({
        ok: false,
        resolved: Object.freeze([]),
        issues: Object.freeze([Object.freeze({
          code: SerializedAssetReferenceResolutionIssueCodes.unsupportedSerializedVersion,
          message: `Serialized system schema version '${input.serializedSchemaVersion}' is not supported by this resolver.`,
          reference: Object.freeze({}),
        })]),
      });
    }

    const issues: SerializedAssetReferenceResolutionIssue[] = [];
    const resolved: SerializedAssetReferenceResolution[] = [];

    for (const reference of input.references) {
      if (!reference.assetId?.trim() || !reference.kind?.trim()) {
        issues.push(Object.freeze({
          code: SerializedAssetReferenceResolutionIssueCodes.invalidReference,
          message: "Serialized reference requires kind and assetId.",
          reference,
        }));
        continue;
      }

      if (reference.versionId) {
        const byVersion = await this.repository.getAssetVersion(reference.versionId);
        if (!byVersion) {
          const versions = await this.repository.listAssetVersionsByAssetId(reference.assetId);
          issues.push(Object.freeze({
            code: versions.length > 0
              ? SerializedAssetReferenceResolutionIssueCodes.incompatibleVersion
              : SerializedAssetReferenceResolutionIssueCodes.missingAsset,
            message: versions.length > 0
              ? `Reference '${reference.assetId}' does not provide version '${reference.versionId}'.`
              : `Asset '${reference.assetId}' could not be found.`,
            reference,
          }));
          continue;
        }
        if (byVersion.assetId.value !== reference.assetId) {
          issues.push(Object.freeze({
            code: SerializedAssetReferenceResolutionIssueCodes.incompatibleVersion,
            message: `Version '${reference.versionId}' belongs to '${byVersion.assetId.value}', not '${reference.assetId}'.`,
            reference,
          }));
          continue;
        }
        if (!isKindCompatible(reference, byVersion)) {
          issues.push(Object.freeze({
            code: SerializedAssetReferenceResolutionIssueCodes.incompatibleVersion,
            message: `Version '${reference.versionId}' is not compatible with kind '${reference.kind}'.`,
            reference,
          }));
          continue;
        }
        resolved.push(Object.freeze({ reference, resolvedVersion: byVersion }));
        continue;
      }

      const versions = await this.repository.listAssetVersionsByAssetId(reference.assetId);
      if (versions.length === 0) {
        issues.push(Object.freeze({
          code: SerializedAssetReferenceResolutionIssueCodes.missingAsset,
          message: `Asset '${reference.assetId}' could not be found.`,
          reference,
        }));
        continue;
      }

      const latest = [...versions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]!;
      if (!isKindCompatible(reference, latest)) {
        issues.push(Object.freeze({
          code: SerializedAssetReferenceResolutionIssueCodes.incompatibleVersion,
          message: `Latest version '${latest.versionId}' is not compatible with kind '${reference.kind}'.`,
          reference,
        }));
        continue;
      }
      resolved.push(Object.freeze({ reference, resolvedVersion: latest }));
    }

    return Object.freeze({
      ok: issues.length === 0,
      resolved: Object.freeze(resolved),
      issues: Object.freeze(issues),
    });
  }
}

