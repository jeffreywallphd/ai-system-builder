import { useMemo, useState } from "react";
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
import { applyConfigToSelectedStudioAsset, createStudioAssetSelectionState, type StudioAssetSelectionState } from "../../../studio-shell/studio-assets/StudioAssetSelection";

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
          const focusedParentNodeId = selection.selectedNodeId ?? compositionRoot.nodeId;
          const target = resolveDefaultInsertionTarget({
            registry,
            root: compositionRoot,
            parentNodeId: focusedParentNodeId,
          }) ?? resolveDefaultInsertionTarget({
            registry,
            root: compositionRoot,
            parentNodeId: compositionRoot.nodeId,
          });

          if (!target) {
            setStatusMessage("Select a container section before adding this item.");
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
