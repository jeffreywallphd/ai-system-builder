import type { AssetPackageManifest } from "./AssetPackageManifest";
import type { BundleDependencySnapshot } from "./BundleDependencySnapshot";
import type { ExchangeBundle } from "./ExchangeBundleDomain";
import { ExchangeBundleSubjectKinds } from "./ExchangeBundleDomain";
import {
  ExchangeFormatCompatibilities,
  ExchangeFormatVersionPolicy,
  type ExchangeFormatVersionSupport,
} from "./ExchangeFormatVersioning";
import type { SystemPackageManifest } from "./SystemPackageManifest";

export const ExchangeBundleValidationIssueKinds = Object.freeze({
  unsupportedFormatVersion: "unsupported-format-version",
  unknownFormatVersion: "unknown-format-version",
  missingRequiredField: "missing-required-field",
  invalidSubjectManifestAlignment: "invalid-subject-manifest-alignment",
  missingPinnedVersionIdentity: "missing-pinned-version-identity",
  invalidDependencySnapshot: "invalid-dependency-snapshot",
  invalidManifestStructure: "invalid-manifest-structure",
  invalidProvenanceShape: "invalid-provenance-shape",
});

export type ExchangeBundleValidationIssueKind =
  typeof ExchangeBundleValidationIssueKinds[keyof typeof ExchangeBundleValidationIssueKinds];

export interface ExchangeBundleValidationIssue {
  readonly kind: ExchangeBundleValidationIssueKind;
  readonly path: string;
  readonly message: string;
}

export interface ExchangeBundleValidationResult {
  readonly valid: boolean;
  readonly formatVersionSupport: ExchangeFormatVersionSupport;
  readonly issues: ReadonlyArray<ExchangeBundleValidationIssue>;
}

export interface ExchangeBundleValidationPolicy {
  readonly formatVersionPolicy: ExchangeFormatVersionPolicy;
  readonly requireDependencyVersionPins: boolean;
  readonly requireProvenanceSourceForImportedBundles: boolean;
}

type SupportedManifest = AssetPackageManifest | SystemPackageManifest;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function sortIssues(issues: ReadonlyArray<ExchangeBundleValidationIssue>): ReadonlyArray<ExchangeBundleValidationIssue> {
  return Object.freeze([...issues].sort((left, right) =>
    `${left.kind}:${left.path}:${left.message}`.localeCompare(`${right.kind}:${right.path}:${right.message}`)));
}

function isPinnedVersion(value?: string): boolean {
  return Boolean(normalizeOptional(value));
}

function expectedBundleKindForManifest(manifest: SupportedManifest): "atomic-asset" | "composite-asset" | "system-asset" {
  if (manifest.manifestVersion === "ai-loom.system-package-manifest.v1") {
    return ExchangeBundleSubjectKinds.systemAsset;
  }
  return manifest.subject.kind;
}

function collectManifestDependencyVersionIssues(
  manifest: SupportedManifest,
  issues: ExchangeBundleValidationIssue[],
): void {
  if (manifest.manifestVersion === "ai-loom.system-package-manifest.v1") {
    for (const [index, reference] of manifest.composition.entries()) {
      if (!isPinnedVersion(reference.childVersionId)) {
        issues.push({
          kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
          path: `manifest.composition[${index}].childVersionId`,
          message: "System package composition references must be version-pinned.",
        });
      }
      if (!isPinnedVersion(reference.parentVersionId)) {
        issues.push({
          kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
          path: `manifest.composition[${index}].parentVersionId`,
          message: "System package composition parent references must be version-pinned.",
        });
      }
    }
    return;
  }

  for (const [index, dependency] of manifest.dependencies.entries()) {
    if (!isPinnedVersion(dependency.versionId)) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
        path: `manifest.dependencies[${index}].versionId`,
        message: "Asset package dependencies must include pinned version identities.",
      });
    }
  }
}

export class ExchangeBundleValidator {
  private readonly policy: ExchangeBundleValidationPolicy;

  public constructor(policy?: Partial<ExchangeBundleValidationPolicy>) {
    this.policy = Object.freeze({
      formatVersionPolicy: policy?.formatVersionPolicy ?? ExchangeFormatVersionPolicy.default,
      requireDependencyVersionPins: policy?.requireDependencyVersionPins ?? true,
      requireProvenanceSourceForImportedBundles: policy?.requireProvenanceSourceForImportedBundles ?? true,
    });
  }

