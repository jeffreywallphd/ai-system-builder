import { useMemo, useState } from "react";
import type { CanvasSurfaceEditingEvent } from "../../../studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts";
import type { StudioShellValidationIssue } from "../../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { ExperienceAssetModeIds, type ExperienceAssetDefinition } from "../../../studio-shell/experience-assets/ExperienceAssetContracts";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import {
  parseSystemStudioDraftDocument,
  serializeSystemStudioCanvasAuthoringConfiguration,
  serializeSystemStudioEmbeddedDatasetDraftContent,
  serializeSystemStudioEmbeddedWorkflowDraftContent,
  serializeSystemStudioPageDefinitions,
  type SystemStudioDraftDocument,
} from "../../../studio-shell/system/SystemStudioDraftDocument";
import {
  createSystemWizardExperienceAdapterModel,
  SystemWizardPageIds,
  type SystemWizardPageId,
} from "../../../studio-shell/system/SystemWizardExperienceAdapter";
import {
  createSystemPanelFromCanvasNode,
  createSystemCanvasExperienceDefinition,
  SystemCanvasInspectorPanels,
  type SystemCanvasInspectorPanelId,
} from "../../../studio-shell/system/SystemCanvasExperienceAdapter";
import type { PanelAssetContract } from "../../../studio-shell/experience-assets/PanelAssetContracts";
import ExperienceAssetAuthoringBoundary from "../experience-assets/ExperienceAssetAuthoringBoundary";
import ConfigurableWizardSurface from "../experience-assets/ConfigurableWizardSurface";
import ConfigurableCanvasSurface from "../experience-assets/ConfigurableCanvasSurface";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
  type StudioEmbeddedEventEnvelope,
} from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

interface SystemStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly hostMode?: StudioAssetRenderMode;
  readonly onStudioEvent?: (event: StudioEmbeddedEvent) => void;
}

const defaultSystemExperienceAssetIds = Object.freeze([
  ExperienceSurfaceAssetIds.loomWizard,
  ExperienceSurfaceAssetIds.loomCanvas,
]);

function buildSystemExperienceDefinition(
  experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>,
): ExperienceAssetDefinition<SystemStudioDraftDocument, StudioShellValidationIssue> {
  const fallbackModes = Object.freeze([
    Object.freeze({
      id: ExperienceAssetModeIds.wizard,
      title: "Wizard",
      summary: "Guided system composition.",
      intent: "guided-authoring" as const,
    }),
    Object.freeze({
      id: ExperienceAssetModeIds.canvas,
      title: "Canvas",
      summary: "Graph-oriented system composition.",
      intent: "graph-authoring" as const,
    }),
  ]);

  const enabledModeIds = new Set(
    resolveExperienceAssetModesFromRegistrations({
      assetIds: experienceAssetIds,
      fallbackModes,
    }).map((mode) => mode.id),
  );

  const modes = fallbackModes.filter((mode) => enabledModeIds.has(mode.id));
  const hasWizard = modes.some((mode) => mode.id === ExperienceAssetModeIds.wizard);
  const hasCanvas = modes.some((mode) => mode.id === ExperienceAssetModeIds.canvas);

  return Object.freeze({
    id: "system-studio-experience",
    title: "System Studio",
    defaultModeId: hasWizard ? ExperienceAssetModeIds.wizard : ExperienceAssetModeIds.canvas,
    modes: Object.freeze(modes),
    wizard: hasWizard
      ? Object.freeze({ id: "wizard", title: "Wizard", summary: "Guided system composition." })
      : undefined,
    canvas: hasCanvas
      ? Object.freeze({ id: "canvas", title: "Canvas", summary: "Graph-oriented system composition." })
      : undefined,
  });
}

