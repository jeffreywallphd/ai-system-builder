import { useMemo, useState, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceEditingEvent,
  CanvasSurfaceEditingModel,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceIdentity,
  CanvasSurfaceLayoutNodeModel,
  CanvasSurfacePaletteModel,
  CanvasSurfaceToolbarActionModel,
} from "../../../studio-shell/experience-assets/ConfigurableCanvasSurfaceContracts";
import type { ExperienceIssueSummary } from "../../../studio-shell/experience-assets/ExperiencePresentationVocabulary";

interface CanvasDrawerState {
  readonly label: string;
  readonly isEnabled: boolean;
  readonly isOpen: boolean;
  readonly onClose?: () => void;
}

interface ConfigurableCanvasSurfaceDirectProps {
  readonly identity: CanvasSurfaceIdentity;
  readonly graphSummary: CanvasSurfaceGraphSummary;
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
  readonly palette?: CanvasSurfacePaletteModel;
  readonly issues?: ReadonlyArray<ExperienceIssueSummary>;
  readonly toolbarActions?: ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly editingModel?: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
  readonly renderGraphInteractionShell?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element;
  readonly renderPaletteRegion?: () => JSX.Element | null;
  readonly renderInspectorRegion?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element | null;
  readonly renderSupplementaryPanels?: () => JSX.Element | null;
  readonly interactionMessage?: string;
  readonly isEmpty?: boolean;
  readonly renderEmptyState?: () => JSX.Element;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

interface ConfigurableCanvasSurfaceDefinitionProps<TContext> {
  readonly definition: CanvasExperienceAssetDefinition<TContext>;
  readonly definitionContext: TContext;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

interface ResolvedCanvasModel {
  readonly identity: CanvasSurfaceIdentity;
  readonly graphSummary: CanvasSurfaceGraphSummary;
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
  readonly palette?: CanvasSurfacePaletteModel;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
  readonly toolbarActions: ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly editingModel?: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
  readonly renderGraphInteractionShell?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element;
  readonly renderPaletteRegion?: () => JSX.Element | null;
  readonly renderInspectorRegion?: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element | null;
  readonly renderSupplementaryPanels?: () => JSX.Element | null;
  readonly interactionMessage?: string;
  readonly isEmpty: boolean;
  readonly renderEmptyState?: () => JSX.Element | null;
  readonly leftDrawer?: CanvasDrawerState;
  readonly rightDrawer?: CanvasDrawerState;
}

export type ConfigurableCanvasSurfaceProps<TContext = never> =
  | ConfigurableCanvasSurfaceDirectProps
  | ConfigurableCanvasSurfaceDefinitionProps<TContext>;

function isDefinitionProps<TContext>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): props is ConfigurableCanvasSurfaceDefinitionProps<TContext> {
  return "definition" in props;
}

function clamp(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(min, value) : min;
}

function mapResizeFrame(
  node: CanvasSurfaceLayoutNodeModel,
  deltaX: number,
  deltaY: number,
  handle: "se" | "sw" | "ne" | "nw",
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const minWidth = node.minWidth ?? 140;
  const minHeight = node.minHeight ?? 90;

  if (handle === "se") {
    return {
      x: node.x,
      y: node.y,
      width: clamp(node.width + deltaX, minWidth),
      height: clamp(node.height + deltaY, minHeight),
    };
  }

  if (handle === "sw") {
    const width = clamp(node.width - deltaX, minWidth);
    return {
      x: node.x + (node.width - width),
      y: node.y,
      width,
      height: clamp(node.height + deltaY, minHeight),
    };
  }

  if (handle === "ne") {
    const height = clamp(node.height - deltaY, minHeight);
    return {
      x: node.x,
      y: node.y + (node.height - height),
      width: clamp(node.width + deltaX, minWidth),
      height,
    };
  }

  const width = clamp(node.width - deltaX, minWidth);
  const height = clamp(node.height - deltaY, minHeight);
  return {
    x: node.x + (node.width - width),
    y: node.y + (node.height - height),
    width,
    height,
  };
}

function ConfigurableCanvasEditingSurface({
  editingModel,
  onEditingEvent,
}: {
  readonly editingModel: CanvasSurfaceEditingModel;
  readonly onEditingEvent?: (event: CanvasSurfaceEditingEvent) => void;
}): JSX.Element {
  const [dragState, setDragState] = useState<{
    readonly mode: "move" | "resize";
    readonly nodeId: string;
    readonly startClientX: number;
    readonly startClientY: number;
    readonly resizeHandle?: "se" | "sw" | "ne" | "nw";
  } | undefined>(undefined);

  const nodesById = useMemo(
    () => new Map(editingModel.nodes.map((node) => [node.id, node] as const)),
    [editingModel.nodes],
  );

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragState) {
      return;
    }

    const node = nodesById.get(dragState.nodeId);
    if (!node) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (dragState.mode === "move") {
      onEditingEvent?.({
        type: "node.position.change",
        nodeId: node.id,
        position: Object.freeze({
          x: Math.round(node.x + deltaX),
          y: Math.round(node.y + deltaY),
        }),
      });
      return;
    }

