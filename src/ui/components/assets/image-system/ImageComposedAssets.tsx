import { useMemo, useState, type JSX } from "react";
import { buildImageRunLineageView } from "@application/system-runtime/ImageRunLineageDataContract";
import type { ImageRunHistoryWithOutputs } from "@application/system-runtime/ImageRunHistoryService";
import type { ImageRunHistoryListing } from "@application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryItem, OutputGalleryListing } from "@application/system-runtime/OutputGalleryDataContract";
import { mapOutputGalleryItemToImageViewModel, mapOutputGalleryListingToImageInterfaceState } from "./ImageOutputGalleryDataAdapter";
import {
  DEFAULT_IMAGE_RENDER_OPTIONS,
  type ImageCollectionPresentationMode,
  type ImageOutputSelectionActionEvent,
} from "./ImageUiContracts";
import { ImageOutputGallery } from "./ImageOutputGallery";
import { mapImageRunHistoryListingToViewModels } from "./ImageRunHistoryDataAdapter";
import { ImageRunHistoryList } from "./ImageRunHistoryList";
import { MetadataSummaryPanel, ParameterSummaryPanel } from "./ImageSummaryPanels";
import { ImageLineageMiniView } from "./ImageLineageMiniView";

function findOutputByImageId(items: ReadonlyArray<OutputGalleryItem>, imageId?: string): OutputGalleryItem | undefined {
  if (!imageId) {
    return undefined;
  }
  return items.find((item) => item.image.recordId === imageId || item.image.selectionId === imageId);
}

function ImageOutputSelectionActionBar({
  selectedOutput,
  activeResultImageId,
  reusableInputImageId,
  onSelectionAction,
}: {
  readonly selectedOutput?: OutputGalleryItem;
  readonly activeResultImageId?: string;
  readonly reusableInputImageId?: string;
  readonly onSelectionAction?: (event: ImageOutputSelectionActionEvent) => void;
}): JSX.Element {
  return (
    <section className="ui-image-surface ui-image-selection-action-bar">
      <header className="ui-image-surface__header">
        <h4 className="ui-image-surface__title">Selection actions</h4>
      </header>
      <div className="ui-image-control-group">
        <span className="ui-text-small ui-text-secondary">Selected: {selectedOutput?.image.recordId ?? "none"}</span>
        <span className="ui-text-small ui-text-secondary">Active result: {activeResultImageId ?? "none"}</span>
        <span className="ui-text-small ui-text-secondary">Prepared as reusable input: {reusableInputImageId ?? "none"}</span>
      </div>
      <div className="ui-image-control-group">
        <button
          type="button"
          className="ui-button ui-button--sm ui-button--ghost"
          onClick={() => onSelectionAction?.({
            sourceComponent: "output-gallery",
            details: {
              selectedImageId: selectedOutput?.image.recordId,
              activeResultImageId: selectedOutput?.image.recordId,
              reusableInputImageId,
            },
          })}
          disabled={!selectedOutput}
        >
          Mark selected as active result
        </button>
        <button
          type="button"
          className="ui-button ui-button--sm ui-button--ghost"
          onClick={() => onSelectionAction?.({
            sourceComponent: "output-gallery",
            details: {
              selectedImageId: selectedOutput?.image.recordId,
              activeResultImageId,
              reusableInputImageId: selectedOutput?.image.recordId,
            },
          })}
          disabled={!selectedOutput}
        >
          Prepare selected for reuse-as-input
        </button>
      </div>
    </section>
  );
}

function ImageOutputDetailPane({ output }: { readonly output?: OutputGalleryItem }): JSX.Element {
  if (!output) {
    return <section className="ui-image-surface ui-image-surface--status">Select an output to inspect details.</section>;
  }

  const image = mapOutputGalleryItemToImageViewModel(output);
  return (
    <section className="ui-image-surface">
      <header className="ui-image-surface__header">
        <h4 className="ui-image-surface__title">Output details</h4>
        <span className="ui-text-small ui-text-secondary">{output.timestamps.updatedAt}</span>
      </header>
      <div className="ui-image-output-gallery__summary-grid">
        <div className="ui-image-item-card">
          <img className="ui-image-render-frame__img" src={image.thumbnailUrl ?? image.sourceUrl} alt={image.metadata.altText ?? image.title ?? output.image.recordId} />
          <div className="ui-text-small ui-text-secondary">{output.workflow?.workflowAssetId ?? "No workflow ref"}</div>
          <div className="ui-text-small ui-text-secondary">run: {output.workflow?.workflowRunId ?? "n/a"}</div>
        </div>
        <ParameterSummaryPanel summary={output.generationParametersSummary} />
        <MetadataSummaryPanel summary={output.imageMetadataSummary.metadata} />
      </div>
    </section>
  );
}

