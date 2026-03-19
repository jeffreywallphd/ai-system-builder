import { useEffect, useMemo, useState } from "react";
import ToolBrowser from "../components/tools/ToolBrowser";
import ToolSearchBar from "../components/tools/ToolSearchBar";
import { useUiDependencies } from "../composition/AppProviders";

const capabilityKindLabels = Object.freeze({
  "tool-capability": "Capability",
  "mcp-server": "MCP Server",
  "mcp-resource": "MCP Resource",
} as const);

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
