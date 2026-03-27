export interface SearchBarProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly disabled?: boolean;
}

export function SearchBar({ value, onChange, disabled }: SearchBarProps): JSX.Element {
  return (
    <label className="ui-stack ui-stack--2xs" data-testid="registry-search-bar">
      <span className="ui-text-small">Search registry</span>
      <input
        type="search"
        value={value}
        placeholder="Search by name, taxonomy, contract, provenance…"
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