export function SystemStudioDraftAuthoringBoundary({
  content,
  validationIssues,
  extensionContext,
  experienceAssetIds = defaultSystemExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
  onStudioEvent,
}: SystemStudioDraftAuthoringBoundaryProps): JSX.Element {
  const [selectedModeId, setSelectedModeId] = useState<"wizard" | "canvas">("wizard");
  const [selectedWizardPageId, setSelectedWizardPageId] = useState<SystemWizardPageId>(SystemWizardPageIds.pages);
  const [selectedInspectorPanel, setSelectedInspectorPanel] = useState<SystemCanvasInspectorPanelId>(
    SystemCanvasInspectorPanels.interfaces,
  );
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState<string | undefined>(undefined);
  const [selectedPageId, setSelectedPageId] = useState<string>("page-1");

  const document = useMemo(() => parseSystemStudioDraftDocument(content), [content]);

  const resolvedSelectedPageId = document.systemSpec.pages.some((page) => page.pageId === selectedPageId)
    ? selectedPageId
    : (document.systemSpec.pages[0]?.pageId ?? "page-1");

  const persistPanelsForSelectedPage = (panels: ReadonlyArray<PanelAssetContract>): void => {
    const nextLayouts = document.canvasAuthoring.pageLayouts.map((layout) => (
      layout.pageId === resolvedSelectedPageId
        ? Object.freeze({ ...layout, panels })
        : layout
    ));

    const serialized = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: content,
      canvasAuthoring: Object.freeze({
        ...document.canvasAuthoring,
        pageLayouts: Object.freeze(nextLayouts),
      }),
    });
    extensionContext.operations.setDraftContent?.(serialized);
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "changes" }),
    }));
  };

  const persistSystemPages = (pages: SystemStudioDraftDocument["systemSpec"]["pages"]): void => {
    const serializedPages = serializeSystemStudioPageDefinitions({
      existingContent: content,
      pages,
    });
    const serialized = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: serializedPages,
      canvasAuthoring: Object.freeze({
        ...document.canvasAuthoring,
        pageLayouts: Object.freeze(
          pages.map((page) => {
            const existing = document.canvasAuthoring.pageLayouts.find((layout) => layout.pageId === page.pageId);
            return Object.freeze({
              pageId: page.pageId,
              panels: existing?.panels ?? Object.freeze([]),
            });
          }),
        ),
      }),
    });
    extensionContext.operations.setDraftContent?.(serialized);
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "configuration" }),
    }));
    if (!pages.some((page) => page.pageId === resolvedSelectedPageId)) {
      setSelectedPageId(pages[0]?.pageId ?? "page-1");
      setSelectedLayoutNodeId(undefined);
    }
  };

  const selectedPagePanels = document.canvasAuthoring.pageLayouts.find((layout) => layout.pageId === resolvedSelectedPageId)?.panels ?? [];
  const embeddedDatasetContent = document.systemSpec.embeddedStudios?.dataset?.draftContent ?? "";
  const embeddedWorkflowContent = document.systemSpec.embeddedStudios?.workflow?.draftContent ?? "";

  const persistEmbeddedDatasetContent = (nextDatasetContent: string): void => {
    const serialized = serializeSystemStudioEmbeddedDatasetDraftContent({
      existingContent: content,
      draftContent: nextDatasetContent,
    });
    extensionContext.operations.setDraftContent?.(serialized);
  };

  const embeddedDatasetExtensionContext: StudioShellExtensionContext = Object.freeze({
    ...extensionContext,
    operations: Object.freeze({
      ...extensionContext.operations,
      setDraftContent: persistEmbeddedDatasetContent,
    }),
  });

  const persistEmbeddedWorkflowContent = (nextWorkflowContent: string): void => {
    const serialized = serializeSystemStudioEmbeddedWorkflowDraftContent({
      existingContent: content,
      draftContent: nextWorkflowContent,
    });
    extensionContext.operations.setDraftContent?.(serialized);
  };

  const embeddedWorkflowExtensionContext: StudioShellExtensionContext = Object.freeze({
    ...extensionContext,
    operations: Object.freeze({
      ...extensionContext.operations,
      setDraftContent: persistEmbeddedWorkflowContent,
    }),
  });

  const handleEmbeddedStudioEvent = (envelope: StudioEmbeddedEventEnvelope): void => {
    const { event } = envelope;
    if (event.type === "studio.intent" && event.intent.kind === StudioEmbeddedIntentKinds.selectionChange) {
      onStudioEvent?.(createStudioIntentEvent({
        kind: StudioEmbeddedIntentKinds.selectionChange,
        payload: Object.freeze({
          targetType: event.intent.payload.targetType,
          targetId: event.intent.payload.targetId,
        }),
      }));
      return;
    }
    if (event.type === "studio.intent" && event.intent.kind === StudioEmbeddedIntentKinds.applyRequest) {
      onStudioEvent?.(createStudioIntentEvent({
        kind: StudioEmbeddedIntentKinds.applyRequest,
        payload: Object.freeze({
          scope: "changes",
        }),
      }));
    }
  };

  const handleCanvasEditingEvent = (event: CanvasSurfaceEditingEvent): void => {
    if (event.type === "selection.change") {
      setSelectedLayoutNodeId(event.nodeId);
      onStudioEvent?.(createStudioIntentEvent({
        kind: StudioEmbeddedIntentKinds.selectionChange,
        payload: Object.freeze({
          targetType: "canvas-node",
          targetId: event.nodeId,
        }),
      }));
      return;
    }

    if (event.type === "node.position.change") {
      persistPanelsForSelectedPage(selectedPagePanels.map((panel) => (
        panel.sourceLayoutNodeId === event.nodeId
          ? Object.freeze({
            ...panel,
            layoutBounds: Object.freeze({
              ...panel.layoutBounds,
              x: event.position.x,
              y: event.position.y,
            }),
          })
          : panel
      )));
      return;
    }

    if (event.type === "node.resize.change") {
      persistPanelsForSelectedPage(selectedPagePanels.map((panel) => (
        panel.sourceLayoutNodeId === event.nodeId
          ? Object.freeze({
            ...panel,
            layoutBounds: Object.freeze({
              x: event.frame.x,
              y: event.frame.y,
              width: event.frame.width,
              height: event.frame.height,
            }),
          })
          : panel
      )));
      return;
    }

    if (event.type === "node.create.request") {
      const nodeId = `panel-node-${Date.now()}`;
      const panel = createSystemPanelFromCanvasNode({
        pageId: resolvedSelectedPageId,
        node: Object.freeze({
          id: nodeId,
          title: `Panel ${selectedPagePanels.length + 1}`,
          x: event.position.x,
          y: event.position.y,
          width: 0.22,
          height: 0.18,
        }),
      });
      persistPanelsForSelectedPage(Object.freeze([...selectedPagePanels, panel]));
      setSelectedLayoutNodeId(panel.sourceLayoutNodeId ?? panel.panelId);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "fit-layout") {
      persistPanelsForSelectedPage([]);
      setSelectedLayoutNodeId(undefined);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "add-panel") {
      const panelId = `panel-${selectedPagePanels.length + 1}`;
      const panel: PanelAssetContract = Object.freeze({
        panelId,
        pageId: resolvedSelectedPageId,
        title: `Panel ${selectedPagePanels.length + 1}`,
        layoutBounds: Object.freeze({ x: 0.05, y: 0.05, width: 0.22, height: 0.18 }),
        contentSlots: Object.freeze([{ slotId: `${panelId}-content`, label: "Panel content" }]),
        sourceLayoutNodeId: panelId,
      });
      persistPanelsForSelectedPage(Object.freeze([...selectedPagePanels, panel]));
      setSelectedLayoutNodeId(panel.sourceLayoutNodeId ?? panel.panelId);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "remove-panel" && selectedLayoutNodeId) {
      persistPanelsForSelectedPage(Object.freeze(
        selectedPagePanels.filter((panel) => panel.sourceLayoutNodeId !== selectedLayoutNodeId && panel.panelId !== selectedLayoutNodeId),
      ));
      setSelectedLayoutNodeId(undefined);
    }
  };
  const assetDefinition = useMemo(
    () => buildSystemExperienceDefinition(experienceAssetIds),
    [experienceAssetIds],
  );

  const canvasModel = useMemo(
    () => createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues,
      selectedInspectorPanel,
      onSelectInspectorPanel: setSelectedInspectorPanel,
      selectedLayoutNodeId,
      selectedPageId: resolvedSelectedPageId,
      onSelectPage: (pageId) => {
        setSelectedPageId(pageId);
        setSelectedLayoutNodeId(undefined);
      },
      onCanvasEditingEvent: handleCanvasEditingEvent,
    }),
    [content, extensionContext, selectedInspectorPanel, selectedLayoutNodeId, resolvedSelectedPageId, validationIssues],
  );

  const wizardModel = useMemo(
    () => createSystemWizardExperienceAdapterModel({
      content,
      extensionContext,
      validationIssues,
      selectedPageId: resolvedSelectedPageId,
      onSelectPage: (pageId) => {
        setSelectedPageId(pageId);
        setSelectedLayoutNodeId(undefined);
      },
      onPagesChange: persistSystemPages,
      canvasDefinition: canvasModel.definition,
      canvasContext: canvasModel.context,
      embeddedDatasetContent,
      embeddedDatasetExtensionContext,
      embeddedWorkflowContent,
      embeddedWorkflowExtensionContext,
      onEmbeddedStudioEvent: handleEmbeddedStudioEvent,
    }),
    [
      content,
      extensionContext,
      validationIssues,
      resolvedSelectedPageId,
      canvasModel,
      embeddedDatasetContent,
      embeddedDatasetExtensionContext,
      embeddedWorkflowContent,
      embeddedWorkflowExtensionContext,
    ],
  );

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-studio-draft-authoring-boundary">
      <ExperienceAssetAuthoringBoundary
        asset={assetDefinition}
        currentModeId={selectedModeId}
        onModeChange={hostMode === StudioAssetRenderModes.full ? (modeId) => {
          setSelectedModeId(modeId);
          onStudioEvent?.(createStudioIntentEvent({
            kind: StudioEmbeddedIntentKinds.selectionChange,
            payload: Object.freeze({
              targetType: "item",
              targetId: modeId,
            }),
          }));
        } : undefined}
        document={document}
        issues={validationIssues}
        surfaces={{
          wizard: () => (
            <ConfigurableWizardSurface
              definition={wizardModel.definition}
              definitionContext={wizardModel.context}
              activePageId={selectedWizardPageId}
              onPageChange={(pageId) => setSelectedWizardPageId(pageId as SystemWizardPageId)}
            />
          ),
          canvas: () => (
            <ConfigurableCanvasSurface
              definition={canvasModel.definition}
              definitionContext={canvasModel.context}
            />
          ),
        }}
      />
    </div>
  );
}

export default SystemStudioDraftAuthoringBoundary;
