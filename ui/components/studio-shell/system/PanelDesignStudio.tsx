import { useEffect, useMemo, useState } from "react";
import StudioAssetLibraryPanel from "../studio-assets/StudioAssetLibraryPanel";
import {
  createDefaultPanelCompositionRoot,
  defaultPanelSlotId,
  type PanelAssetCompositionContent,
  type PanelAssetContract,
} from "../../../studio-shell/experience-assets/PanelAssetContracts";
import type { StudioAssetCompositionNode } from "../../../studio-shell/studio-assets/StudioAssetComposition";
import { createDefaultStudioAssetRegistry, StudioAssetRegistrationCategories } from "../../../studio-shell/studio-assets/StudioAssetRegistry";
import { insertStudioAssetIntoCompositionTree, resolveDefaultInsertionTarget } from "../../../studio-shell/studio-assets/StudioAssetInsertion";
import { applyConfigToSelectedStudioAsset, bindStudioAssetSelection, createStudioAssetSelectionState, type StudioAssetSelectionState } from "../../../studio-shell/studio-assets/StudioAssetSelection";
import type { StudioAssetLibraryEntry } from "../../../studio-shell/studio-assets/StudioAssetLibrary";

interface CompositionNodeSummary {
  readonly nodeId: string;
  readonly assetId: string;
  readonly title: string;
  readonly depth: number;
}

interface InsertionContext {
  readonly targetNodeId: string;
  readonly targetAssetTitle: string;
  readonly slotId: string;
  readonly slotLabel: string;
}

function collectCompositionNodeSummaries(input: {
  readonly root: StudioAssetCompositionNode;
  readonly registry: ReturnType<typeof createDefaultStudioAssetRegistry>;
}): ReadonlyArray<CompositionNodeSummary> {
  const entries: CompositionNodeSummary[] = [];
  const walk = (node: StudioAssetCompositionNode, depth: number): void => {
    const registration = input.registry.getById(node.assetId);
    entries.push(Object.freeze({
      nodeId: node.nodeId,
      assetId: node.assetId,
      title: registration?.metadata.title ?? node.assetId,
      depth,
    }));
    for (const child of (node.slots ?? []).flatMap((placement) => placement.children)) {
      walk(child, depth + 1);
    }
    for (const child of (node.regions ?? []).flatMap((placement) => placement.children)) {
      walk(child, depth + 1);
    }
  };
  walk(input.root, 0);
  return Object.freeze(entries);
}

export interface PanelDesignStudioProps {
  readonly panel: PanelAssetContract;
  readonly onChangePanel: (next: PanelAssetContract) => void;
}

function parsePanelComposition(input: {
  readonly panel: PanelAssetContract;
  readonly registry: ReturnType<typeof createDefaultStudioAssetRegistry>;
}): StudioAssetCompositionNode {
  const content = input.panel.content;
  if (content?.kind === "asset-composition") {
    try {
      const parsed = input.registry.deserializeCompositionTree({
        serialized: content.serializedDocument,
        validate: true,
      });
      return parsed.root;
    } catch {
      return createDefaultPanelCompositionRoot(input.panel);
    }
  }
  return createDefaultPanelCompositionRoot(input.panel);
}

function toPanelCompositionContent(input: {
  readonly root: StudioAssetCompositionNode;
  readonly registry: ReturnType<typeof createDefaultStudioAssetRegistry>;
}): PanelAssetCompositionContent {
  return Object.freeze({
    kind: "asset-composition",
    serializedDocument: input.registry.serializeCompositionTree(input.root),
  });
}

