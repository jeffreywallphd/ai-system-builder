import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ToolBrowser from "../components/tools/ToolBrowser";
import ToolSearchBar from "../components/tools/ToolSearchBar";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";

const capabilityKindLabels = Object.freeze({
  "tool-capability": "Capability",
  "mcp-server": "MCP Server",
  "mcp-resource": "MCP Resource",
} as const);

const developerWorkflows = Object.freeze([
  Object.freeze({
    title: "Create search support",
    description:
      "Build a workflow that accepts focused queries, calls the right retrieval or MCP capabilities, and publishes a tool operators can search for from this page.",
    eyebrow: "Dev workflow",
    primaryLabel: "New workflow",
    primaryTo: `${ROUTE_PATHS.workflows}/new`,
    secondaryLabel: "Browse workflows",
    secondaryTo: ROUTE_PATHS.workflows,
  }),
  Object.freeze({
    title: "Create browse support",
    description:
      "Design a guided browsing workflow that lists options, exposes context-rich previews, and turns capability discovery into a reusable tool experience.",
    eyebrow: "Dev workflow",
    primaryLabel: "Open MCP setup",
    primaryTo: ROUTE_PATHS.mcp,
    secondaryLabel: "Review workflows",
    secondaryTo: ROUTE_PATHS.workflows,
  }),
]);

export default function ToolsPage(): JSX.Element {
  const { toolStore } = useUiDependencies();
  const [state, setState] = useState(toolStore.getState());

  useEffect(() => toolStore.subscribe(setState), [toolStore]);
  useEffect(() => {
    void toolStore.refreshTools();
  }, [toolStore]);

  const capabilitySummary = useMemo(() => {
    if (state.capabilities.length === 0) {
      return undefined;
    }

    const providerBreakdown = state.capabilities.reduce<Record<string, number>>((counts, capability) => {
      const key = capability.provider.kind;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});

    const segments = Object.entries(providerBreakdown).map(([providerKind, count]) => `${count} ${providerKind}`);
    return `${state.capabilities.length} callable capabilities indexed (${segments.join(", ")}).`;
  }, [state.capabilities]);

  return (
    <section className="ui-page">
      <h1 className="ui-page__title">Tools</h1>
      <p className="ui-page__subtitle">Open published tools and enter the details needed to get a result.</p>
      {capabilitySummary ? <p className="ui-muted">{capabilitySummary}</p> : null}
      <ToolSearchBar
        value={{ query: state.activeSearch?.query ?? "", typeId: state.activeSearch?.typeIds?.[0] }}
        typeOptions={state.availableTypes}
        isBusy={state.isLoading}
        onSearch={(value) =>
          void toolStore.refreshTools({
            query: value.query || undefined,
            typeIds: value.typeId ? [value.typeId] : undefined,
          })
        }
        onClear={() => void toolStore.refreshTools()}
      />
      <section className="ui-tools-dev-workflows ui-stack ui-stack--sm" aria-labelledby="tools-dev-workflows-title">
        <div className="ui-tools-dev-workflows__header">
          <div>
            <span className="ui-home__eyebrow">Developer workflows</span>
            <h2 id="tools-dev-workflows-title" className="ui-heading-4">
              Build search and browse support
            </h2>
          </div>
          <p className="ui-text-secondary">
            Use these dev workflow paths to add new operator-friendly search and browse experiences before publishing them back into the tool hub.
          </p>
        </div>

        <div className="ui-tools-dev-workflows__grid">
          {developerWorkflows.map((workflow) => (
            <article key={workflow.title} className="ui-tools-dev-workflow-card ui-card ui-glow-accent">
              <div className="ui-card__body ui-stack ui-stack--sm">
                <span className="ui-home__eyebrow">{workflow.eyebrow}</span>
                <div className="ui-stack ui-stack--xs">
                  <h3 className="ui-heading-4">{workflow.title}</h3>
                  <p className="ui-text-secondary">{workflow.description}</p>
                </div>
                <div className="ui-tools-dev-workflow-card__actions">
                  <Link className="ui-button ui-button--primary ui-button--sm" to={workflow.primaryTo}>
                    {workflow.primaryLabel}
                  </Link>
                  <Link className="ui-button ui-button--secondary ui-button--sm" to={workflow.secondaryTo}>
                    {workflow.secondaryLabel}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {state.capabilitySearchResult?.candidates.length ? (
        <div className="ui-card">
          <div className="ui-card__body ui-stack">
            <div>
              <strong>Capability search candidates</strong>
              <div className="ui-muted">
                Showing {state.capabilitySearchResult.candidates.length} of {state.capabilitySearchResult.totalCandidateCount} bounded matches.
              </div>
            </div>
            <ul className="ui-stack" aria-label="Capability search candidates">
              {state.capabilitySearchResult.candidates.map((candidate) => (
                <li key={candidate.id}>
                  <strong>{candidate.title}</strong> — {capabilityKindLabels[candidate.kind]}
                  {candidate.subtitle ? ` · ${candidate.subtitle}` : ""}
                  {candidate.description ? <div className="ui-muted">{candidate.description}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <ToolBrowser tools={state.tools} />
    </section>
  );
}