    const frame = mapResizeFrame(node, deltaX, deltaY, dragState.resizeHandle ?? "se");
    onEditingEvent?.({
      type: "node.resize.change",
      nodeId: node.id,
      frame: Object.freeze({
        x: Math.round(frame.x),
        y: Math.round(frame.y),
        width: Math.round(frame.width),
        height: Math.round(frame.height),
      }),
    });
  };

  return (
    <div
      className="ui-configurable-canvas-editor ui-canvas-surface"
      data-testid="configurable-canvas-editing-surface"
      onDoubleClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onEditingEvent?.({
          type: "node.create.request",
          position: Object.freeze({
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
          }),
        });
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragState(undefined)}
      onPointerLeave={() => setDragState(undefined)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onEditingEvent?.({ type: "selection.change", nodeId: undefined });
        }
      }}
    >
      {editingModel.commands?.length ? (
        <div className="ui-configurable-canvas-editor__commands ui-row ui-row--wrap">
          {editingModel.commands.map((command) => (
            <button
              key={command.id}
              type="button"
              className={`ui-button ui-button--sm ${command.tone === "primary" ? "ui-button--primary" : command.tone === "ghost" ? "ui-button--ghost" : ""}`.trim()}
              disabled={command.disabled}
              onClick={() => onEditingEvent?.({ type: "canvas.command", commandId: command.id })}
            >
              {command.label}
            </button>
          ))}
        </div>
      ) : null}

      {editingModel.nodes.map((node) => {
        const selected = editingModel.selectedNodeId === node.id;
        return (
          <article
            key={node.id}
            className={[
              "ui-configurable-canvas-layout-node",
              "ui-card",
              "ui-card--padded",
              selected ? "ui-configurable-canvas-layout-node--selected" : "",
            ].filter(Boolean).join(" ")}
            style={{
              left: `${node.x}px`,
              top: `${node.y}px`,
              width: `${node.width}px`,
              height: `${node.height}px`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (node.selectable !== false) {
                onEditingEvent?.({ type: "selection.change", nodeId: node.id });
              }
            }}
            onPointerDown={(event) => {
              if (node.movable === false) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setDragState({
                mode: "move",
                nodeId: node.id,
                startClientX: event.clientX,
                startClientY: event.clientY,
              });
            }}
            data-testid={`configurable-canvas-layout-node-${node.id}`}
          >
            <div className="ui-stack ui-stack--3xs">
              <strong className="ui-text-small">{node.title}</strong>
              {node.subtitle ? <span className="ui-text-small ui-text-secondary">{node.subtitle}</span> : null}
            </div>

            {node.resizable !== false ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
              <button
                key={`${node.id}-${handle}`}
                type="button"
                className={`ui-configurable-canvas-layout-node__resize ui-configurable-canvas-layout-node__resize--${handle}`}
                aria-label={`Resize ${node.title}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragState({
                    mode: "resize",
                    nodeId: node.id,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    resizeHandle: handle,
                  });
                }}
              />
            )) : null}
          </article>
        );
      })}

      <div className="ui-configurable-canvas-editor__hint ui-text-small ui-text-secondary">
        {editingModel.createNodeDescription ?? "Double-click the canvas to add a new block."}
      </div>
    </div>
  );
}

export default function ConfigurableCanvasSurface<TContext = never>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): JSX.Element {
  const resolvedModel: ResolvedCanvasModel = isDefinitionProps(props)
    ? (() => {
      const focusedTarget = props.definition.resolveFocusedTarget?.(props.definitionContext);
      return {
        identity: props.definition.identity,
        graphSummary: props.definition.resolveGraphSummary(props.definitionContext),
        focusedTarget,
        palette: props.definition.resolvePalette?.(props.definitionContext),
        issues: props.definition.resolveIssues?.(props.definitionContext) ?? [],
        toolbarActions: props.definition.resolveToolbarActions?.(props.definitionContext) ?? [],
        editingModel: props.definition.resolveEditingModel?.(props.definitionContext),
        onEditingEvent: props.definition.onEditingEvent
          ? (event) => props.definition.onEditingEvent?.({
            context: props.definitionContext,
            event,
          })
          : undefined,
        renderGraphInteractionShell: props.definition.renderGraphInteractionShell
          ? () => props.definition.renderGraphInteractionShell?.({
            context: props.definitionContext,
            interaction: { focusedTarget },
          })
          : undefined,
        renderPaletteRegion: props.definition.renderPaletteRegion
          ? () => props.definition.renderPaletteRegion?.(props.definitionContext)
          : undefined,
        renderInspectorRegion: props.definition.renderInspectorRegion
          ? () => props.definition.renderInspectorRegion?.({
            context: props.definitionContext,
            inspector: { focusedTarget },
          })
          : undefined,
        renderSupplementaryPanels: props.definition.renderSupplementaryPanels
          ? () => props.definition.renderSupplementaryPanels?.(props.definitionContext)
          : undefined,
        interactionMessage: props.definition.resolveInteractionMessage?.(props.definitionContext),
        isEmpty: props.definition.emptyState?.when(props.definitionContext) ?? false,
        renderEmptyState: props.definition.emptyState
          ? () => props.definition.emptyState?.render(props.definitionContext) ?? null
          : undefined,
        leftDrawer: props.leftDrawer,
        rightDrawer: props.rightDrawer,
      };
    })()
    : {
      ...props,
      issues: props.issues ?? [],
      toolbarActions: props.toolbarActions ?? [],
      isEmpty: props.isEmpty ?? false,
      renderEmptyState: props.renderEmptyState,
    };

  const issueCount = resolvedModel.graphSummary.issueCount ?? resolvedModel.issues.length;
  const leftDrawerVisible = Boolean(resolvedModel.leftDrawer?.isEnabled && resolvedModel.leftDrawer?.isOpen);
  const rightDrawerVisible = Boolean(resolvedModel.rightDrawer?.isEnabled && resolvedModel.rightDrawer?.isOpen);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="configurable-canvas-surface">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-shell">
        <header className="ui-row ui-row--between ui-row--wrap">
          <div className="ui-stack ui-stack--3xs">
            <strong>{resolvedModel.identity.title}</strong>
            {resolvedModel.identity.summary ? <span className="ui-text-small ui-text-secondary">{resolvedModel.identity.summary}</span> : null}
          </div>
          <div className="ui-row ui-row--wrap ui-row--end">
            <span className={`ui-badge ${issueCount > 0 ? "ui-badge--warning" : "ui-badge--success"}`}>
              {issueCount > 0 ? `${issueCount} issue(s)` : "No issues"}
            </span>
            <span className="ui-badge ui-badge--neutral">Nodes: {resolvedModel.graphSummary.nodeCount}</span>
            <span className="ui-badge ui-badge--neutral">Edges: {resolvedModel.graphSummary.edgeCount}</span>
          </div>
        </header>

        {resolvedModel.toolbarActions.length > 0 ? (
          <div className="ui-row ui-row--wrap" data-testid="configurable-canvas-toolbar-actions">
            {resolvedModel.toolbarActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`ui-button ui-button--sm ${action.tone === "ghost" ? "ui-button--ghost" : action.tone === "primary" ? "ui-button--primary" : ""}`.trim()}
                disabled={action.disabled}
                onClick={() => action.run?.({ focusedTarget: resolvedModel.focusedTarget })}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {resolvedModel.isEmpty && resolvedModel.renderEmptyState ? resolvedModel.renderEmptyState() : null}

        {resolvedModel.issues.length > 0 ? (
          <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-issues">
            <summary className="ui-text-small">Validation and interaction issues ({resolvedModel.issues.length})</summary>
            <ul className="ui-stack ui-stack--2xs">
              {resolvedModel.issues.map((issue) => (
                <li key={issue.id} className="ui-text-small ui-text-secondary">{issue.message}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {resolvedModel.editingModel ? (
          <ConfigurableCanvasEditingSurface
            editingModel={resolvedModel.editingModel}
            onEditingEvent={resolvedModel.onEditingEvent}
          />
        ) : resolvedModel.renderGraphInteractionShell ? resolvedModel.renderGraphInteractionShell(resolvedModel.focusedTarget) : null}

        {resolvedModel.interactionMessage ? (
          <p className="ui-text-small ui-text-secondary" data-testid="configurable-canvas-interaction-message">
            {resolvedModel.interactionMessage}
          </p>
        ) : null}
      </section>

      {resolvedModel.palette && !leftDrawerVisible && resolvedModel.renderPaletteRegion ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-palette-inline">
          <strong>{resolvedModel.palette.title}</strong>
          {resolvedModel.palette.description ? <p className="ui-text-small ui-text-secondary">{resolvedModel.palette.description}</p> : null}
          {resolvedModel.renderPaletteRegion()}
        </section>
      ) : null}

      {resolvedModel.renderSupplementaryPanels ? resolvedModel.renderSupplementaryPanels() : null}

      {resolvedModel.rightDrawer && rightDrawerVisible && resolvedModel.renderInspectorRegion ? (
        <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-right-drawer">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>{resolvedModel.rightDrawer.label}</strong>
            {resolvedModel.rightDrawer.onClose ? (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={resolvedModel.rightDrawer.onClose}>Close</button>
            ) : null}
          </div>
          {resolvedModel.renderInspectorRegion(resolvedModel.focusedTarget)}
        </aside>
      ) : null}

      {resolvedModel.leftDrawer && leftDrawerVisible && resolvedModel.renderPaletteRegion ? (
        <aside className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-canvas-left-drawer">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>{resolvedModel.leftDrawer.label}</strong>
            {resolvedModel.leftDrawer.onClose ? (
              <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={resolvedModel.leftDrawer.onClose}>Close</button>
            ) : null}
          </div>
          {resolvedModel.renderPaletteRegion()}
        </aside>
      ) : null}
    </div>
  );
}
