import type { WorkflowViewMode } from "../../state/WorkflowViewMode";

export interface WorkflowViewModeToggleProps {
  readonly mode: WorkflowViewMode;
  readonly onModeChange: (mode: WorkflowViewMode) => void;
}

export default function WorkflowViewModeToggle({ mode, onModeChange }: WorkflowViewModeToggleProps): JSX.Element {
  return (
    <div className="ui-row ui-row--sm">
      <button type="button" className={`ui-button ui-button--sm ${mode === "canvas" ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => onModeChange("canvas")}>Canvas</button>
      <button type="button" className={`ui-button ui-button--sm ${mode === "form" ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => onModeChange("form")}>Form</button>
    </div>
  );
}
