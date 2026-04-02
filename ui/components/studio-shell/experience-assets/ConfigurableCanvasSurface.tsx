import type { JSX } from "react";
import type {
  CanvasExperienceAssetDefinition,
  CanvasSurfaceFocusedTarget,
  CanvasSurfaceGraphSummary,
  CanvasSurfaceIdentity,
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
  readonly renderGraphInteractionShell: (focusedTarget?: CanvasSurfaceFocusedTarget) => JSX.Element;
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

export type ConfigurableCanvasSurfaceProps<TContext = never> =
  | ConfigurableCanvasSurfaceDirectProps
  | ConfigurableCanvasSurfaceDefinitionProps<TContext>;

function isDefinitionProps<TContext>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): props is ConfigurableCanvasSurfaceDefinitionProps<TContext> {
  return "definition" in props;
}

export default function ConfigurableCanvasSurface<TContext = never>(
  props: ConfigurableCanvasSurfaceProps<TContext>,
): JSX.Element {
  const resolvedModel = isDefinitionProps(props)
    ? (() => {
      const focusedTarget = props.definition.resolveFocusedTarget?.(props.definitionContext);
      return {
        identity: props.definition.identity,
        graphSummary: props.definition.resolveGraphSummary(props.definitionContext),
        focusedTarget,
        palette: props.definition.resolvePalette?.(props.definitionContext),
        issues: props.definition.resolveIssues?.(props.definitionContext) ?? [],
        toolbarActions: props.definition.resolveToolbarActions?.(props.definitionContext) ?? [],
        renderGraphInteractionShell: () => props.definition.renderGraphInteractionShell({
          context: props.definitionContext,
          interaction: { focusedTarget },
        }),
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

        {resolvedModel.renderGraphInteractionShell(resolvedModel.focusedTarget)}

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
