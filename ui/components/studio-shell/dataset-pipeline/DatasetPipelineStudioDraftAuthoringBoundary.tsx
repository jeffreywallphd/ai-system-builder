import { useEffect, useMemo, useState } from "react";
import type { RegistryAsset } from "../../../../domain/asset-registry/RegistryAsset";
import {
  deserializeDatasetPipelineAssetDocumentForEditing,
  resolveDatasetPipelineSchemaReferenceStatus,
  serializeDatasetPipelineAssetDocument,
  updateDatasetPipelineSchemaReference,
  updateDatasetPipelineSourceSchemaReference,
  type DatasetPipelineSchemaReference,
} from "../../../../domain/dataset-pipeline-studio/DatasetPipelineAssetDocument";
import { RegistryService } from "../../../services/RegistryService";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
} from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

interface DatasetPipelineStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly onChangeContent: (nextContent: string) => void;
  readonly onStudioEvent?: (event: StudioEmbeddedEvent) => void;
}

function statusLabel(status: ReturnType<typeof resolveDatasetPipelineSchemaReferenceStatus>): string {
  if (status === "resolved") {
    return "Linked";
  }
  if (status === "inline") {
    return "Inline definition";
  }
  if (status === "unresolved") {
    return "Needs attention";
  }
  return "Not linked";
}

function statusTone(status: ReturnType<typeof resolveDatasetPipelineSchemaReferenceStatus>): "success" | "warning" | "default" {
  if (status === "resolved" || status === "inline") {
    return "success";
  }
  if (status === "unresolved") {
    return "warning";
  }
  return "default";
}

function toSchemaDisplayName(asset: RegistryAsset): string {
  return asset.title?.trim() || asset.assetId;
}

