import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import type { AssetSourceType } from "../../../domain/assets/interfaces/IAsset";
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

export interface RegistryAssetVersionHistoryEntry {
  readonly versionId: string;
  readonly versionLabel?: string;
  readonly parentVersionId?: string;
  readonly createdAt: Date;
  readonly createdBy?: string;
  readonly upstreamVersionIds: ReadonlyArray<string>;
  readonly upstreamAdded: ReadonlyArray<string>;
  readonly upstreamRemoved: ReadonlyArray<string>;
}

export interface RegistryAssetLineageTraversalEntry {
  readonly assetId: string;
  readonly versionId: string;
  readonly name?: string;
  readonly depth: number;
}

export interface RegistryAssetLineageView {
  readonly rootVersionId?: string;
  readonly upstream: ReadonlyArray<RegistryAssetLineageTraversalEntry>;
  readonly downstream: ReadonlyArray<RegistryAssetLineageTraversalEntry>;
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
  readonly versionHistory: ReadonlyArray<RegistryAssetVersionHistoryEntry>;
  readonly lineage: RegistryAssetLineageView;
  readonly validation?: RegistryAssetValidationInsights;
  readonly systemDetails?: RegistrySystemDetailsView;
}

export interface RegistrySystemDetailsView {
  readonly selectedChildren: ReadonlyArray<{
    readonly alias?: string;
    readonly componentKind: "atomic" | "composite" | "system";
    readonly assetId: string;
    readonly versionId?: string;
  }>;
  readonly interfaces: {
    readonly inputs: ReadonlyArray<{ readonly id: string; readonly valueType?: string; readonly required: boolean }>;
    readonly outputs: ReadonlyArray<{ readonly id: string; readonly valueType?: string }>;
    readonly parameters: ReadonlyArray<{ readonly id: string; readonly valueType?: string; readonly required: boolean; readonly hasDefault: boolean }>;
  };
  readonly bindings: {
    readonly count: number;
    readonly bindingIds: ReadonlyArray<string>;
  };
  readonly aggregatedDependencies: {
    readonly directCount: number;
    readonly transitiveCount: number;
    readonly totalCount: number;
    readonly traversalStatus: "complete" | "cycle-detected" | "max-depth-exceeded" | "unresolved";
  };
  readonly versionLineage: {
    readonly currentVersionId: string;
    readonly parentVersionId?: string;
    readonly rootVersionId?: string;
    readonly nestedSystemVersionReferences: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly alias?: string;
      readonly includedInUpstream: boolean;
    }>;
    readonly childVersionReferences: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly componentKind: "atomic" | "composite" | "system";
      readonly alias?: string;
      readonly includedInUpstream: boolean;
    }>;
  };
  readonly executionMetadata?: {
    readonly runtimeEnvironment?: string;
    readonly runtimeRequirementCount: number;
    readonly orchestrationMode?: string;
    readonly orchestrationHintCount: number;
    readonly publishVisibility?: "private" | "team" | "public";
    readonly exportTargetCount: number;
    readonly executionProfileId?: string;
    readonly executionLatencyTier?: "standard" | "low-latency" | "batch";
    readonly ownerTeam?: string;
    readonly hasSupportContact: boolean;
  };
  readonly runtimeActivity?: {
    readonly recentExecutionCount: number;
    readonly latestExecution?: {
      readonly executionId: string;
      readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
      readonly result: "succeeded" | "failed" | "cancelled" | "running";
      readonly startedAt: string;
      readonly completedAt?: string;
      readonly rootVersionId?: string;
      readonly traceEventCount: number;
      readonly traceLogCount: number;
    };
    readonly recentExecutions: ReadonlyArray<{
      readonly executionId: string;
      readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
      readonly result: "succeeded" | "failed" | "cancelled" | "running";
      readonly startedAt: string;
      readonly completedAt?: string;
      readonly rootVersionId?: string;
      readonly traceEventCount: number;
      readonly traceLogCount: number;
    }>;
  };
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
    versionHistory: Object.freeze((input.versionHistory ?? []).map((entry) => Object.freeze({
      versionId: entry.versionId.trim(),
      versionLabel: entry.versionLabel?.trim() || undefined,
      parentVersionId: entry.parentVersionId?.trim() || undefined,
      createdAt: cloneDate(entry.createdAt) ?? new Date(0),
      createdBy: entry.createdBy?.trim() || undefined,
      upstreamVersionIds: Object.freeze([...new Set((entry.upstreamVersionIds ?? []).map((id) => id.trim()).filter(Boolean))]),
      upstreamAdded: Object.freeze([...new Set((entry.upstreamAdded ?? []).map((id) => id.trim()).filter(Boolean))]),
      upstreamRemoved: Object.freeze([...new Set((entry.upstreamRemoved ?? []).map((id) => id.trim()).filter(Boolean))]),
    }))),
    lineage: Object.freeze({
      rootVersionId: input.lineage.rootVersionId?.trim() || undefined,
      upstream: Object.freeze((input.lineage.upstream ?? []).map((entry) => Object.freeze({
        assetId: entry.assetId.trim(),
        versionId: entry.versionId.trim(),
        name: entry.name?.trim() || undefined,
        depth: Math.max(0, Math.floor(entry.depth)),
      }))),
      downstream: Object.freeze((input.lineage.downstream ?? []).map((entry) => Object.freeze({
        assetId: entry.assetId.trim(),
        versionId: entry.versionId.trim(),
        name: entry.name?.trim() || undefined,
        depth: Math.max(0, Math.floor(entry.depth)),
      }))),
    }),
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
    systemDetails: input.systemDetails
      ? Object.freeze({
        selectedChildren: Object.freeze((input.systemDetails.selectedChildren ?? []).map((entry) => Object.freeze({
          alias: entry.alias?.trim() || undefined,
          componentKind: entry.componentKind,
          assetId: entry.assetId.trim(),
          versionId: entry.versionId?.trim() || undefined,
        }))),
        interfaces: Object.freeze({
          inputs: Object.freeze((input.systemDetails.interfaces.inputs ?? []).map((entry) => Object.freeze({
            id: entry.id.trim(),
            valueType: entry.valueType?.trim() || undefined,
            required: Boolean(entry.required),
          }))),
          outputs: Object.freeze((input.systemDetails.interfaces.outputs ?? []).map((entry) => Object.freeze({
            id: entry.id.trim(),
            valueType: entry.valueType?.trim() || undefined,
          }))),
          parameters: Object.freeze((input.systemDetails.interfaces.parameters ?? []).map((entry) => Object.freeze({
            id: entry.id.trim(),
            valueType: entry.valueType?.trim() || undefined,
            required: Boolean(entry.required),
            hasDefault: Boolean(entry.hasDefault),
          }))),
        }),
        bindings: Object.freeze({
          count: Math.max(0, Math.floor(input.systemDetails.bindings.count)),
          bindingIds: Object.freeze((input.systemDetails.bindings.bindingIds ?? []).map((entry) => entry.trim()).filter(Boolean)),
        }),
        aggregatedDependencies: Object.freeze({
          directCount: Math.max(0, Math.floor(input.systemDetails.aggregatedDependencies.directCount)),
          transitiveCount: Math.max(0, Math.floor(input.systemDetails.aggregatedDependencies.transitiveCount)),
          totalCount: Math.max(0, Math.floor(input.systemDetails.aggregatedDependencies.totalCount)),
          traversalStatus: input.systemDetails.aggregatedDependencies.traversalStatus,
        }),
        versionLineage: Object.freeze({
          currentVersionId: input.systemDetails.versionLineage.currentVersionId.trim(),
          parentVersionId: input.systemDetails.versionLineage.parentVersionId?.trim() || undefined,
          rootVersionId: input.systemDetails.versionLineage.rootVersionId?.trim() || undefined,
          nestedSystemVersionReferences: Object.freeze((input.systemDetails.versionLineage.nestedSystemVersionReferences ?? []).map((entry) => Object.freeze({
            assetId: entry.assetId.trim(),
            versionId: entry.versionId?.trim() || undefined,
            alias: entry.alias?.trim() || undefined,
            includedInUpstream: Boolean(entry.includedInUpstream),
          }))),
          childVersionReferences: Object.freeze((input.systemDetails.versionLineage.childVersionReferences ?? []).map((entry) => Object.freeze({
            assetId: entry.assetId.trim(),
            versionId: entry.versionId?.trim() || undefined,
            componentKind: entry.componentKind,
            alias: entry.alias?.trim() || undefined,
            includedInUpstream: Boolean(entry.includedInUpstream),
          }))),
        }),
        executionMetadata: input.systemDetails.executionMetadata
          ? Object.freeze({
            runtimeEnvironment: input.systemDetails.executionMetadata.runtimeEnvironment?.trim() || undefined,
            runtimeRequirementCount: Math.max(0, Math.floor(input.systemDetails.executionMetadata.runtimeRequirementCount)),
            orchestrationMode: input.systemDetails.executionMetadata.orchestrationMode?.trim() || undefined,
            orchestrationHintCount: Math.max(0, Math.floor(input.systemDetails.executionMetadata.orchestrationHintCount)),
            publishVisibility: input.systemDetails.executionMetadata.publishVisibility,
            exportTargetCount: Math.max(0, Math.floor(input.systemDetails.executionMetadata.exportTargetCount)),
            executionProfileId: input.systemDetails.executionMetadata.executionProfileId?.trim() || undefined,
            executionLatencyTier: input.systemDetails.executionMetadata.executionLatencyTier,
            ownerTeam: input.systemDetails.executionMetadata.ownerTeam?.trim() || undefined,
            hasSupportContact: Boolean(input.systemDetails.executionMetadata.hasSupportContact),
          })
          : undefined,
        runtimeActivity: input.systemDetails.runtimeActivity
          ? Object.freeze({
            recentExecutionCount: Math.max(0, Math.floor(input.systemDetails.runtimeActivity.recentExecutionCount)),
            latestExecution: input.systemDetails.runtimeActivity.latestExecution
              ? Object.freeze({
                executionId: input.systemDetails.runtimeActivity.latestExecution.executionId.trim(),
                status: input.systemDetails.runtimeActivity.latestExecution.status,
                result: input.systemDetails.runtimeActivity.latestExecution.result,
                startedAt: input.systemDetails.runtimeActivity.latestExecution.startedAt,
                completedAt: input.systemDetails.runtimeActivity.latestExecution.completedAt,
                rootVersionId: input.systemDetails.runtimeActivity.latestExecution.rootVersionId?.trim() || undefined,
                traceEventCount: Math.max(0, Math.floor(input.systemDetails.runtimeActivity.latestExecution.traceEventCount)),
                traceLogCount: Math.max(0, Math.floor(input.systemDetails.runtimeActivity.latestExecution.traceLogCount)),
              })
              : undefined,
            recentExecutions: Object.freeze((input.systemDetails.runtimeActivity.recentExecutions ?? []).map((entry) => Object.freeze({
              executionId: entry.executionId.trim(),
              status: entry.status,
              result: entry.result,
              startedAt: entry.startedAt,
              completedAt: entry.completedAt,
              rootVersionId: entry.rootVersionId?.trim() || undefined,
              traceEventCount: Math.max(0, Math.floor(entry.traceEventCount)),
              traceLogCount: Math.max(0, Math.floor(entry.traceLogCount)),
            }))),
          })
          : undefined,
      })
      : undefined,
  });
}