export function ImageOutputGalleryAsset({
  listing,
  mode = "grid",
  onSelectionAction,
}: {
  readonly listing: OutputGalleryListing;
  readonly mode?: ImageCollectionPresentationMode;
  readonly onSelectionAction?: (event: ImageOutputSelectionActionEvent) => void;
}): JSX.Element {
  const mapped = mapOutputGalleryListingToImageInterfaceState(listing);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(mapped.imageCollection[0]?.imageId);
  const [activeResultImageId, setActiveResultImageId] = useState<string | undefined>(mapped.imageCollection[0]?.imageId);
  const [reusableInputImageId, setReusableInputImageId] = useState<string | undefined>();

  const selectedOutput = findOutputByImageId(listing.items, selectedImageId);

  return (
    <section className="ui-image-output-gallery-asset">
      <ImageOutputGallery
        items={mapped.imageCollection}
        datasetContext={mapped.datasetRef}
        renderOptions={DEFAULT_IMAGE_RENDER_OPTIONS}
        presentationMode={mode}
        selection={{ mode: "single", selectedIds: selectedImageId ? [selectedImageId] : [], focusedId: selectedImageId }}
        onSelectionChanged={(event) => setSelectedImageId(event.selection.focusedId ?? event.selection.selectedIds[0])}
        title="Persisted output gallery"
      />
      <ImageOutputSelectionActionBar
        selectedOutput={selectedOutput}
        activeResultImageId={activeResultImageId}
        reusableInputImageId={reusableInputImageId}
        onSelectionAction={(event) => {
          setActiveResultImageId(event.details.activeResultImageId ?? activeResultImageId);
          setReusableInputImageId(event.details.reusableInputImageId ?? reusableInputImageId);
          onSelectionAction?.(event);
        }}
      />
      <ImageOutputDetailPane output={selectedOutput} />
    </section>
  );
}

export function ImageRunHistoryAsset({
  listing,
  selectedRunId,
  onRunSelected,
}: {
  readonly listing: ImageRunHistoryListing;
  readonly selectedRunId?: string;
  readonly onRunSelected?: (runId: string) => void;
}): JSX.Element {
  return (
    <ImageRunHistoryList
      title="Persisted run history"
      runs={mapImageRunHistoryListingToViewModels(listing)}
      selectedRunId={selectedRunId}
      onRunSelected={(event) => onRunSelected?.(event.runId)}
    />
  );
}