export default function PanelDesignStudio({ panel, onChangePanel }: PanelDesignStudioProps): JSX.Element {
  const registry = useMemo(() => createDefaultStudioAssetRegistry(), []);
  const compositionRoot = useMemo(() => parsePanelComposition({ panel, registry }), [panel, registry]);
  const [selection, setSelection] = useState<StudioAssetSelectionState>(
    createStudioAssetSelectionState({ root: compositionRoot, nodeId: compositionRoot.nodeId }),
  );
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const boundSelection = useMemo(() => bindStudioAssetSelection({ root: compositionRoot, selection }), [compositionRoot, selection]);
  const insertionTarget = useMemo(() => {
    const focusedParentNodeId = boundSelection.focusedNodeId ?? boundSelection.selectedNodeId ?? compositionRoot.nodeId;
    return resolveDefaultInsertionTarget({
      registry,
      root: compositionRoot,
      parentNodeId: focusedParentNodeId,
    }) ?? resolveDefaultInsertionTarget({
      registry,
      root: compositionRoot,
      parentNodeId: compositionRoot.nodeId,
    });
  }, [boundSelection.focusedNodeId, boundSelection.selectedNodeId, compositionRoot, registry]);

  const insertionContext = useMemo<InsertionContext | undefined>(() => {
    if (!insertionTarget) {
      return undefined;
    }
    const targetNode = collectCompositionNodeSummaries({ root: compositionRoot, registry })
      .find((entry) => entry.nodeId === insertionTarget.parentNodeId);
    return Object.freeze({
      targetNodeId: insertionTarget.parentNodeId,
      targetAssetTitle: targetNode?.title ?? insertionTarget.parentNodeId,
      slotId: insertionTarget.placementId,
      slotLabel: insertionTarget.placementId === defaultPanelSlotId ? "Panel content" : insertionTarget.placementId,
    });
  }, [compositionRoot, insertionTarget, registry]);

  const compatibleEntryIds = useMemo(() => {
    if (!insertionTarget) {
      return new Set<string>();
    }
    const next = new Set<string>();
    for (const registration of registry.list()) {
      const result = insertStudioAssetIntoCompositionTree({
        registry,
        request: {
          root: compositionRoot,
          assetId: registration.id,
          target: insertionTarget,
        },
      });
      if (result.ok) {
        next.add(registration.id);
      }
    }
    return next;
  }, [compositionRoot, insertionTarget, registry]);
  const nodeSummaries = useMemo(
    () => collectCompositionNodeSummaries({ root: compositionRoot, registry }),
    [compositionRoot, registry],
  );

  useEffect(() => {
    const selectedNodeId = selection.selectedNodeId?.trim();
    if (!selectedNodeId) {
      setSelection(createStudioAssetSelectionState({ root: compositionRoot, nodeId: compositionRoot.nodeId }));
      return;
    }
    const exists = nodeSummaries.some((entry) => entry.nodeId === selectedNodeId);
    if (!exists) {
      setSelection(createStudioAssetSelectionState({ root: compositionRoot, nodeId: compositionRoot.nodeId }));
    }
  }, [compositionRoot, nodeSummaries, selection.selectedNodeId]);

  const replaceCompositionRoot = (nextRoot: StudioAssetCompositionNode): void => {
    onChangePanel(Object.freeze({
      ...panel,
      contentSlots: panel.contentSlots.length > 0 ? panel.contentSlots : Object.freeze([{ slotId: defaultPanelSlotId, label: "Panel content" }]),
      content: toPanelCompositionContent({ root: nextRoot, registry }),
    }));
    setSelection(createStudioAssetSelectionState({ root: nextRoot, nodeId: nextRoot.nodeId }));
  };

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="panel-design-studio">
      <div className="ui-stack ui-stack--2xs">
        <strong className="ui-text-small">Panel design studio</strong>
        <p className="ui-text-small ui-text-secondary">
          Add reusable content into this section. Layout placement stays in the page canvas, while section content is built here.
        </p>
      </div>

      <section className="ui-panel ui-stack ui-stack--2xs" data-testid="panel-design-studio-selection-context">
        <strong className="ui-text-small">What you&apos;re editing</strong>
        <p className="ui-text-small ui-text-secondary">
          Select the panel or any item inside it to choose where new content should be added and what settings to edit.
        </p>
        <div className="ui-row ui-row--wrap">
          {nodeSummaries.map((entry) => (
            <button
              key={entry.nodeId}
              type="button"
              className={`ui-button ui-button--sm ${selection.selectedNodeId === entry.nodeId ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => setSelection(createStudioAssetSelectionState({ root: compositionRoot, nodeId: entry.nodeId }))}
            >
              {`${"• ".repeat(entry.depth)}${entry.title}`}
            </button>
          ))}
        </div>
        {insertionContext ? (
          <p className="ui-text-small ui-text-secondary" data-testid="panel-design-studio-insertion-context">
            Adding content to <strong>{insertionContext.targetAssetTitle}</strong> · Slot: {insertionContext.slotLabel}
          </p>
        ) : (
          <p className="ui-text-small ui-text-secondary" data-testid="panel-design-studio-invalid-target">
            This selection cannot hold child content. Select a container item to add content.
          </p>
        )}
        {insertionTarget && compatibleEntryIds.size === 0 ? (
          <p className="ui-text-small ui-text-secondary" data-testid="panel-design-studio-no-compatible-assets">
            No compatible assets are available for this location. Select a different container to continue.
          </p>
        ) : null}
      </section>

      {statusMessage ? <p className="ui-text-small ui-text-secondary">{statusMessage}</p> : null}

      <StudioAssetLibraryPanel
        registry={registry}
        title="Content library"
        description="Choose assets to place inside this section."
        categoryFilter={Object.freeze([
          StudioAssetRegistrationCategories.atomicUi,
          StudioAssetRegistrationCategories.composedUi,
        ])}
        compositionRoot={compositionRoot}
        selection={selection}
        onChangeSelection={setSelection}
        entryFilter={(entry: StudioAssetLibraryEntry) => insertionTarget ? compatibleEntryIds.has(entry.id) : false}
        emptyStateMessage={insertionTarget
          ? "No compatible assets match your current filters for this spot."
          : "Select a container item to browse assets you can add here."}
        onReplaceCompositionRoot={(nextRoot) => {
          replaceCompositionRoot(nextRoot);
          setStatusMessage("Section design updated.");
        }}
        onChangeSelectedAssetConfig={(nextConfig) => {
          const nextRoot = applyConfigToSelectedStudioAsset({
            root: compositionRoot,
            selection,
            config: nextConfig,
          });
          replaceCompositionRoot(nextRoot);
          setStatusMessage("Selected asset settings updated.");
        }}
        onInsertAsset={(entry) => {
          const target = insertionTarget;
          if (!target) {
            setStatusMessage("Select a container item before adding content.");
            return;
          }

          const inserted = insertStudioAssetIntoCompositionTree({
            registry,
            request: {
              root: compositionRoot,
              assetId: entry.id,
              target,
            },
          });

          if (!inserted.ok) {
            setStatusMessage(inserted.message);
            return;
          }

          replaceCompositionRoot(inserted.root);
          setSelection(createStudioAssetSelectionState({
            root: inserted.root,
            nodeId: inserted.insertedNode.nodeId,
          }));
          setStatusMessage(`Added ${entry.title}.`);
        }}
      />
    </section>
  );
}
