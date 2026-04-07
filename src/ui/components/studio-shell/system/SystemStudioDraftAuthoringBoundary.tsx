import { useMemo, useRef, useState } from "react";
import type { CanvasSurfaceEditingEvent } from "../../../studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts";
import type { StudioShellValidationIssue } from "../../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  StudioShellValidationIssueCodes,
  StudioShellValidationSections,
} from "../../../../application/studio-shell/StudioShellValidation";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import {
  normalizePanelLayoutBounds,
  parseSystemStudioDraftDocument,
  serializeSystemStudioCanvasAuthoringConfiguration,
  serializeSystemStudioPageDefinitions,
  serializeSystemStudioSettings,
  type SystemStudioDraftDocument,
} from "../../../studio-shell/system/SystemStudioDraftDocument";
import {
  createSystemPanelFromCanvasNode,
  createSystemCanvasExperienceDefinition,
} from "../../../studio-shell/system/SystemCanvasExperienceAdapter";
import { defaultPanelSlotId, type PanelAssetContract } from "../../../studio-shell/experience-assets/PanelAssetContracts";
import { resolveCenteredNormalizedPlacement } from "../../../studio-shell/system/SystemCanvasPlacement";
import {
  areViewportSectionsOverlapping,
  normalizeViewportSectionBounds,
} from "../../../studio-shell/system/SystemPageLayoutInterpretation";
import ConfigurableCanvasSurface from "../experience-assets/ConfigurableCanvasSurface";
import { SystemPageSetupEditor } from "./SystemPageSetupEditor";
import { SystemSettingsEditor } from "./SystemSettingsEditor";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
} from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";
import type { PanelAssetLayoutBounds } from "../../../studio-shell/experience-assets/PanelAssetContracts";

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
const defaultNewSectionSize = Object.freeze({ width: 0.22, height: 0.18 });