  public validate(input: {
    readonly bundle: ExchangeBundle;
    readonly manifest: SupportedManifest;
    readonly dependencySnapshot: BundleDependencySnapshot;
  }): ExchangeBundleValidationResult {
    const issues: ExchangeBundleValidationIssue[] = [];
    const formatVersionSupport = this.policy.formatVersionPolicy.evaluate(input.bundle.formatVersion.value);

    if (formatVersionSupport.compatibility === ExchangeFormatCompatibilities.incompatible) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.unsupportedFormatVersion,
        path: "bundle.formatVersion",
        message: formatVersionSupport.reason ?? "Exchange format version is not supported.",
      });
    }

    if (formatVersionSupport.compatibility === ExchangeFormatCompatibilities.unknown) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.unknownFormatVersion,
        path: "bundle.formatVersion",
        message: formatVersionSupport.reason ?? "Exchange format version is unknown.",
      });
    }

    if (!isPinnedVersion(input.bundle.subject.root.versionId)) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
        path: "bundle.subject.root.versionId",
        message: "Bundle root subject requires a pinned version identity.",
      });
    }

    const expectedKind = expectedBundleKindForManifest(input.manifest);
    if (input.bundle.subject.root.kind !== expectedKind) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.invalidSubjectManifestAlignment,
        path: "bundle.subject.root.kind",
        message: `Bundle root kind '${input.bundle.subject.root.kind}' does not match manifest kind '${expectedKind}'.`,
      });
    }

    if (input.manifest.bundleFormatVersion !== input.bundle.formatVersion.value) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.invalidManifestStructure,
        path: "manifest.bundleFormatVersion",
        message: "Manifest bundle format version must match bundle format version.",
      });
    }

    if (input.dependencySnapshot.bundleFormatVersion !== input.bundle.formatVersion.value) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.invalidDependencySnapshot,
        path: "dependencySnapshot.bundleFormatVersion",
        message: "Dependency snapshot bundle format version must match bundle format version.",
      });
    }

    if (input.dependencySnapshot.rootSubject.assetId !== input.bundle.subject.root.assetId
      || input.dependencySnapshot.rootSubject.versionId !== input.bundle.subject.root.versionId
      || input.dependencySnapshot.rootSubject.kind !== input.bundle.subject.root.kind) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.invalidDependencySnapshot,
        path: "dependencySnapshot.rootSubject",
        message: "Dependency snapshot root subject must match bundle root subject identity and kind.",
      });
    }

    if (!normalizeOptional(input.bundle.metadata.createdAt)) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.missingRequiredField,
        path: "bundle.metadata.createdAt",
        message: "Bundle metadata createdAt is required.",
      });
    }

    if (this.policy.requireProvenanceSourceForImportedBundles
      && (input.bundle.provenance?.originType === "import" || input.bundle.provenance?.originType === "handoff")
      && !normalizeOptional(input.bundle.provenance.sourceBundleId)) {
      issues.push({
        kind: ExchangeBundleValidationIssueKinds.invalidProvenanceShape,
        path: "bundle.provenance.sourceBundleId",
        message: "Imported or handoff bundles must include provenance sourceBundleId.",
      });
    }

    if (this.policy.requireDependencyVersionPins) {
      collectManifestDependencyVersionIssues(input.manifest, issues);
      for (const [index, entry] of input.dependencySnapshot.entries.entries()) {
        if (!isPinnedVersion(entry.dependency.versionId)) {
          issues.push({
            kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
            path: `dependencySnapshot.entries[${index}].dependency.versionId`,
            message: "Dependency snapshot entries must be version-pinned.",
          });
        }
        for (const [requiredByIndex, requiredBy] of entry.requiredBy.entries()) {
          if (!isPinnedVersion(requiredBy.versionId)) {
            issues.push({
              kind: ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity,
              path: `dependencySnapshot.entries[${index}].requiredBy[${requiredByIndex}].versionId`,
              message: "Dependency snapshot requiredBy references must be version-pinned.",
            });
          }
        }
      }
    }

    return Object.freeze({
      valid: issues.length === 0,
      formatVersionSupport,
      issues: sortIssues(issues),
    });
  }
}

