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
  type SystemStudioDraftDocument,
} from "../../../studio-shell/system/SystemStudioDraftDocument";
import {
  createSystemWizardExperienceAdapterModel,
  SystemWizardPageIds,
  type SystemWizardPageId,
} from "../../../studio-shell/system/SystemWizardExperienceAdapter";
import {
  createSystemCanvasExperienceDefinition,
  SystemCanvasInspectorPanels,
  type SystemCanvasInspectorPanelId,
} from "../../../studio-shell/system/SystemCanvasExperienceAdapter";
import type { PanelAssetContract } from "../../../studio-shell/experience-assets/PanelAssetContracts";
import ExperienceAssetAuthoringBoundary from "../experience-assets/ExperienceAssetAuthoringBoundary";
import ConfigurableWizardSurface from "../experience-assets/ConfigurableWizardSurface";
import ConfigurableCanvasSurface from "../experience-assets/ConfigurableCanvasSurface";

interface SystemStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
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
}: SystemStudioDraftAuthoringBoundaryProps): JSX.Element {
  const [selectedModeId, setSelectedModeId] = useState<"wizard" | "canvas">("wizard");
  const [selectedWizardPageId, setSelectedWizardPageId] = useState<SystemWizardPageId>(SystemWizardPageIds.composition);
  const [selectedInspectorPanel, setSelectedInspectorPanel] = useState<SystemCanvasInspectorPanelId>(
    SystemCanvasInspectorPanels.interfaces,
  );
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState<string | undefined>(undefined);

  const document = useMemo(() => parseSystemStudioDraftDocument(content), [content]);

  const persistPanels = (panels: ReadonlyArray<PanelAssetContract>): void => {
    const serialized = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: content,
      canvasAuthoring: Object.freeze({
        ...document.canvasAuthoring,
        panels,
      }),
    });
    extensionContext.operations.setDraftContent?.(serialized);
  };

  const handleCanvasEditingEvent = (event: CanvasSurfaceEditingEvent): void => {
    if (event.type === "selection.change") {
      setSelectedLayoutNodeId(event.nodeId);
      return;
    }

    if (event.type === "node.position.change") {
      persistPanels(document.canvasAuthoring.panels.map((panel) => (
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
      persistPanels(document.canvasAuthoring.panels.map((panel) => (
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

    if (event.type === "canvas.command" && event.commandId === "fit-layout") {
      persistPanels([]);
    }
  };
  const assetDefinition = useMemo(
    () => buildSystemExperienceDefinition(experienceAssetIds),
    [experienceAssetIds],
  );

  const wizardModel = useMemo(
    () => createSystemWizardExperienceAdapterModel({ content, extensionContext, validationIssues }),
    [content, extensionContext, validationIssues],
  );

  const canvasModel = useMemo(
    () => createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues,
      selectedInspectorPanel,
      onSelectInspectorPanel: setSelectedInspectorPanel,
      selectedLayoutNodeId,
      onCanvasEditingEvent: handleCanvasEditingEvent,
    }),
    [content, extensionContext, selectedInspectorPanel, selectedLayoutNodeId, validationIssues],
  );

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-studio-draft-authoring-boundary">
      <ExperienceAssetAuthoringBoundary
        asset={assetDefinition}
        currentModeId={selectedModeId}
        onModeChange={(modeId) => setSelectedModeId(modeId)}
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
