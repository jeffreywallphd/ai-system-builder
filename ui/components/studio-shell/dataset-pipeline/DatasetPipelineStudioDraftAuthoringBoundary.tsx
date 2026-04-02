import { useEffect, useMemo, useState } from "react";
import type { RegistryAsset } from "../../../../domain/asset-registry/RegistryAsset";
import {
  deserializeDatasetPipelineAssetDocumentForEditing,
  resolveDatasetPipelineSchemaReferenceStatus,
  serializeDatasetPipelineAssetDocument,
  updateDatasetPipelineSchemaReference,
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

export default function DatasetPipelineStudioDraftAuthoringBoundary({
  content,
  onChangeContent,
  onStudioEvent,
}: DatasetPipelineStudioDraftAuthoringBoundaryProps): JSX.Element {
  const parsed = useMemo(() => deserializeDatasetPipelineAssetDocumentForEditing(content), [content]);
  const [availableSchemas, setAvailableSchemas] = useState<ReadonlyArray<RegistryAsset>>(Object.freeze([]));

  useEffect(() => {
    let disposed = false;
    const registry = new RegistryService();
    void (async () => {
      const response = await registry.filterAssets({ semanticRoles: Object.freeze(["schema"]), limit: 200 });
      if (disposed || !response.ok || !response.data) {
        return;
      }
      setAvailableSchemas(Object.freeze(response.data));
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const schemaAssetIds = useMemo(
    () => new Set(availableSchemas.map((entry) => entry.assetId)),
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

  return (
    <div className="ui-stack ui-stack--sm" data-testid="dataset-pipeline-studio-boundary">
      <header className="ui-stack ui-stack--2xs">
        <strong>Pipeline flow setup</strong>
        <p className="ui-subtle">
          Build ingestion and transformation steps here. Use Schema Studio for creating table/field structures.
        </p>
      </header>

      {parsed.issues.length > 0 ? (
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="dataset-pipeline-parse-warning">
          {parsed.issues.map((issue) => <span key={issue} className="ui-text-danger">{issue}</span>)}
        </div>
      ) : null}

      <div className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="dataset-pipeline-schema-linkage">
        <div className="ui-row ui-row--between ui-row--wrap">
          <strong>Input and output structures</strong>
          <span className="ui-subtle">Schema links only (author structure in Schema Studio)</span>
        </div>

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
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-subtle">Schema asset ID</span>
                <input
                  className="ui-input"
                  value={reference?.assetId ?? ""}
                  onChange={(event) => persistReference(shape, {
                    ...reference,
                    assetId: event.target.value,
                  })}
                  placeholder="asset:schema:customer"
                />
              </label>
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
              <details>
                <summary>Advanced: inline schema definition (optional)</summary>
                <textarea
                  className="ui-textarea"
                  rows={4}
                  value={reference?.inlineDefinition ? JSON.stringify(reference.inlineDefinition, null, 2) : ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    if (!value) {
                      persistReference(shape, {
                        ...reference,
                        inlineDefinition: undefined,
                      });
                      return;
                    }
                    try {
                      const parsedInline = JSON.parse(value) as Record<string, unknown>;
                      persistReference(shape, {
                        ...reference,
                        inlineDefinition: parsedInline,
                      });
                    } catch {
                      // ignore invalid draft keystrokes and preserve previous valid structure.
                    }
                  }}
                  placeholder='{"type":"object","properties":{}}'
                />
              </details>
              {status === "unresolved" ? (
                <span className="ui-text-warning">This schema link is not currently resolvable in the asset registry.</span>
              ) : null}
            </section>
          ))}
        </div>
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
