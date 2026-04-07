import type { ExchangeBundleSubjectKind } from "./ExchangeBundleDomain";

export const ImportConflictKinds = Object.freeze({
  identity: "identity",
  version: "version",
  nameCollision: "name-collision",
  structuralIncompatibility: "structural-incompatibility",
  dependencyReference: "dependency-reference",
} as const);

export type ImportConflictKind = typeof ImportConflictKinds[keyof typeof ImportConflictKinds];

export const ImportConflictResolutionDecisions = Object.freeze({
  reuseExisting: "reuse-existing",
  forkLocal: "fork-local",
  remapReference: "remap-reference",
  rejectImport: "reject-import",
} as const);

export type ImportConflictResolutionDecision =
  typeof ImportConflictResolutionDecisions[keyof typeof ImportConflictResolutionDecisions];

export interface ImportConflict {
  readonly kind: ImportConflictKind;
  readonly message: string;
  readonly field?: string;
  readonly dependencyAssetId?: string;
  readonly dependencyVersionId?: string;
}

export interface ImportConflictResolutionResult {
  readonly decision: ImportConflictResolutionDecision;
  readonly conflicts: ReadonlyArray<ImportConflict>;
  readonly resolvedAssetId: string;
  readonly resolvedVersionId: string;
  readonly remappedDependencyVersionIds: Readonly<Record<string, string>>;
  readonly reasons: ReadonlyArray<string>;
}

export class ExchangeImportConflictResolver {
  public resolve(input: {
    readonly subjectKind: ExchangeBundleSubjectKind;
    readonly bundleId: string;
    readonly incomingAssetId: string;
    readonly incomingVersionId: string;
    readonly packageLabel?: string;
    readonly existingAssetIdForVersion?: string;
    readonly hasExistingAsset: boolean;
    readonly hasExistingVersion: boolean;
    readonly existingAssetName?: string;
    readonly manifestName?: string;
    readonly dependencyVersionExists?: Readonly<Record<string, boolean>>;
    readonly dependencyVersionRemapCandidates?: Readonly<Record<string, string | undefined>>;
  }): ImportConflictResolutionResult {
    const conflicts: ImportConflict[] = [];
    const reasons: string[] = [];
    const remapped = new Map<string, string>();

    if (input.hasExistingVersion && input.existingAssetIdForVersion && input.existingAssetIdForVersion !== input.incomingAssetId) {
      conflicts.push(Object.freeze({
        kind: ImportConflictKinds.identity,
        field: "versionId",
        message: `Imported version '${input.incomingVersionId}' belongs to a different internal asset id '${input.existingAssetIdForVersion}'.`,
      }));
      reasons.push("Version identity mismatch cannot be merged safely.");
      return Object.freeze({
        decision: ImportConflictResolutionDecisions.rejectImport,
        conflicts: Object.freeze(conflicts),
        resolvedAssetId: input.incomingAssetId,
        resolvedVersionId: input.incomingVersionId,
        remappedDependencyVersionIds: Object.freeze({}),
        reasons: Object.freeze(reasons),
      });
    }

    if (input.hasExistingVersion) {
      conflicts.push(Object.freeze({
        kind: ImportConflictKinds.version,
        field: "versionId",
        message: `Imported version '${input.incomingVersionId}' already exists and will be reused.`,
      }));
      reasons.push("Existing version is already present; import remains deterministic via reuse.");
      return Object.freeze({
        decision: ImportConflictResolutionDecisions.reuseExisting,
        conflicts: Object.freeze(conflicts),
        resolvedAssetId: input.incomingAssetId,
        resolvedVersionId: input.incomingVersionId,
        remappedDependencyVersionIds: Object.freeze({}),
        reasons: Object.freeze(reasons),
      });
    }

    const manifestName = input.manifestName?.trim();
    const existingAssetName = input.existingAssetName?.trim();
    if (!input.hasExistingAsset && manifestName && existingAssetName && manifestName === existingAssetName) {
      conflicts.push(Object.freeze({
        kind: ImportConflictKinds.nameCollision,
        field: "name",
        message: `Manifest display name '${manifestName}' collides with an internal asset name.`,
      }));
      reasons.push("Name collision requires bounded local fork identity.");
      const forkedAssetId = `${input.incomingAssetId}:imported:${toStableSuffix(input.bundleId)}`;
      return Object.freeze({
        decision: ImportConflictResolutionDecisions.forkLocal,
        conflicts: Object.freeze(conflicts),
        resolvedAssetId: forkedAssetId,
        resolvedVersionId: `${forkedAssetId}:${input.incomingVersionId.split(":").at(-1) ?? "v1"}`,
        remappedDependencyVersionIds: Object.freeze({}),
        reasons: Object.freeze(reasons),
      });
    }

    for (const [dependencyVersionId, exists] of Object.entries(input.dependencyVersionExists ?? {})) {
      if (exists) {
        continue;
      }
      const remapCandidate = input.dependencyVersionRemapCandidates?.[dependencyVersionId]?.trim();
      if (remapCandidate) {
        remapped.set(dependencyVersionId, remapCandidate);
        conflicts.push(Object.freeze({
          kind: ImportConflictKinds.dependencyReference,
          field: "dependencies",
          dependencyVersionId,
          message: `Dependency version '${dependencyVersionId}' was remapped to '${remapCandidate}'.`,
        }));
        reasons.push(`Dependency '${dependencyVersionId}' was remapped conservatively to an available version.`);
        continue;
      }

      conflicts.push(Object.freeze({
        kind: ImportConflictKinds.dependencyReference,
        field: "dependencies",
        dependencyVersionId,
        message: `Dependency version '${dependencyVersionId}' is not available for import finalization.`,
      }));
      reasons.push("Dependency gap has no bounded remap candidate; reference is preserved for later resolution.");
    }

    const decision = remapped.size > 0
      ? ImportConflictResolutionDecisions.remapReference
      : ImportConflictResolutionDecisions.forkLocal;
    if (decision === ImportConflictResolutionDecisions.forkLocal) {
      reasons.push(`No blocking conflicts for ${input.subjectKind}; import can materialize directly.`);
    }

    return Object.freeze({
      decision,
      conflicts: Object.freeze(conflicts),
      resolvedAssetId: input.incomingAssetId,
      resolvedVersionId: input.incomingVersionId,
      remappedDependencyVersionIds: Object.freeze(Object.fromEntries(remapped)),
      reasons: Object.freeze(reasons),
    });
  }
}

function toStableSuffix(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 12) || "bundle";
}