export function SystemStudioDraftAuthoringBoundary({
  content,
  validationIssues,
  extensionContext,
  experienceAssetIds = defaultSystemExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
  onStudioEvent,
}: SystemStudioDraftAuthoringBoundaryProps): JSX.Element {
  const [selectedWizardPageId, setSelectedWizardPageId] = useState<string>("pages");
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState<string | undefined>(undefined);
  const [selectedPageId, setSelectedPageId] = useState<string>("page-1");
  const [canvasInteractionIssues, setCanvasInteractionIssues] = useState<ReadonlyArray<StudioShellValidationIssue>>([]);
  const interactionStartBoundsRef = useRef<Map<string, PanelAssetLayoutBounds>>(new Map());
  const supportedModes = useMemo(
    () => resolveExperienceAssetModesFromRegistrations({ assetIds: experienceAssetIds }),
    [experienceAssetIds],
  );

  const document = useMemo(() => parseSystemStudioDraftDocument(content), [content]);
  const latestContentRef = useRef(content);
  latestContentRef.current = content;

  const resolvedSelectedPageId = document.systemSpec.pages.some((page) => page.pageId === selectedPageId)
    ? selectedPageId
    : (document.systemSpec.pages[0]?.pageId ?? "page-1");

  const persistPanelsForSelectedPage = (panels: ReadonlyArray<PanelAssetContract>): void => {
    const latestDocument = parseSystemStudioDraftDocument(latestContentRef.current);
    const nextLayouts = latestDocument.canvasAuthoring.pageLayouts.map((layout) => (
      layout.pageId === resolvedSelectedPageId
        ? Object.freeze({ ...layout, panels })
        : layout
    ));

    const serialized = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: latestContentRef.current,
      canvasAuthoring: Object.freeze({
        ...latestDocument.canvasAuthoring,
        pageLayouts: Object.freeze(nextLayouts),
      }),
    });
    latestContentRef.current = serialized;
    extensionContext.operations.setDraftContent?.(serialized);
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "changes" }),
    }));
  };

  const resolveSelectedPagePanelsFromLatest = (): ReadonlyArray<PanelAssetContract> => {
    const latestDocument = parseSystemStudioDraftDocument(latestContentRef.current);
    return latestDocument.canvasAuthoring.pageLayouts.find((layout) => layout.pageId === resolvedSelectedPageId)?.panels ?? [];
  };

  const createNextPanelId = (panels: ReadonlyArray<PanelAssetContract>): string => {
    const usedIds = new Set(panels.map((panel) => panel.panelId));
    let index = panels.length + 1;
    while (usedIds.has(`panel-${index}`)) {
      index += 1;
    }
    return `panel-${index}`;
  };

  const updateSelectedPagePanel = (input: {
    readonly panelId: string;
    readonly update: (panel: PanelAssetContract) => PanelAssetContract;
  }): void => {
    const latestPanels = resolveSelectedPagePanelsFromLatest();
    persistPanelsForSelectedPage(latestPanels.map((panel) => {
      if ((panel.panelId !== input.panelId) && (panel.sourceLayoutNodeId !== input.panelId)) {
        return panel;
      }
      return Object.freeze(input.update(panel));
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
    const reconciled = parseSystemStudioDraftDocument(serialized);
    const serializedWithSettings = serializeSystemStudioSettings({
      existingContent: serialized,
      settings: reconciled.systemSpec.settings,
    });
    extensionContext.operations.setDraftContent?.(serializedWithSettings);
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "configuration" }),
    }));
    if (!pages.some((page) => page.pageId === resolvedSelectedPageId)) {
      setSelectedPageId(pages[0]?.pageId ?? "page-1");
      setSelectedLayoutNodeId(undefined);
      setCanvasInteractionIssues([]);
      interactionStartBoundsRef.current.clear();
    }
  };

  const selectedPagePanels = document.canvasAuthoring.pageLayouts.find((layout) => layout.pageId === resolvedSelectedPageId)?.panels ?? [];
  const selectedPage = document.systemSpec.pages.find((page) => page.pageId === resolvedSelectedPageId);

  const buildPageLayoutValidationIssues = (
    panels: ReadonlyArray<PanelAssetContract>,
  ): ReadonlyArray<StudioShellValidationIssue> => {
    const issues: StudioShellValidationIssue[] = [];
    const byNodeId = panels.map((panel) => Object.freeze({
      nodeId: panel.sourceLayoutNodeId ?? panel.panelId,
      title: panel.title,
      bounds: normalizeViewportSectionBounds(panel.layoutBounds),
    }));

    for (let index = 0; index < byNodeId.length; index += 1) {
      const source = byNodeId[index];
      if (!source) {
        continue;
      }
      for (let nextIndex = index + 1; nextIndex < byNodeId.length; nextIndex += 1) {
        const target = byNodeId[nextIndex];
        if (!target) {
          continue;
        }
        if (!areViewportSectionsOverlapping({ a: source.bounds, b: target.bounds })) {
          continue;
        }
        issues.push({
          code: StudioShellValidationIssueCodes.lifecycleNotPublishReady,
          section: StudioShellValidationSections.lifecycle,
          severity: "error",
          path: `systemSpec.canvasAuthoring.pageLayouts.${resolvedSelectedPageId}.${source.nodeId}`,
          message: `Sections "${source.title}" and "${target.title}" are overlapping. Move one section to open space.`,
        });
      }
    }
    return Object.freeze(issues);
  };

  const localLayoutValidationIssues = buildPageLayoutValidationIssues(selectedPagePanels);

  const clearNodeInteractionIssue = (nodeId: string): void => {
    setCanvasInteractionIssues((current) => current.filter((issue) => !(issue.path ?? "").includes(nodeId)));
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
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      const currentPanel = latestPanels.find((panel) => (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId);
      if (!currentPanel) {
        return;
      }
      if (event.phase !== "commit" && !interactionStartBoundsRef.current.has(event.nodeId)) {
        interactionStartBoundsRef.current.set(event.nodeId, currentPanel.layoutBounds);
      }
      const nextBounds = normalizePanelLayoutBounds({
        ...currentPanel.layoutBounds,
        x: event.position.x,
        y: event.position.y,
      });
      if (event.phase === "commit") {
        const overlaps = latestPanels.some((panel) => (
          (panel.sourceLayoutNodeId ?? panel.panelId) !== event.nodeId
          && areViewportSectionsOverlapping({ a: panel.layoutBounds, b: nextBounds })
        ));
        if (overlaps) {
          const resetBounds = interactionStartBoundsRef.current.get(event.nodeId) ?? currentPanel.layoutBounds;
          persistPanelsForSelectedPage(latestPanels.map((panel) => (
            (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId
              ? Object.freeze({
                ...panel,
                layoutBounds: normalizePanelLayoutBounds(resetBounds),
              })
              : panel
          )));
          setCanvasInteractionIssues((issues) => Object.freeze([
            ...issues.filter((issue) => !(issue.path ?? "").includes(event.nodeId)),
            {
              code: StudioShellValidationIssueCodes.lifecycleNotPublishReady,
              section: StudioShellValidationSections.lifecycle,
              severity: "error",
              path: `systemSpec.canvasAuthoring.pageLayouts.${resolvedSelectedPageId}.${event.nodeId}`,
              message: "That section still overlaps another section after placement. Move it to an open area.",
            },
          ]));
          interactionStartBoundsRef.current.delete(event.nodeId);
          return;
        }
        interactionStartBoundsRef.current.delete(event.nodeId);
        clearNodeInteractionIssue(event.nodeId);
      }
      persistPanelsForSelectedPage(latestPanels.map((panel) => (
        (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId
          ? Object.freeze({
            ...panel,
            layoutBounds: nextBounds,
          })
          : panel
      )));
      return;
    }

    if (event.type === "node.resize.change") {
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      const currentPanel = latestPanels.find((panel) => (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId);
      if (!currentPanel) {
        return;
      }
      if (event.phase !== "commit" && !interactionStartBoundsRef.current.has(event.nodeId)) {
        interactionStartBoundsRef.current.set(event.nodeId, currentPanel.layoutBounds);
      }
      const nextBounds = normalizePanelLayoutBounds({
        x: event.frame.x,
        y: event.frame.y,
        width: event.frame.width,
        height: event.frame.height,
      });
      if (event.phase === "commit") {
        const overlaps = latestPanels.some((panel) => (
          (panel.sourceLayoutNodeId ?? panel.panelId) !== event.nodeId
          && areViewportSectionsOverlapping({ a: panel.layoutBounds, b: nextBounds })
        ));
        if (overlaps) {
          const resetBounds = interactionStartBoundsRef.current.get(event.nodeId) ?? currentPanel.layoutBounds;
          persistPanelsForSelectedPage(latestPanels.map((panel) => (
            (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId
              ? Object.freeze({
                ...panel,
                layoutBounds: normalizePanelLayoutBounds(resetBounds),
              })
              : panel
          )));
          setCanvasInteractionIssues((issues) => Object.freeze([
            ...issues.filter((issue) => !(issue.path ?? "").includes(event.nodeId)),
            {
              code: StudioShellValidationIssueCodes.lifecycleNotPublishReady,
              section: StudioShellValidationSections.lifecycle,
              severity: "error",
              path: `systemSpec.canvasAuthoring.pageLayouts.${resolvedSelectedPageId}.${event.nodeId}`,
              message: "That section still overlaps another section after resizing. Resize it to fit open space.",
            },
          ]));
          interactionStartBoundsRef.current.delete(event.nodeId);
          return;
        }
        interactionStartBoundsRef.current.delete(event.nodeId);
        clearNodeInteractionIssue(event.nodeId);
      }
      persistPanelsForSelectedPage(latestPanels.map((panel) => (
        (panel.sourceLayoutNodeId ?? panel.panelId) === event.nodeId
          ? Object.freeze({
            ...panel,
            layoutBounds: nextBounds,
          })
          : panel
      )));
      return;
    }

    if (event.type === "node.create.request") {
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      const nodeId = createNextPanelId(latestPanels);
      const panel = createSystemPanelFromCanvasNode({
        pageId: resolvedSelectedPageId,
        regionId: selectedPage?.layout.defaultRegionId,
        node: Object.freeze({
          id: nodeId,
          title: `${selectedPage?.title ?? "Page"} section ${latestPanels.length + 1}`,
          x: event.position.x,
          y: event.position.y,
          width: 0.22,
          height: 0.18,
        }),
      });
      persistPanelsForSelectedPage(Object.freeze([...latestPanels, panel]));
      setCanvasInteractionIssues([]);
      setSelectedLayoutNodeId(panel.sourceLayoutNodeId ?? panel.panelId);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "fit-layout") {
      persistPanelsForSelectedPage([]);
      setCanvasInteractionIssues([]);
      setSelectedLayoutNodeId(undefined);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "add-panel") {
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      const panelId = createNextPanelId(latestPanels);
      const placement = resolveCenteredNormalizedPlacement({
        viewport: event.viewport,
        nodeSize: defaultNewSectionSize,
      });
      const panel: PanelAssetContract = Object.freeze({
        panelId,
        assetId: "ui-composed:panel",
        panelType: "composed-panel",
        pageId: resolvedSelectedPageId,
        regionId: selectedPage?.layout.defaultRegionId,
        title: `${selectedPage?.title ?? "Page"} section ${latestPanels.length + 1}`,
        description: "High-level layout section. Detailed design is handled in the panel studio.",
        layoutBounds: Object.freeze({ ...placement, ...defaultNewSectionSize }),
        contentSlots: Object.freeze([{ slotId: defaultPanelSlotId, label: "Section content" }]),
        sourceLayoutNodeId: panelId,
      });
      persistPanelsForSelectedPage(Object.freeze([...latestPanels, panel]));
      setCanvasInteractionIssues([]);
      setSelectedLayoutNodeId(panel.sourceLayoutNodeId ?? panel.panelId);
      return;
    }

    if (event.type === "canvas.command" && event.commandId === "remove-panel" && selectedLayoutNodeId) {
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      persistPanelsForSelectedPage(Object.freeze(
        latestPanels.filter((panel) => (panel.sourceLayoutNodeId ?? panel.panelId) !== selectedLayoutNodeId),
      ));
      setSelectedLayoutNodeId(undefined);
      return;
    }

    if (event.type === "canvas.command" && event.commandId.startsWith("assign-region:") && selectedLayoutNodeId) {
      const nextRegionId = event.commandId.replace("assign-region:", "").trim();
      if (!nextRegionId) {
        return;
      }
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      persistPanelsForSelectedPage(latestPanels.map((panel) => (
        (panel.sourceLayoutNodeId ?? panel.panelId) === selectedLayoutNodeId
          ? Object.freeze({
            ...panel,
            regionId: nextRegionId,
          })
          : panel
      )));
      return;
    }

    if (event.type === "canvas.command" && event.commandId.startsWith("panel-size:") && selectedLayoutNodeId) {
      const presetId = event.commandId.replace("panel-size:", "").trim();
      const presets = Object.freeze({
        compact: Object.freeze({ width: 0.2, height: 0.16 }),
        balanced: Object.freeze({ width: 0.32, height: 0.24 }),
        featured: Object.freeze({ width: 0.56, height: 0.36 }),
      });
      const preset = presets[presetId as keyof typeof presets];
      if (!preset) {
        return;
      }
      const latestPanels = resolveSelectedPagePanelsFromLatest();
      persistPanelsForSelectedPage(latestPanels.map((panel) => (
        (panel.sourceLayoutNodeId ?? panel.panelId) === selectedLayoutNodeId
          ? Object.freeze({
            ...panel,
            layoutBounds: normalizePanelLayoutBounds({
              ...panel.layoutBounds,
              width: preset.width,
              height: preset.height,
            }),
          })
          : panel
      )));
    }
  };
  const canvasModel = useMemo(
    () => createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues: Object.freeze([
        ...validationIssues,
        ...localLayoutValidationIssues,
        ...canvasInteractionIssues,
      ]),
      selectedLayoutNodeId,
      selectedPageId: resolvedSelectedPageId,
      onSelectPage: (pageId) => {
        setSelectedPageId(pageId);
        setSelectedLayoutNodeId(undefined);
        setCanvasInteractionIssues([]);
        interactionStartBoundsRef.current.clear();
      },
      onCanvasEditingEvent: handleCanvasEditingEvent,
      onPanelCompositionChange: ({ panelId, panel: nextPanel }) => {
        updateSelectedPagePanel({
          panelId,
          update: () => Object.freeze(nextPanel),
        });
      },
    }),
    [
      content,
      extensionContext,
      selectedLayoutNodeId,
      resolvedSelectedPageId,
      selectedPagePanels,
      validationIssues,
      localLayoutValidationIssues,
      canvasInteractionIssues,
    ],
  );

  const wizardPages = Object.freeze([
    Object.freeze({ id: "pages", title: "Pages" }),
    Object.freeze({ id: "interface-design", title: "Page layout" }),
    Object.freeze({ id: "settings", title: "Settings" }),
  ]);
  const activeWizardPageId = wizardPages.some((page) => page.id === selectedWizardPageId)
    ? selectedWizardPageId
    : wizardPages[0]?.id ?? "pages";

  const interfaceDesignReady = document.systemSpec.pages.length > 0 && document.systemSpec.pages.every((page) => (
    (document.canvasAuthoring.pageLayouts.find((entry) => entry.pageId === page.pageId)?.panels.length ?? 0) > 0
  ));
  const settingsReady = document.systemSpec.settings.systemName.trim().length > 0;
  const pagesReady = document.systemSpec.pages.length > 0 && document.systemSpec.pages.every((page) => page.title.trim().length > 0);
  const readyCount = [pagesReady, interfaceDesignReady, settingsReady].filter(Boolean).length;

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-studio-draft-authoring-boundary">
      {supportedModes.length === 0 ? (
        <section className="ui-card ui-card--padded">
          <p className="ui-text-small ui-text-secondary">
            No draft authoring surface is configured for this system experience.
          </p>
        </section>
      ) : (
        <div className="ui-stack ui-stack--sm">
          {hostMode === StudioAssetRenderModes.full ? (
            <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="system-studio-primary-canvas-summary">
              <strong>Page structure canvas</strong>
              <p className="ui-text-small ui-text-secondary">
                The page layout canvas is the main editing space in System Studio. Use Pages and Settings to support that layout work.
              </p>
            </section>
          ) : null}
          <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="system-studio-wizard-pages-card">
            <nav className="ui-configurable-wizard__page-nav" aria-label="System authoring wizard pages">
              <div className="ui-configurable-wizard__page-nav-main">
                <div className="ui-configurable-wizard__page-buttons">
                  {wizardPages.map((page) => (
                    <button key={page.id} type="button" className={`ui-button ui-button--sm ${page.id === activeWizardPageId ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => setSelectedWizardPageId(page.id)}>{page.title}</button>
                  ))}
                </div>
                <p className="ui-text-muted ui-configurable-wizard__page-progress">Current focus: <strong>{wizardPages.find((page) => page.id === activeWizardPageId)?.title ?? "Pages"}</strong>. Progress: {readyCount}/3 pages ready.</p>
              </div>
            </nav>
            {activeWizardPageId === "pages" ? (
              <SystemPageSetupEditor pages={document.systemSpec.pages} selectedPageId={resolvedSelectedPageId} onSelectPage={(pageId) => { setSelectedPageId(pageId); setSelectedLayoutNodeId(undefined); }} onPagesChange={persistSystemPages} />
            ) : null}
            {activeWizardPageId === "interface-design" ? (
              <section className="ui-stack ui-stack--sm" data-testid="system-wizard-interface-design-page">
                <div className="ui-stack ui-stack--2xs">
                  <p className="ui-text-small ui-text-secondary">Pick a page, then arrange its major sections. Detailed panel content is designed in each panel's embedded studio.</p>
                  <div className="ui-row ui-row--wrap" data-testid="system-wizard-page-switcher">
                    {document.systemSpec.pages.map((page) => (
                      <button key={page.pageId} type="button" className={`ui-button ui-button--sm ${page.pageId === resolvedSelectedPageId ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => { setSelectedPageId(page.pageId); setSelectedLayoutNodeId(undefined); }}>{page.title}</button>
                    ))}
                  </div>
                </div>
                <ConfigurableCanvasSurface definition={canvasModel.definition} definitionContext={canvasModel.context} />
              </section>
            ) : null}
            {activeWizardPageId === "settings" ? (
              <section className="ui-stack ui-stack--sm" data-testid="system-wizard-settings-page">
                <SystemSettingsEditor context={extensionContext} />
              </section>
            ) : null}
          </section>

          <details className="ui-card ui-card--padded ui-configurable-wizard__readiness" data-testid="configurable-wizard-readiness-summary">
            <summary className="ui-configurable-wizard__readiness-summary"><strong>System setup readiness</strong></summary>
            <div className="ui-stack ui-stack--2xs ui-configurable-wizard__readiness-content">
              <p className="ui-text-muted">{document.systemSpec.pages.length === 0
                ? "Start by adding your first page."
                : document.systemSpec.pages.some((page) => page.title.trim().length === 0)
                  ? "Give each page a title so people can find what they need."
                  : !interfaceDesignReady
                    ? "Add at least one panel to each page in Interface Design."
                    : "Your setup is ready. You can keep refining page structure, navigation, and settings."}</p>
              {validationIssues.length > 0 ? (
                <ul className="ui-stack ui-stack--2xs">{validationIssues.map((issue) => <li key={`${issue.code}:${issue.path ?? ""}:${issue.message}`}><span className="ui-text-muted">{issue.message}</span></li>)}</ul>
              ) : <p className="ui-text-muted">No blocking issues detected.</p>}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default SystemStudioDraftAuthoringBoundary;
