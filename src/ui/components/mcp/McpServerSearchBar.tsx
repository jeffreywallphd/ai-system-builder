import { useMemo, useState } from "react";
import type { McpServerSearchCriteria } from "@application/mcp/models/McpServerSearchCriteria";

export interface McpServerSearchBarProps {
  readonly value?: Partial<McpServerSearchCriteria>;
  readonly isBusy?: boolean;
  readonly onSearch: (criteria: McpServerSearchCriteria) => void;
  readonly onClear?: () => void;
}

export default function McpServerSearchBar({
  value,
  isBusy,
  onSearch,
  onClear,
}: McpServerSearchBarProps): JSX.Element {
  const initialValue = useMemo(
    () => ({
      query: value?.query ?? "",
      transport: value?.transports?.[0] ?? "",
    }),
    [value],
  );
  const [form, setForm] = useState(initialValue);

  return (
    <form
      className="ui-stack ui-stack--sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({
          query: form.query.trim() || undefined,
          transports: form.transport ? [form.transport as "stdio" | "http" | "sse" | "inmemory"] : undefined,
        });
      }}
    >
      <div className="ui-row ui-row--wrap ui-mcp-search-bar">
        <label className="ui-field ui-stack ui-stack--2xs" htmlFor="mcp-search-query" style={{ flex: "2 1 280px" }}>
          <span className="ui-field__label">Discover MCP Servers</span>
          <input
            id="mcp-search-query"
            className="ui-input"
            type="text"
            value={form.query}
            placeholder="Search by server name, provider, or notes"
            disabled={isBusy}
            onChange={(event) => setForm((current) => ({ ...current, query: event.target.value }))}
          />
        </label>

        <label className="ui-field ui-stack ui-stack--2xs" htmlFor="mcp-search-transport" style={{ flex: "1 1 180px" }}>
          <span className="ui-field__label">Connection type</span>
          <select
            id="mcp-search-transport"
            className="ui-select"
            value={form.transport}
            disabled={isBusy}
            onChange={(event) => setForm((current) => ({ ...current, transport: event.target.value }))}
          >
            <option value="">Any</option>
            <option value="stdio">Local command</option>
            <option value="http">HTTP</option>
            <option value="sse">Server-sent events</option>
            <option value="inmemory">Built-in</option>
          </select>
        </label>

        <div className="ui-row ui-row--wrap" style={{ alignSelf: "end" }}>
          <button className={`ui-button ui-button--primary ui-button--md${isBusy ? " ui-button--loading" : ""}`} type="submit" disabled={isBusy}>
            <span className="ui-button__label">{isBusy ? <span className="ui-button__spinner" aria-hidden="true" /> : null}Search</span>
          </button>
          <button
            className="ui-button ui-button--secondary ui-button--md"
            type="button"
            disabled={isBusy}
            onClick={() => {
              setForm({ query: "", transport: "" });
              onClear?.();
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}

