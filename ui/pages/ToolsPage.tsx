import { useEffect, useMemo, useState } from "react";
import ToolBrowser from "../components/tools/ToolBrowser";
import ToolSearchBar from "../components/tools/ToolSearchBar";
import { useUiDependencies } from "../composition/AppProviders";

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
      <ToolBrowser tools={state.tools} />
    </section>
  );
}