export default function DatasetPipelineStudioDraftAuthoringBoundary({
  content,
  onChangeContent,
  onStudioEvent,
}: DatasetPipelineStudioDraftAuthoringBoundaryProps): JSX.Element {
  const parsed = useMemo(() => deserializeDatasetPipelineAssetDocumentForEditing(content), [content]);
  const [availableSchemas, setAvailableSchemas] = useState<ReadonlyArray<RegistryAsset>>(Object.freeze([]));
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(true);
  const [schemaLoadIssue, setSchemaLoadIssue] = useState<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    const registry = new RegistryService();
    void (async () => {
      setIsLoadingSchemas(true);
      setSchemaLoadIssue(undefined);
      const response = await registry.filterAssets({ semanticRoles: Object.freeze(["schema"]), limit: 200 });
      if (disposed) {
        return;
      }
      if (!response.ok || !response.data) {
        setSchemaLoadIssue(response.error?.message ?? "Unable to load schema assets.");
        setIsLoadingSchemas(false);
        return;
      }
      setAvailableSchemas(Object.freeze(response.data));
      setIsLoadingSchemas(false);
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const schemaAssetIds = useMemo(
    () => new Set(availableSchemas.map((entry) => entry.assetId)),
    [availableSchemas],
  );
  const schemaByAssetId = useMemo(
    () => new Map(availableSchemas.map((entry) => [entry.assetId, entry] as const)),
    [availableSchemas],
  );

  const inputReference = parsed.document.datasetPipelineSpec.schemas?.input;
  const outputReference = parsed.document.datasetPipelineSpec.schemas?.output;
  const inputStatus = resolveDatasetPipelineSchemaReferenceStatus({
    reference: inputReference,
    availableSchemaAssetIds: schemaAssetIds,
  });
  const outputStatus = resolveDatasetPipelineSchemaReferenceStatus({
    reference: outputReference,
    availableSchemaAssetIds: schemaAssetIds,
  });

  const persistReference = (shape: "input" | "output", reference?: DatasetPipelineSchemaReference): void => {
    const nextDocument = updateDatasetPipelineSchemaReference({
      document: parsed.document,
      shape,
      reference,
    });
    onChangeContent(serializeDatasetPipelineAssetDocument(nextDocument));
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "changes" }),
    }));
  };
  const persistSourceReference = (sourceIndex: number, reference?: DatasetPipelineSchemaReference): void => {
    const nextDocument = updateDatasetPipelineSourceSchemaReference({
      document: parsed.document,
      sourceIndex,
      reference,
    });
    onChangeContent(serializeDatasetPipelineAssetDocument(nextDocument));
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "changes" }),
    }));
  };
  const renderSchemaSelector = (
    shapeLabel: string,
    reference: DatasetPipelineSchemaReference | undefined,
    onChangeReference: (reference?: DatasetPipelineSchemaReference) => void,
  ): JSX.Element => (
    <div className="ui-stack ui-stack--2xs">
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-subtle">{shapeLabel}</span>
        <select
          className="ui-select"
          value={reference?.assetId ?? ""}
          onChange={(event) => {
            const nextAssetId = event.target.value.trim() || undefined;
            onChangeReference(nextAssetId
              ? {
                ...reference,
                assetId: nextAssetId,
              }
              : undefined);
          }}
        >
          <option value="">No schema selected</option>
          {availableSchemas.map((asset) => (
            <option key={asset.assetId} value={asset.assetId}>
              {toSchemaDisplayName(asset)}
            </option>
          ))}
        </select>
      </label>
      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          className="ui-button ui-button--ghost"
          onClick={() => onChangeReference(undefined)}
          disabled={!reference}
        >
          Clear
        </button>
        {reference?.assetId ? (
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => onStudioEvent?.(createStudioIntentEvent({
              kind: StudioEmbeddedIntentKinds.openResource,
              payload: Object.freeze({
                resourceType: "item",
                resourceId: reference.assetId,
                focus: "schema",
              }),
            }))}
          >
            Open schema
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="ui-stack ui-stack--sm" data-testid="dataset-pipeline-studio-boundary">
      <header className="ui-stack ui-stack--2xs">
        <strong>Pipeline flow setup</strong>
        <p className="ui-subtle">
          Choose structure references and draft flow details here. Build schemas in Schema Studio, then link them where needed.
        </p>
      </header>

      {parsed.issues.length > 0 ? (
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="dataset-pipeline-parse-warning">
          {parsed.issues.map((issue) => <span key={issue} className="ui-text-danger">{issue}</span>)}
        </div>
      ) : null}

      <div className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-pipeline-schema-linkage">
        <div className="ui-row ui-row--between ui-row--wrap">
          <strong>Pipeline structure links</strong>
          <span className="ui-subtle">Link existing schemas for inputs, outputs, and ingestion sources.</span>
        </div>
        {isLoadingSchemas ? <span className="ui-subtle">Loading available schemas...</span> : null}
        {schemaLoadIssue ? <span className="ui-text-warning">Schema list could not be loaded. You can still keep existing links.</span> : null}
        {!isLoadingSchemas && !schemaLoadIssue && availableSchemas.length === 0 ? (
          <span className="ui-subtle">No schema assets found yet. Create one in Schema Studio to link structure here.</span>
        ) : null}

        <div className="ui-grid ui-grid--2col">
          {([
            ["input", inputReference, inputStatus],
            ["output", outputReference, outputStatus],
          ] as const).map(([shape, reference, status]) => (
            <section key={shape} className="ui-card ui-card--padded ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap">
                <strong>{shape === "input" ? "Pipeline input" : "Pipeline output"}</strong>
                <span className={`ui-badge ui-badge--${statusTone(status)}`}>{statusLabel(status)}</span>
              </div>
              {renderSchemaSelector(
                "Schema",
                reference,
                (nextReference) => persistReference(shape, nextReference),
              )}
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-subtle">Pinned version (optional)</span>
                <input
                  className="ui-input"
                  value={reference?.versionId ?? ""}
                  onChange={(event) => persistReference(shape, {
                    ...reference,
                    versionId: event.target.value,
                  })}
                  placeholder="asset:schema:customer:v1"
                />
              </label>
              {reference?.assetId ? (
                <span className="ui-subtle">
                  Linked schema: {schemaByAssetId.get(reference.assetId)?.title ?? reference.assetId}
                </span>
              ) : null}
              {status === "unresolved" ? (
                <span className="ui-text-warning">This schema link is not currently resolvable in the asset registry.</span>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      <div className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-pipeline-source-schema-linkage">
        <div className="ui-row ui-row--between ui-row--wrap">
          <strong>Ingestion source structure</strong>
          <span className="ui-subtle">Optionally align each source with a schema for consistent ingestion structure.</span>
        </div>
        {parsed.document.datasetPipelineSpec.sources.length === 0 ? (
          <span className="ui-subtle">Add ingestion sources in the draft document to link source-level schemas.</span>
        ) : (
          <div className="ui-stack ui-stack--xs">
            {parsed.document.datasetPipelineSpec.sources.map((source, sourceIndex) => {
              const sourceStatus = resolveDatasetPipelineSchemaReferenceStatus({
                reference: source.schema,
                availableSchemaAssetIds: schemaAssetIds,
              });
              return (
                <section key={`source-${sourceIndex}`} className="ui-card ui-card--padded ui-stack ui-stack--2xs">
                  <div className="ui-row ui-row--between ui-row--wrap">
                    <strong>{source.datasetRef || `Source ${sourceIndex + 1}`}</strong>
                    <span className={`ui-badge ui-badge--${statusTone(sourceStatus)}`}>{statusLabel(sourceStatus)}</span>
                  </div>
                  <span className="ui-subtle">Ingestion mode: {source.ingestionMode || "Not specified"}</span>
                  {renderSchemaSelector("Source schema", source.schema, (nextReference) => {
                    persistSourceReference(sourceIndex, nextReference);
                  })}
                  {sourceStatus === "unresolved" ? (
                    <span className="ui-text-warning">The linked schema is missing or unavailable. Choose a different schema or clear this link.</span>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="ui-card ui-card--padded ui-stack ui-stack--xs">
        <strong>Pipeline draft document</strong>
        <p className="ui-subtle">Use this JSON area for ingestion, mapping, transformation, filtering/join/enrichment, and run settings.</p>
        <textarea
          className="ui-textarea"
          rows={14}
          value={content}
          onChange={(event) => onChangeContent(event.target.value)}
        />
      </div>
    </div>
  );
}
