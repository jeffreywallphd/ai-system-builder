import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";

export const AssetDetailSectionKeys = Object.freeze({
  summary: "summary",
  relationships: "relationships",
  structure: "structure",
  metadata: "metadata",
  advanced: "advanced",
});

export type AssetDetailSectionKey = typeof AssetDetailSectionKeys[keyof typeof AssetDetailSectionKeys];

export interface AssetDetailItem {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: "primary" | "secondary";
}

export interface AssetDetailSection {
  readonly key: AssetDetailSectionKey;
  readonly title: string;
  readonly items: ReadonlyArray<AssetDetailItem>;
  readonly progressive?: "always" | "advanced";
}

export interface AssetDetailPresentationModel {
  readonly assetId: string;
  readonly title: string;
  readonly summary: string;
  readonly identity: {
    readonly status: string;
    readonly kind: string;
    readonly versionId?: string;
  };
  readonly sections: ReadonlyArray<AssetDetailSection>;
}

function compactCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDate(value: Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.toISOString();
}

export class AssetDetailLayoutResolver {
  public resolve(asset: RegistryAsset): AssetDetailPresentationModel {
    const upstream = asset.dependencies.filter((entry) => entry.direction === "upstream").length;
    const downstream = asset.dependencies.filter((entry) => entry.direction === "downstream").length;

    const sections: AssetDetailSection[] = [
      {
        key: AssetDetailSectionKeys.summary,
        title: "Summary",
        items: [
          { label: "Asset ID", value: asset.assetId, emphasis: "primary" },
          { label: "Kind", value: asset.kind },
          { label: "Status", value: asset.status },
          { label: "Latest version", value: asset.versionId ?? "Unavailable" },
        ],
      },
      {
        key: AssetDetailSectionKeys.structure,
        title: "Structure preview",
        items: [
          { label: "Contract parameters", value: compactCountLabel(asset.contract?.parameters.length ?? 0, "parameter") },
          {
            label: "System components",
            value: compactCountLabel(asset.systemDetails?.selectedChildren.length ?? 0, "component"),
          },
          {
            label: "Bindings",
            value: compactCountLabel(asset.systemDetails?.bindings.count ?? 0, "binding"),
          },
        ],
      },
      {
        key: AssetDetailSectionKeys.relationships,
        title: "Relationships",
        items: [
          { label: "Dependencies", value: compactCountLabel(upstream, "upstream dependency") },
          { label: "Dependents", value: compactCountLabel(downstream, "downstream dependent") },
          { label: "Lineage upstream", value: compactCountLabel(asset.lineage.upstream.length, "version link") },
          { label: "Lineage downstream", value: compactCountLabel(asset.lineage.downstream.length, "version link") },
        ],
      },
      {
        key: AssetDetailSectionKeys.metadata,
        title: "Metadata",
        progressive: "advanced",
        items: [
          { label: "Role", value: asset.taxonomy?.semanticRole ?? "Not specified" },
          { label: "Behavior", value: asset.taxonomy?.behaviorKind ?? "Not specified" },
          { label: "Structure", value: asset.taxonomy?.structuralKind ?? "Not specified" },
          { label: "Source", value: asset.provenance.sourceType ?? "Unknown" },
          { label: "Source label", value: asset.provenance.sourceLabel ?? "Unspecified" },
        ],
      },
      {
        key: AssetDetailSectionKeys.advanced,
        title: "Advanced details",
        progressive: "advanced",
        items: [
          { label: "Creator", value: asset.provenance.creatorId ?? "Unknown" },
          { label: "Created", value: formatDate(asset.provenance.createdAt) ?? "Unknown" },
          { label: "Updated", value: formatDate(asset.provenance.updatedAt) ?? "Unknown" },
          { label: "Derivation", value: asset.provenance.derivationContext ?? "None" },
        ],
      },
    ];

    return Object.freeze({
      assetId: asset.assetId,
      title: asset.name,
      summary: "Intent-oriented detail view with consistent primary information and progressive metadata.",
      identity: Object.freeze({
        status: asset.status,
        kind: asset.kind,
        versionId: asset.versionId,
      }),
      sections: Object.freeze(sections.map((section) => Object.freeze({
        ...section,
        items: Object.freeze(section.items.map((item) => Object.freeze({ ...item }))),
      }))),
    });
  }
}
