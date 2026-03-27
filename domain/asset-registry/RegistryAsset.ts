import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import type { AssetSourceType } from "../assets/interfaces/IAsset";
import type { AssetLineageRelationshipType } from "../assets/AssetLineageEdge";

export interface RegistryDependencyReference {
  readonly direction: "upstream" | "downstream";
  readonly assetId: string;
  readonly versionId: string;
  readonly relationshipType?: AssetLineageRelationshipType;
  readonly source: "version-upstream" | "lineage-edge" | "draft-dependency";
}

export interface RegistryProvenanceView {
  readonly creatorId?: string;
  readonly sourceType?: AssetSourceType;
  readonly sourceLabel?: string;
  readonly derivationContext?: string;
  readonly upstreamAssets: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId?: string;
    readonly relationship?: AssetLineageRelationshipType;
  }>;
  readonly directUpstreamVersionIds: ReadonlyArray<string>;
  readonly directDownstreamVersionIds: ReadonlyArray<string>;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface RegistryAsset {
  readonly assetId: string;
  readonly versionId?: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly provenance: RegistryProvenanceView;
  readonly dependencies: ReadonlyArray<RegistryDependencyReference>;
  readonly validation?: RegistryAssetValidationInsights;
}

export interface RegistryAssetValidationIssue {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly section: "taxonomy" | "contract" | "provenance" | "dependencies" | "behavior" | "lifecycle" | "publish-version";
  readonly message: string;
  readonly path?: string;
}

export interface RegistryAssetValidationInsights {
  readonly status: "valid" | "warning" | "invalid";
  readonly issueCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly incompatibleDependencyCount: number;
  readonly behaviorMismatchCount: number;
  readonly issues: ReadonlyArray<RegistryAssetValidationIssue>;
}

function cloneDate(value?: Date): Date | undefined {
  return value ? new Date(value.getTime()) : undefined;
}

export function createRegistryAsset(input: RegistryAsset): RegistryAsset {
  return Object.freeze({
    assetId: input.assetId.trim(),
    versionId: input.versionId?.trim() || undefined,
    name: input.name.trim(),
    kind: input.kind.trim(),
    status: input.status.trim(),
    taxonomy: input.taxonomy
      ? Object.freeze({
        structuralKind: input.taxonomy.structuralKind,
        semanticRole: input.taxonomy.semanticRole,
        behaviorKind: input.taxonomy.behaviorKind,
      })
      : undefined,
    contract: input.contract,
    provenance: Object.freeze({
      creatorId: input.provenance.creatorId?.trim() || undefined,
      sourceType: input.provenance.sourceType,
      sourceLabel: input.provenance.sourceLabel?.trim() || undefined,
      derivationContext: input.provenance.derivationContext?.trim() || undefined,
      upstreamAssets: Object.freeze(
        (input.provenance.upstreamAssets ?? []).map((entry) => Object.freeze({
          assetId: entry.assetId.trim(),
          versionId: entry.versionId?.trim() || undefined,
          relationship: entry.relationship,
        })),
      ),
      directUpstreamVersionIds: Object.freeze(
        [...new Set((input.provenance.directUpstreamVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean))],
      ),
      directDownstreamVersionIds: Object.freeze(
        [...new Set((input.provenance.directDownstreamVersionIds ?? []).map((entry) => entry.trim()).filter(Boolean))],
      ),
      createdAt: cloneDate(input.provenance.createdAt),
      updatedAt: cloneDate(input.provenance.updatedAt),
    }),
    dependencies: Object.freeze(input.dependencies.map((dependency) => Object.freeze({
      direction: dependency.direction,
      assetId: dependency.assetId.trim(),
      versionId: dependency.versionId.trim(),
      relationshipType: dependency.relationshipType,
      source: dependency.source,
    }))),
    validation: input.validation
      ? Object.freeze({
        status: input.validation.status,
        issueCount: input.validation.issueCount,
        warningCount: input.validation.warningCount,
        errorCount: input.validation.errorCount,
        incompatibleDependencyCount: input.validation.incompatibleDependencyCount,
        behaviorMismatchCount: input.validation.behaviorMismatchCount,
        issues: Object.freeze((input.validation.issues ?? []).map((issue) => Object.freeze({
          code: issue.code.trim(),
          severity: issue.severity,
          section: issue.section,
          message: issue.message.trim(),
          path: issue.path?.trim() || undefined,
        }))),
      })
      : undefined,
  });
}
