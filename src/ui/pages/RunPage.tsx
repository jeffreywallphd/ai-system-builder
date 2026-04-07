import { useEffect, useMemo, useState } from "react";
import ContextualRecommendationsPanel from "../components/navigation/ContextualRecommendationsPanel";
import RecentAndFavoritesPanel from "../components/navigation/RecentAndFavoritesPanel";
import { ContextualRecommendationService, ContextualRecommendationSurfaces } from "../routes/ContextualRecommendations";
import { RecentAndFavoritesService } from "../routes/RecentAndFavorites";
import { Link, useLocation } from "react-router-dom";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import ExecutionHistoryPanel from "../components/execution/ExecutionHistoryPanel";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { RunContextKinds, RunInterfaceService } from "../routes/RunInterface";
import { PersistedWorkflowEntryService, type PersistedWorkflowEntry } from "../routes/PersistedWorkflowEntryService";

export default function RunPage(): JSX.Element {
  const location = useLocation();
  const { executionHistoryService } = useUiDependencies();
  const service = useMemo(() => new RunInterfaceService(), []);
  const persistedWorkflowEntryService = useMemo(() => new PersistedWorkflowEntryService(), []);
  const recommendationService = useMemo(() => new ContextualRecommendationService(), []);
  const recentAndFavoritesService = useMemo(() => new RecentAndFavoritesService(), []);
  const presentation = useMemo(() => service.resolvePresentation(location.search), [location.search, service]);
  const recommendations = recommendationService.resolve({
    surface: ContextualRecommendationSurfaces.run,
    runContextKind: presentation.request.contextKind,
    runOriginPath: presentation.request.originPath,
    assetActionContext: presentation.request.assetId
      ? {
          source: "detail",
          asset: {
            assetId: presentation.request.assetId,
            versionId: presentation.request.versionId,
            taxonomy: undefined,
          },
        }
      : undefined,
  });
  const recents = recentAndFavoritesService.listRecents(4);
  const favorites = recentAndFavoritesService.listFavorites();
  const [history, setHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);
  const [persistedWorkflows, setPersistedWorkflows] = useState<ReadonlyArray<PersistedWorkflowEntry>>([]);
  const [isPersistedWorkflowsLoading, setIsPersistedWorkflowsLoading] = useState(true);
  const [persistedWorkflowsError, setPersistedWorkflowsError] = useState<string | undefined>();

  useEffect(() => {
    recentAndFavoritesService.recordRecentRunContext({ request: presentation.request, launchPath: presentation.launchPath });
    let active = true;
    void executionHistoryService
      .listHistory({ limit: 10 })
      .then((runs) => {
        if (active) {
          setHistory(runs);
        }
      })
      .catch(() => {
        if (active) {
          setHistory([]);
        }
      });
    return () => {
      active = false;
    };
  }, [executionHistoryService, presentation.launchPath, presentation.request, recentAndFavoritesService]);

  useEffect(() => {
    let active = true;
    setIsPersistedWorkflowsLoading(true);
    void persistedWorkflowEntryService.listEntries(6).then((response) => {
      if (!active) {
        return;
      }
      if (!response.ok || !response.data) {
        setPersistedWorkflows([]);
        setPersistedWorkflowsError(response.error ?? "Failed to load persisted workflows.");
        setIsPersistedWorkflowsLoading(false);
        return;
      }
      setPersistedWorkflows(response.data);
      setPersistedWorkflowsError(undefined);
      setIsPersistedWorkflowsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [persistedWorkflowEntryService]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="run-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{presentation.shellTitle}</h1>
          <p className="ui-page__subtitle">{presentation.shellSubtitle}</p>
        </div>
      </div>

      <ContextualRecommendationsPanel recommendations={recommendations} />
      <RecentAndFavoritesPanel service={recentAndFavoritesService} recents={recents} favorites={favorites} />

      {presentation.request.contextKind === RunContextKinds.workflow && !presentation.request.workflowId ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <p role="alert">Run workflow context requires a valid workflow id. Select a saved workflow below.</p>
          </div>
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2 style={{ margin: 0 }}>{presentation.surface.title}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>{presentation.surface.subtitle}</p>
          <span className="ui-badge">Context: {presentation.surface.contextLabel}</span>
          {presentation.request.originPath ? (
            <span className="ui-text-small ui-text-secondary">Origin: {presentation.request.originLabel ?? presentation.request.originPath}</span>
          ) : null}
          <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
            <Link className="ui-button ui-button--primary ui-button--sm" to={presentation.surface.primaryActionPath}>
              {presentation.surface.primaryActionLabel}
            </Link>
            <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.systemStudio}>Open system runner</Link>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2>Run a saved workflow</h2>
          <p className="ui-text-secondary">Select a persisted workflow from Run and continue in Workflow Studio.</p>
          {isPersistedWorkflowsLoading ? <p className="ui-text-secondary">Loading saved workflows...</p> : null}
          {!isPersistedWorkflowsLoading && persistedWorkflowsError ? <p role="alert">{persistedWorkflowsError}</p> : null}
          {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length === 0 ? (
            <p className="ui-text-secondary">No persisted workflows are available yet.</p>
          ) : null}
          {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length > 0 ? (
            <div className="ui-stack ui-stack--xs" data-testid="run-persisted-workflow-list">
              {persistedWorkflows.map((workflow) => (
                <article key={workflow.workflowId} className="ui-card ui-card--interactive">
                  <div className="ui-card__body ui-stack ui-stack--2xs">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong>{workflow.displayName}</strong>
                      <span className="ui-badge ui-badge--neutral">{workflow.status}</span>
                    </div>
                    <p className="ui-text-small ui-text-secondary">{workflow.workflowId}</p>
                    {workflow.summary ? <p className="ui-text-small ui-text-secondary">{workflow.summary}</p> : null}
                    <div className="ui-row ui-row--wrap">
                      <Link className="ui-button ui-button--primary ui-button--small" to={persistedWorkflowEntryService.buildRunWorkflowPath(workflow)}>
                        Run workflow
                      </Link>
                      <Link className="ui-button ui-button--ghost ui-button--small" to={persistedWorkflowEntryService.buildWorkflowStudioOpenPath(workflow)}>
                        Open in Workflow Studio
                      </Link>
                      <Link className="ui-button ui-button--ghost ui-button--small" to={persistedWorkflowEntryService.buildWorkflowRunHistoryPath(workflow)}>
                        View run history
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ExecutionHistoryPanel
        title="Recent run activity"
        subtitle="Execution status and results are preserved in one shared run history surface."
        items={history}
        emptyMessage="No execution runs are available yet. Launch a run to populate history."
        executionHistoryService={executionHistoryService}
      />
    </section>
  );
}

