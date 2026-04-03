import type { JSX } from "react";
import type { ExperiencePageId } from "../../../studio-shell/experience-assets/ExperiencePresentationVocabulary";
import type {
  WizardExperienceAssetDefinition,
  WizardSurfacePageModel,
  WizardSurfaceProgressSummary,
  WizardSurfaceReadinessSummary,
  WizardSurfaceTerminalActionModel,
} from "../../../studio-shell/experience-assets/ConfigurableWizardSurfaceContracts";

interface ConfigurableWizardSurfaceDirectProps {
  readonly pages: ReadonlyArray<WizardSurfacePageModel>;
  readonly activePageId: ExperiencePageId;
  readonly currentPageId?: ExperiencePageId;
  readonly onSelectPage?: (pageId: ExperiencePageId) => void;
  readonly onPageChange?: (pageId: ExperiencePageId) => void;
  readonly progress: WizardSurfaceProgressSummary;
  readonly readiness: WizardSurfaceReadinessSummary;
  readonly renderPageHost: (pageId: ExperiencePageId) => JSX.Element;
  readonly terminalActions?: ReadonlyArray<WizardSurfaceTerminalActionModel>;
  readonly renderTerminalArea?: (activePageId: ExperiencePageId) => JSX.Element | null;
  readonly pageNavigationTestIds?: {
    readonly back?: string;
    readonly next?: string;
  };
}

interface ConfigurableWizardSurfaceDefinitionProps<TContext> {
  readonly definition: WizardExperienceAssetDefinition<TContext>;
  readonly definitionContext: TContext;
  readonly activePageId: ExperiencePageId;
  readonly currentPageId?: ExperiencePageId;
  readonly onSelectPage?: (pageId: ExperiencePageId) => void;
  readonly onPageChange?: (pageId: ExperiencePageId) => void;
  readonly pageNavigationTestIds?: {
    readonly back?: string;
    readonly next?: string;
  };
}

export type ConfigurableWizardSurfaceProps<TContext = never> =
  | ConfigurableWizardSurfaceDirectProps
  | ConfigurableWizardSurfaceDefinitionProps<TContext>;

function isDefinitionProps<TContext>(
  props: ConfigurableWizardSurfaceProps<TContext>,
): props is ConfigurableWizardSurfaceDefinitionProps<TContext> {
  return "definition" in props;
}

