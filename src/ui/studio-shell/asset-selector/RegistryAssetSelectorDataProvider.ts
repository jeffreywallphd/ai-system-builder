import type { RegistryService } from "../../services/RegistryService";
import type { AssetSelectorRequest } from "../../../src/domain/studio-shell/AssetSelectorContract";
import type { AssetSelectorDataProvider, AssetSelectorQueryResponse } from "./AssetSelectorDataProvider";

export interface RegistryAssetSelectorDataProviderOptions {
  readonly registryService: Pick<RegistryService, "filterAssets" | "searchAssets">;
  readonly structuralKinds?: ReadonlyArray<"atomic" | "composite" | "system">;
  readonly behaviorKinds?: ReadonlyArray<"none" | "deterministic" | "conditional" | "iterative" | "autonomous">;
  readonly limit?: number;
}

function buildAssetBadge(entry: {
  readonly kind: string;
  readonly status: string;
  readonly taxonomyRole?: string;
}): ReadonlyArray<string> {
  const badges = [entry.kind, entry.status];
  if (entry.taxonomyRole) {
    badges.push(entry.taxonomyRole);
  }
  return Object.freeze(badges.map((value) => value.trim()).filter(Boolean));
}

export class RegistryAssetSelectorDataProvider implements AssetSelectorDataProvider {
  private readonly structuralKinds: ReadonlyArray<"atomic" | "composite" | "system">;
  private readonly behaviorKinds: ReadonlyArray<"none" | "deterministic" | "conditional" | "iterative" | "autonomous">;
  private readonly limit: number;

  public constructor(private readonly options: RegistryAssetSelectorDataProviderOptions) {
    this.structuralKinds = options.structuralKinds ?? Object.freeze(["atomic", "composite", "system"]);
    this.behaviorKinds = options.behaviorKinds ?? Object.freeze(["none", "deterministic", "conditional", "iterative", "autonomous"]);
    this.limit = options.limit ?? 50;
  }

  public async query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse> {
    const term = input.searchTerm.trim();
    const response = term.length > 0
      ? await this.options.registryService.searchAssets({
        keyword: term,
        structuralKinds: this.structuralKinds,
        semanticRoles: [input.request.assetType],
        behaviorKinds: this.behaviorKinds,
        limit: this.limit,
      })
      : await this.options.registryService.filterAssets({
        structuralKinds: this.structuralKinds,
        semanticRoles: [input.request.assetType],
        behaviorKinds: this.behaviorKinds,
        limit: this.limit,
      });

    if (!response.ok || !response.data) {
      return Object.freeze({
        items: Object.freeze([]),
        error: response.error?.message ?? "Unable to load selector assets.",
      });
    }

    return Object.freeze({
      items: Object.freeze(response.data.map((entry) => Object.freeze({
        id: `${entry.assetId}:${entry.versionId ?? ""}`,
        title: entry.name?.trim() || entry.assetId,
        subtitle: entry.versionId,
        description: entry.provenance.sourceLabel ?? undefined,
        badges: buildAssetBadge({
          kind: entry.kind,
          status: entry.status,
          taxonomyRole: entry.taxonomy?.semanticRole,
        }),
        asset: Object.freeze({
          assetId: entry.assetId,
          versionId: entry.versionId,
          assetType: input.request.assetType,
          displayName: entry.name,
          taxonomy: entry.taxonomy,
        }),
      }))),
    });
  }
}
