import type { JSX } from "react";
import type { ExperiencePageId } from "../../../studio-shell/experience-assets/ExperiencePresentationVocabulary";
import type {
  WizardSurfacePageModel,
  WizardSurfaceProgressSummary,
  WizardSurfaceReadinessSummary,
  WizardSurfaceTerminalActionModel,
} from "../../../studio-shell/experience-assets/ConfigurableWizardSurfaceContracts";

export interface ConfigurableWizardSurfaceProps {
  readonly pages: ReadonlyArray<WizardSurfacePageModel>;
  readonly activePageId: ExperiencePageId;
  readonly onSelectPage?: (pageId: ExperiencePageId) => void;
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

export default function ConfigurableWizardSurface({
  pages,
  activePageId,
  onSelectPage,
  progress,
  readiness,
  renderPageHost,
  terminalActions = [],
  renderTerminalArea,
  pageNavigationTestIds,
}: ConfigurableWizardSurfaceProps): JSX.Element {
  const pageIds = pages.map((page) => page.id);
  const resolvedActivePageId = pageIds.includes(activePageId) ? activePageId : pageIds[0] ?? "";
  const activeIndex = pageIds.findIndex((pageId) => pageId === resolvedActivePageId);
  const previousPageId = activeIndex > 0 ? pageIds[activeIndex - 1] : undefined;
  const nextPageId = activeIndex >= 0 && activeIndex < pageIds.length - 1 ? pageIds[activeIndex + 1] : undefined;

  const selectPage = (pageId: ExperiencePageId): void => {
    onSelectPage?.(pageId);
  };

  return (
    <div className="ui-stack ui-stack--sm">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-wizard-pages-card">
        <nav className="ui-configurable-wizard__page-nav" aria-label="Authoring wizard pages">
          <div className="ui-configurable-wizard__page-nav-main">
            <div className="ui-configurable-wizard__page-buttons">
              {pages.map((page) => (
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
              Current focus: <strong>{progress.focusLabel}</strong>. Progress: {progress.readyCount ?? progress.completeCount}/{progress.totalCount} pages ready.
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
        <div>{renderPageHost(resolvedActivePageId)}</div>
      </section>

      {renderTerminalArea ? renderTerminalArea(resolvedActivePageId) : null}

      {terminalActions.length > 0 ? (
        <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="configurable-wizard-terminal-actions">
          <div className="ui-row ui-row--wrap ui-configurable-wizard__terminal-actions-row">
            {terminalActions.map((action) => (
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
          <strong>{readiness.title}</strong>
        </summary>
        <div className="ui-stack ui-stack--2xs ui-configurable-wizard__readiness-content">
          <p className="ui-text-muted">{readiness.description}</p>
          {readiness.issues.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs">
              {readiness.issues.map((issue) => (
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
