import { useMemo, useState } from "react";

export interface ToolSearchBarValue {
  readonly query: string;
  readonly typeId?: string;
}

export interface ToolSearchBarProps {
  readonly value?: Partial<ToolSearchBarValue>;
  readonly typeOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly isBusy?: boolean;
  readonly onSearch: (value: ToolSearchBarValue) => void;
  readonly onClear: () => void;
}

export default function ToolSearchBar({
  value,
  typeOptions,
  isBusy,
  onSearch,
  onClear,
}: ToolSearchBarProps): JSX.Element {
  const initialValue = useMemo<ToolSearchBarValue>(
    () => ({ query: value?.query ?? "", typeId: value?.typeId }),
    [value]
  );
  const [form, setForm] = useState(initialValue);

  return (
    <form
      className="ui-stack ui-stack--sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ query: form.query.trim(), typeId: form.typeId || undefined });
      }}
    >
      <div className="ui-row ui-row--wrap">
        <div className="ui-field" style={{ minWidth: "220px", flex: "2 1 220px" }}>
          <label className="ui-field__label" htmlFor="tool-search-query">
            Search
          </label>
          <input
            id="tool-search-query"
            className="ui-input"
            value={form.query}
            placeholder="Search tools by name, description, or category"
            onChange={(event) => setForm((current) => ({ ...current, query: event.target.value }))}
            disabled={isBusy}
          />
        </div>

        <div className="ui-field" style={{ minWidth: "180px", flex: "1 1 180px" }}>
          <label className="ui-field__label" htmlFor="tool-search-type">
            Type
          </label>
          <select
            id="tool-search-type"
            className="ui-select"
            value={form.typeId ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                typeId: event.target.value || undefined,
              }))
            }
            disabled={isBusy}
          >
            <option value="">Any</option>
            {typeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-row ui-row--wrap" style={{ alignSelf: "end" }}>
          <button className="ui-button ui-button--primary ui-button--md" type="submit" disabled={isBusy}>
            Search
          </button>
          <button
            className="ui-button ui-button--secondary ui-button--md"
            type="button"
            onClick={() => {
              const cleared = { query: "", typeId: undefined };
              setForm(cleared);
              onClear();
            }}
            disabled={isBusy}
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
