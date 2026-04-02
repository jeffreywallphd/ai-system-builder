import type { JSX } from "react";

interface SummaryPanelProps {
  readonly title: string;
  readonly summary?: Readonly<Record<string, unknown>>;
  readonly emptyLabel?: string;
}

function renderValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  return JSON.stringify(value);
}

function SummaryPanel({ title, summary, emptyLabel = "No summary available." }: SummaryPanelProps): JSX.Element {
  const entries = summary ? Object.entries(summary).slice(0, 4) : [];
  if (entries.length === 0) {
    return <p className="ui-text-small ui-text-secondary">{emptyLabel}</p>;
  }

  return (
    <section className="ui-image-summary-panel">
      <h5 className="ui-image-summary-panel__title">{title}</h5>
      <dl className="ui-image-summary-panel__list">
        {entries.map(([key, value]) => (
          <div key={key} className="ui-image-summary-panel__row">
            <dt>{key}</dt>
            <dd>{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ParameterSummaryPanel({ summary }: { readonly summary?: Readonly<Record<string, unknown>> }): JSX.Element {
  return <SummaryPanel title="Parameters" summary={summary} emptyLabel="No parameters captured." />;
}

export function MetadataSummaryPanel({ summary }: { readonly summary?: Readonly<Record<string, unknown>> }): JSX.Element {
  return <SummaryPanel title="Metadata" summary={summary} emptyLabel="No metadata captured." />;
}
