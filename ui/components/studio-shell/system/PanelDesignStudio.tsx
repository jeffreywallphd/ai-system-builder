import { useEffect, useMemo, useState } from "react";
import StudioAssetLibraryPanel from "../studio-assets/StudioAssetLibraryPanel";
import {
  defaultPanelSlotId,
  type PanelAssetCompositionContent,
  type PanelContainerConfig,
  type PanelAssetContract,
} from "../../../studio-shell/experience-assets/PanelAssetContracts";
import {
  PanelCompositionStatusKinds,
  resolvePanelCompositionState,
} from "../../../studio-shell/experience-assets/PanelAssetCompositionState";
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
  readonly targetAssetTitle: string;
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
  const parsedCompositionState = useMemo(() => resolvePanelCompositionState({ panel, registry }), [panel, registry]);
  const [compositionRoot, setCompositionRoot] = useState<StudioAssetCompositionNode>(parsedCompositionState.root);
  const [selection, setSelection] = useState<StudioAssetSelectionState>(
    createStudioAssetSelectionState({ root: parsedCompositionState.root, nodeId: parsedCompositionState.root.nodeId }),
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
      targetAssetTitle: targetNode?.title ?? insertionTarget.parentNodeId,
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
  const panelContainerConfig = useMemo<PanelContainerConfig>(() => parsedCompositionState.panelContainerConfig, [parsedCompositionState.panelContainerConfig]);

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


  useEffect(() => {
    setCompositionRoot(parsedCompositionState.root);
  }, [parsedCompositionState.root]);

  const replaceCompositionRoot = (nextRoot: StudioAssetCompositionNode): void => {
    setCompositionRoot(nextRoot);
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
      {parsedCompositionState.notice ? (
        <section className="ui-panel ui-empty-state" data-testid={`panel-design-studio-notice-${parsedCompositionState.notice.kind}`}>
          <strong className="ui-text-small">{parsedCompositionState.notice.title}</strong>
          <p className="ui-text-small ui-text-secondary">{parsedCompositionState.notice.description}</p>
          {parsedCompositionState.validationIssues.length > 0 ? (
            <ul className="ui-text-small ui-text-secondary" style={{ margin: 0, paddingInlineStart: "1rem" }}>
              {parsedCompositionState.validationIssues.slice(0, 3).map((issue) => (
                <li key={`${issue.path}:${issue.code}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="ui-panel ui-stack ui-stack--2xs" data-testid="panel-design-studio-layout-header-summary">
        <strong className="ui-text-small">Section behavior</strong>
        <p className="ui-text-small ui-text-secondary">
          Use the inspector settings below to tune how this section arranges content and how its header appears.
        </p>
        <div className="ui-row ui-row--wrap">
          <span className="ui-badge ui-badge--neutral">
            Layout: {panelContainerConfig.layout.mode === "vertical-stack"
              ? "Vertical stack"
              : panelContainerConfig.layout.mode === "horizontal-split"
                ? "Horizontal split"
                : "Grid"}
          </span>
          <span className="ui-badge ui-badge--neutral">Spacing: {panelContainerConfig.layout.gap}px</span>
          {panelContainerConfig.layout.mode === "grid" ? (
            <span className="ui-badge ui-badge--neutral">Columns: {panelContainerConfig.layout.columns ?? 2}</span>
          ) : null}
          <span className="ui-badge ui-badge--neutral">
            Header: {panelContainerConfig.header.visible ? "Visible" : "Hidden"}
          </span>
          {panelContainerConfig.header.actions.length > 0 ? (
            <span className="ui-badge ui-badge--neutral">Header actions: {panelContainerConfig.header.actions.length}</span>
          ) : null}
        </div>
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
          : parsedCompositionState.notice?.kind === PanelCompositionStatusKinds.invalidConfiguration
            ? "Fix section issues above, then select a container item to add content."
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