export function ImageHistoryLinkedOutputInspectorAsset({
  runsWithOutputs,
}: {
  readonly runsWithOutputs: ReadonlyArray<ImageRunHistoryWithOutputs>;
}): JSX.Element {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(runsWithOutputs[0]?.run.runId);

  const selectedEntry = useMemo(
    () => runsWithOutputs.find((entry) => entry.run.runId === selectedRunId) ?? runsWithOutputs[0],
    [runsWithOutputs, selectedRunId],
  );

  return (
    <section className="ui-image-history-output-inspector ui-image-surface">
      <header className="ui-image-surface__header">
        <h3 className="ui-image-surface__title">History-linked output inspector</h3>
      </header>
      <ImageRunHistoryList
        title="Run history"
        runs={mapImageRunHistoryListingToViewModels({
          kind: "image-run-history",
          summary: {
            systemId: selectedEntry?.run.system.systemId ?? "system:image",
            totalRuns: runsWithOutputs.length,
            returnedRuns: runsWithOutputs.length,
            truncated: false,
          },
          window: {
            offset: 0,
            limit: Math.max(1, runsWithOutputs.length),
            hasPreviousWindow: false,
            hasNextWindow: false,
          },
          runs: runsWithOutputs.map((entry) => entry.run),
        })}
        selectedRunId={selectedEntry?.run.runId}
        onRunSelected={(event) => setSelectedRunId(event.runId)}
      />
      <ImageOutputGalleryAsset
        listing={{
          kind: "output-gallery-items",
          summary: {
            systemId: selectedEntry?.run.system.systemId ?? "system:image",
            datasetInstanceId: selectedEntry?.run.outputs.datasetInstance?.instanceId ?? "linked-outputs",
            datasetAssetId: selectedEntry?.run.outputs.datasetInstance?.datasetAssetId ?? "linked-outputs",
            datasetAssetVersionId: selectedEntry?.run.outputs.datasetInstance?.datasetAssetVersionId,
            role: selectedEntry?.run.outputs.datasetInstance?.role ?? "system-output",
            purpose: selectedEntry?.run.outputs.datasetInstance?.purpose,
            totalItems: selectedEntry?.linkedOutputs.length ?? 0,
            returnedItems: selectedEntry?.linkedOutputs.length ?? 0,
            truncated: false,
          },
          window: {
            offset: 0,
            limit: Math.max(1, selectedEntry?.linkedOutputs.length ?? 1),
            hasPreviousWindow: false,
            hasNextWindow: false,
          },
          items: selectedEntry?.linkedOutputs ?? [],
        }}
        mode="list"
      />
      <ImageLineageMiniView lineage={selectedEntry ? buildImageRunLineageView(selectedEntry) : undefined} />
    </section>
  );
}

export function ImageResultHistoryInteractionSpaceAsset({
  runsWithOutputs,
}: {
  readonly runsWithOutputs: ReadonlyArray<ImageRunHistoryWithOutputs>;
}): JSX.Element {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(runsWithOutputs[0]?.run.runId);
  const selectedEntry = useMemo(
    () => runsWithOutputs.find((entry) => entry.run.runId === selectedRunId) ?? runsWithOutputs[0],
    [runsWithOutputs, selectedRunId],
  );

  const runListing: ImageRunHistoryListing = {
    kind: "image-run-history",
    summary: {
      systemId: selectedEntry?.run.system.systemId ?? "system:image",
      totalRuns: runsWithOutputs.length,
      returnedRuns: runsWithOutputs.length,
      truncated: false,
    },
    window: {
      offset: 0,
      limit: Math.max(1, runsWithOutputs.length),
      hasPreviousWindow: false,
      hasNextWindow: false,
    },
    runs: runsWithOutputs.map((entry) => entry.run),
  };

  return (
    <section className="ui-image-system-experience ui-image-surface">
      <header className="ui-image-surface__header">
        <h3 className="ui-image-surface__title">Image system interaction space</h3>
      </header>
      <ImageRunHistoryAsset listing={runListing} selectedRunId={selectedEntry?.run.runId} onRunSelected={setSelectedRunId} />
      <ImageOutputGalleryAsset
        mode="list"
        listing={{
          kind: "output-gallery-items",
          summary: {
            systemId: selectedEntry?.run.system.systemId ?? "system:image",
            datasetInstanceId: selectedEntry?.run.outputs.datasetInstance?.instanceId ?? "linked-outputs",
            datasetAssetId: selectedEntry?.run.outputs.datasetInstance?.datasetAssetId ?? "linked-outputs",
            datasetAssetVersionId: selectedEntry?.run.outputs.datasetInstance?.datasetAssetVersionId,
            role: selectedEntry?.run.outputs.datasetInstance?.role ?? "system-output",
            purpose: selectedEntry?.run.outputs.datasetInstance?.purpose,
            totalItems: selectedEntry?.linkedOutputs.length ?? 0,
            returnedItems: selectedEntry?.linkedOutputs.length ?? 0,
            truncated: false,
          },
          window: {
            offset: 0,
            limit: Math.max(1, selectedEntry?.linkedOutputs.length ?? 1),
            hasPreviousWindow: false,
            hasNextWindow: false,
          },
          items: selectedEntry?.linkedOutputs ?? [],
        }}
      />
      <ImageLineageMiniView lineage={selectedEntry ? buildImageRunLineageView(selectedEntry) : undefined} />
    </section>
  );
}

