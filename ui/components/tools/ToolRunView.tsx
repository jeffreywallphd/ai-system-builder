import { useMemo, useState } from "react";
import type { ToolDefinition } from "../../../application/projection/models/ToolDefinition";
import type { ToolRunResult } from "../../../application/projection/models/ToolRunResult";
import ToolSectionView from "./ToolSectionView";

export default function ToolRunView({ tool, onRun, isRunning, result }: { readonly tool: ToolDefinition; readonly isRunning: boolean; readonly result?: ToolRunResult; readonly onRun: (values: Readonly<Record<string, unknown>>) => void }): JSX.Element {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const canRun = useMemo(() => !isRunning, [isRunning]);
  return <div className="ui-stack"><h2>{tool.title}</h2>{tool.sections.map((section) => <ToolSectionView key={section.id} section={section} onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))} />)}<button type="button" className="ui-button ui-button--primary" disabled={!canRun} onClick={() => onRun(values)}>Run</button>{result ? <div className="ui-card"><div className="ui-card__body">{result.status}: {result.messages.join(" | ")}</div></div> : null}</div>;
}
