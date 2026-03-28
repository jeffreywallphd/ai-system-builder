import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ExecutionRunProjection } from "../../application/execution/ExecutionRunProjectionService";
import ExecutionHistoryPanel from "../components/execution/ExecutionHistoryPanel";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { RunInterfaceService } from "../routes/RunInterface";

export default function RunPage(): JSX.Element {
  const location = useLocation();
  const { executionHistoryService } = useUiDependencies();
  const service = useMemo(() => new RunInterfaceService(), []);
  const presentation = useMemo(() => service.resolvePresentation(location.search), [location.search, service]);
  const [history, setHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);

  useEffect(() => {
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
  }, [executionHistoryService]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="run-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{presentation.shellTitle}</h1>
          <p className="ui-page__subtitle">{presentation.shellSubtitle}</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2 style={{ margin: 0 }}>{presentation.surface.title}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>{presentation.surface.subtitle}</p>
          <span className="ui-badge">Context: {presentation.surface.contextLabel}</span>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
            <Link className="ui-button ui-button--primary ui-button--sm" to={presentation.surface.primaryActionPath}>
              {presentation.surface.primaryActionLabel}
            </Link>
            <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.systemStudio}>Open system runner</Link>
          </div>
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
