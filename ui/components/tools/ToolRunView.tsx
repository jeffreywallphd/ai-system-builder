import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "../../../application/projection/models/ToolDefinition";
import type { ToolRunResult } from "../../../application/projection/models/ToolRunResult";
import ToolSectionView from "./ToolSectionView";
import type { InstalledModelOption } from "../../models/buildInstalledModelOptions";

function resolveFieldValue(
  fieldId: string,
  currentValue: unknown,
  values: Readonly<Record<string, unknown>>
): unknown {
  return Object.prototype.hasOwnProperty.call(values, fieldId)
    ? values[fieldId]
    : currentValue;
}

export default function ToolRunView({
  tool,
  onRun,
  isRunning,
  result,
  availableModels,
}: {
  readonly tool: ToolDefinition;
  readonly isRunning: boolean;
  readonly result?: ToolRunResult;
  readonly availableModels?: ReadonlyArray<InstalledModelOption>;
  readonly onRun: (values: Readonly<Record<string, unknown>>) => void;
}): JSX.Element {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setValues({});
  }, [tool.id]);

  const canRun = useMemo(() => !isRunning, [isRunning]);
  const sections = useMemo(
    () =>
      tool.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({
          ...field,
          value: resolveFieldValue(field.id, field.value, values),
        })),
      })),
    [tool.sections, values]
  );

  return (
    <div className="ui-stack ui-stack--md">
      <div className="ui-stack ui-stack--xs">
        <h2>{tool.title}</h2>
        {tool.description ? <p className="ui-text-secondary">{tool.description}</p> : null}
      </div>

      {sections.map((section) => (
        <ToolSectionView
          key={section.id}
          section={section}
          onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          availableModels={availableModels}
        />
      ))}

      <div className="ui-row ui-row--between ui-row--wrap">
        <p className="ui-text-secondary ui-text-small">
          Fill in the details above and start the tool when you&apos;re ready.
        </p>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={!canRun}
          onClick={() => onRun(values)}
        >
          {isRunning ? "Working…" : "Start tool"}
        </button>
      </div>

      {result ? (
        <div className="ui-card">
          <div className="ui-card__body">
            {result.status}: {result.messages.join(" | ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
