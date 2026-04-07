import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StudioEntryModes } from "@application/studio-entry/StudioEntryContracts";
import type { RegistryAsset } from "@domain/asset-registry/RegistryAsset";
import { RegistryService } from "../../../services/RegistryService";
import {
  InlineAssetCreationModes,
  InlineAssetCreationService,
} from "../../../routes/InlineAssetCreation";
import { StudioEntryService } from "../../../routes/StudioRouteMapping";
import { DataStudioWorkspaceDefinitions } from "../../../studio-shell/data/DataStudioNavigationVocabulary";

interface DataStudioSchemaStudioEntryPanelProps {
  readonly maxItems?: number;
}

function describeAsset(asset: RegistryAsset): string {
  const summary = asset.summary?.trim();
  if (summary) {
    return summary;
  }
  return `Updated ${new Date(asset.updatedAt).toLocaleDateString()}`;
}

export default function DataStudioSchemaStudioEntryPanel({
  maxItems = 5,
}: DataStudioSchemaStudioEntryPanelProps): JSX.Element {
  const copy = DataStudioWorkspaceDefinitions.schema;
  const location = useLocation();
  const navigate = useNavigate();
  const registryService = useMemo(() => new RegistryService(), []);
  const inlineCreationService = useMemo(() => new InlineAssetCreationService(), []);
  const studioEntryService = useMemo(() => new StudioEntryService(), []);
  const [schemas, setSchemas] = useState<ReadonlyArray<RegistryAsset>>(Object.freeze([]));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    void (async () => {
      const response = await registryService.filterAssets({
        semanticRoles: Object.freeze(["schema"]),
        limit: maxItems,
      });

      if (disposed) {
        return;
      }

      if (!response.ok || !response.data) {
        setSchemas(Object.freeze([]));
        setLoadError(response.error?.message ?? "Unable to load schema assets right now.");
        setIsLoading(false);
        return;
      }

      const sorted = [...response.data]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      setSchemas(Object.freeze(sorted.slice(0, maxItems)));
      setLoadError(undefined);
      setIsLoading(false);
    })();

    return () => {
      disposed = true;
    };
  }, [maxItems, registryService]);

  const launchCreateSchema = () => {
    const launch = inlineCreationService.launch({
      requestedRole: "schema",
      mode: InlineAssetCreationModes.inlineContext,
      context: {
        source: "studio-shell",
        sourceIntentKey: "data-studio-create-schema",
        sourceIntentLabel: "Create schema from Data Studio",
      },
      returnTarget: {
        routePath: `${location.pathname}${location.search}${location.hash}`,
      },
    });
    if (!launch) {
      return;
    }
    void navigate(launch.launchPath);
  };

  const openSchema = (asset: RegistryAsset) => {
    const route = studioEntryService.buildStudioRoute({
      requestedRole: "schema",
      mode: StudioEntryModes.asset,
      asset: {
        assetId: asset.assetId,
        versionId: asset.versionId,
        taxonomy: asset.taxonomy,
      },
      entryContext: {
        source: "intent",
      },
    });
    if (!route) {
      return;
    }
    void navigate(route);
  };

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="data-studio-schema-entry-panel">
      <header className="ui-stack ui-stack--2xs">
        <strong>{copy.heading}</strong>
        <p className="ui-subtle">
          {copy.summary}
        </p>
        <div className="ui-row ui-row--wrap">
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={launchCreateSchema}
          >
            {copy.primaryCtaLabel}
          </button>
        </div>
      </header>

      {isLoading ? <span className="ui-subtle">Loading available schemas...</span> : null}
      {loadError ? <span className="ui-text-danger">{loadError}</span> : null}

      {!isLoading && !loadError && schemas.length === 0 ? (
        <div className="ui-subtle">{copy.emptyStateLabel}</div>
      ) : null}

      {!isLoading && schemas.length > 0 ? (
        <div className="ui-stack ui-stack--xs">
          <strong>Open existing schema</strong>
          {schemas.map((asset) => (
            <article key={`${asset.assetId}:${asset.versionId ?? "latest"}`} className="ui-card ui-card--padded ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap">
                <span>{asset.name}</span>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  onClick={() => openSchema(asset)}
                >
                  Open in Schema Studio
                </button>
              </div>
              <span className="ui-subtle">{describeAsset(asset)}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

