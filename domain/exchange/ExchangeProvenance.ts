import type { ImportConflictResolutionDecision } from "./ExchangeImportConflictResolution";

export interface ImportedFromBundleReference {
  readonly bundleId: string;
  readonly sourceBundleId?: string;
  readonly importedAt: string;
}

export interface ExchangeExportProvenance {
  readonly bundleId: string;
  readonly subjectKind: "atomic-asset" | "composite-asset" | "system-asset";
  readonly exportedAssetId: string;
  readonly exportedVersionId: string;
  readonly exportedAt: string;
}

export interface ExchangeImportProvenance {
  readonly bundleId: string;
  readonly sourceBundleId?: string;
  readonly sourceAssetId: string;
  readonly sourceVersionId: string;
  readonly importedAssetId: string;
  readonly importedVersionId: string;
  readonly importedAt: string;
  readonly decision: ImportConflictResolutionDecision;
  readonly remappedDependencyVersionIds: Readonly<Record<string, string>>;
}

export type ExchangeLineageEdgeKind =
  | "exported-to-bundle"
  | "imported-from-bundle"
  | "reused-from-bundle"
  | "remapped-from-bundle"
  | "rejected-from-bundle";

export interface ExchangeLineageEdge {
  readonly edgeId: string;
  readonly kind: ExchangeLineageEdgeKind;
  readonly sourceVersionId: string;
  readonly targetVersionId: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExchangeProvenanceRecord {
  readonly exportProvenance?: ExchangeExportProvenance;
  readonly importProvenance?: ExchangeImportProvenance;
  readonly importedFromBundle?: ImportedFromBundleReference;
  readonly lineageEdges: ReadonlyArray<ExchangeLineageEdge>;
}

export class ExchangeProvenanceTracker {
  public createExportProvenance(input: Omit<ExchangeExportProvenance, "exportedAt"> & { readonly exportedAt?: string }): ExchangeExportProvenance {
    return Object.freeze({
      ...input,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
    });
  }

  public createImportProvenance(input: ExchangeImportProvenance): ExchangeImportProvenance {
    return Object.freeze({
      ...input,
      remappedDependencyVersionIds: Object.freeze({ ...input.remappedDependencyVersionIds }),
    });
  }

  public createRecord(input: {
    readonly exportProvenance?: ExchangeExportProvenance;
    readonly importProvenance?: ExchangeImportProvenance;
    readonly importedFromBundle?: ImportedFromBundleReference;
    readonly lineageEdges?: ReadonlyArray<ExchangeLineageEdge>;
  }): ExchangeProvenanceRecord {
    return Object.freeze({
      exportProvenance: input.exportProvenance,
      importProvenance: input.importProvenance,
      importedFromBundle: input.importedFromBundle,
      lineageEdges: Object.freeze([...(input.lineageEdges ?? [])]),
    });
  }

  public createImportEdge(input: {
    readonly sourceVersionId: string;
    readonly targetVersionId: string;
    readonly decision: ImportConflictResolutionDecision;
    readonly bundleId: string;
    readonly createdAt?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): ExchangeLineageEdge {
    const edgeKind: ExchangeLineageEdgeKind = input.decision === "reuse-existing"
      ? "reused-from-bundle"
      : input.decision === "remap-reference"
        ? "remapped-from-bundle"
        : input.decision === "reject-import"
          ? "rejected-from-bundle"
          : "imported-from-bundle";

    return Object.freeze({
      edgeId: `exchange:${edgeKind}:${input.bundleId}:${input.sourceVersionId}:${input.targetVersionId}`,
      kind: edgeKind,
      sourceVersionId: input.sourceVersionId,
      targetVersionId: input.targetVersionId,
      createdAt: input.createdAt ?? new Date().toISOString(),
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    });
  }
}