export default function ConfigurableWizardSurface<TContext = never>(
  props: ConfigurableWizardSurfaceProps<TContext>,
): JSX.Element {
  const activePageId = props.currentPageId ?? props.activePageId;
  const onSelectPage = props.onPageChange ?? props.onSelectPage;
  const pageNavigationTestIds = props.pageNavigationTestIds;

  const resolvedModel = isDefinitionProps(props)
    ? (() => {
      const pages = props.definition.pages.map((page) => ({
        id: page.id,
        title: page.title,
        status: page.resolveStatus?.(props.definitionContext) ?? page.status,
      }));
      const progress = props.definition.resolveProgress({
        context: props.definitionContext,
        activePageId,
      });
      const readiness = props.definition.resolveReadiness(props.definitionContext);

      return {
        pages,
        progress,
        readiness,
        renderPageHost: (pageId: ExperiencePageId) => {
          const page = props.definition.pages.find((candidate) => candidate.id === pageId);
          return page ? page.render(props.definitionContext) : <div className="ui-text-muted">Page is not available.</div>;
        },
        terminalActions: (props.definition.terminalActions ?? []).map((action) => ({
          ...action,
          run: action.run
            ? ({ activePageId: actionPageId }: { readonly activePageId: ExperiencePageId }) => action.run?.({
              activePageId: actionPageId,
              context: props.definitionContext,
            })
            : undefined,
        })),
        renderTerminalArea: props.definition.renderTerminalArea
          ? (pageId: ExperiencePageId) => props.definition.renderTerminalArea?.({
            context: props.definitionContext,
            activePageId: pageId,
          })
          : undefined,
        sequentialNavigation: props.definition.navigationPolicy?.sequentialNavigation ?? "enabled",
      };
    })()
    : {
      pages: props.pages,
      progress: props.progress,
      readiness: props.readiness,
      renderPageHost: props.renderPageHost,
      terminalActions: props.terminalActions ?? [],
      renderTerminalArea: props.renderTerminalArea,
      sequentialNavigation: "enabled" as const,
    };

  const pageIds = resolvedModel.pages.map((page) => page.id);
  const resolvedActivePageId = pageIds.includes(activePageId) ? activePageId : pageIds[0] ?? "";
  const activeIndex = pageIds.findIndex((pageId) => pageId === resolvedActivePageId);
  const previousPageId = resolvedModel.sequentialNavigation === "enabled" && activeIndex > 0 ? pageIds[activeIndex - 1] : undefined;
  const nextPageId = resolvedModel.sequentialNavigation === "enabled" && activeIndex >= 0 && activeIndex < pageIds.length - 1
    ? pageIds[activeIndex + 1]
    : undefined;

  const selectPage = (pageId: ExperiencePageId): void => {
    onSelectPage?.(pageId);
  };

  return (
    <div className="ui-stack ui-stack--sm">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-wizard-pages-card">
        <nav className="ui-configurable-wizard__page-nav" aria-label="Authoring wizard pages">
          <div className="ui-configurable-wizard__page-nav-main">
            <div className="ui-configurable-wizard__page-buttons">
              {resolvedModel.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`ui-button ui-button--sm ${page.id === resolvedActivePageId ? "ui-button--primary" : "ui-button--ghost"}`}
                  aria-current={page.id === resolvedActivePageId ? "page" : undefined}
                  onClick={() => selectPage(page.id)}
                >
                  {page.title}
                </button>
              ))}
            </div>
            <p className="ui-text-muted ui-configurable-wizard__page-progress" data-testid="configurable-wizard-page-progress">
              Current focus: <strong>{resolvedModel.progress.focusLabel}</strong>. Progress: {resolvedModel.progress.readyCount ?? resolvedModel.progress.completeCount}/{resolvedModel.progress.totalCount} pages ready.
            </p>
          </div>
          <div className="ui-configurable-wizard__navigation-actions ui-configurable-wizard__navigation-actions--rail">
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              data-testid={pageNavigationTestIds?.back}
              disabled={!previousPageId}
              onClick={() => previousPageId && selectPage(previousPageId)}
            >
              Back
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              data-testid={pageNavigationTestIds?.next}
              disabled={!nextPageId}
              onClick={() => nextPageId && selectPage(nextPageId)}
            >
              Next
            </button>
          </div>
        </nav>
        <div>{resolvedModel.renderPageHost(resolvedActivePageId)}</div>
      </section>

      {resolvedModel.renderTerminalArea ? resolvedModel.renderTerminalArea(resolvedActivePageId) : null}

      {resolvedModel.terminalActions.length > 0 ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-wizard-terminal-actions">
          <div className="ui-row ui-row--wrap ui-configurable-wizard__terminal-actions-row">
            {resolvedModel.terminalActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`ui-button ui-button--sm ${action.tone === "ghost" ? "ui-button--ghost" : action.tone === "primary" ? "ui-button--primary" : ""}`.trim()}
                disabled={action.disabled}
                onClick={() => action.run?.({ activePageId: resolvedActivePageId })}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <details className="ui-card ui-card--padded ui-configurable-wizard__readiness" data-testid="configurable-wizard-readiness-summary">
        <summary className="ui-configurable-wizard__readiness-summary">
          <strong>{resolvedModel.readiness.title}</strong>
        </summary>
        <div className="ui-stack ui-stack--2xs ui-configurable-wizard__readiness-content">
          <p className="ui-text-muted">{resolvedModel.readiness.description}</p>
          {resolvedModel.readiness.issues.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs">
              {resolvedModel.readiness.issues.map((issue) => (
                <li key={issue.id}>
                  {issue.pageId ? (
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      onClick={() => selectPage(issue.pageId!)}
                    >
                      {issue.message}
                    </button>
                  ) : (
                    <span className="ui-text-muted">{issue.message}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-text-muted">No blocking issues detected.</p>
          )}
        </div>
      </details>
    </div>
  );
}
