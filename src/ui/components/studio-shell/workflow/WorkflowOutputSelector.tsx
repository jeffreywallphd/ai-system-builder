import type { WorkflowOutputTypeRegistryEntry } from "../../../../application/workflow-studio/WorkflowOutputTypeRegistry";

interface WorkflowOutputSelectorProps {
  readonly outputTypeDefinitions: ReadonlyArray<WorkflowOutputTypeRegistryEntry>;
  readonly disabled?: boolean;
  readonly onAddOutputs?: (destinationTypes: ReadonlyArray<string>) => void;
}

function buildSelectionSummary(count: number): string {
  if (count <= 0) {
    return "No output types available.";
  }
  if (count === 1) {
    return "1 output type available.";
  }
  return `${count} output types available.`;
}

export default function WorkflowOutputSelector({
  outputTypeDefinitions,
  disabled = false,
  onAddOutputs,
}: WorkflowOutputSelectorProps): JSX.Element {
  const supportedCount = outputTypeDefinitions.length;
  const hasDefinitions = outputTypeDefinitions.length > 0;
  const destinationTypes = outputTypeDefinitions.map((entry) => entry.destinationType);

  return (
    <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-output-selector">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>Add outputs</strong>
        <span className="ui-text-small ui-text-secondary" data-testid="workflow-output-selector-summary">
          {buildSelectionSummary(supportedCount)}
        </span>
      </div>

      {!hasDefinitions ? (
        <span className="ui-text-small ui-text-secondary">No output types are registered.</span>
      ) : (
        <div className="ui-stack ui-stack--2xs" data-testid="workflow-output-selector-list">
          {outputTypeDefinitions.map((definition) => {
            return (
              <label
                key={definition.destinationType}
                className="ui-card ui-card--padded ui-row ui-row--between ui-row--wrap workflow-output-selector-option"
                data-testid={`workflow-output-selector-option-${definition.destinationType}`}
              >
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-text-small"><strong>{definition.label}</strong></span>
                  <span className="ui-text-small ui-text-secondary">{definition.description}</span>
                </div>
                <div className="ui-row ui-row--wrap workflow-output-selector-actions">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    data-testid={`workflow-output-add-${definition.destinationType}`}
                    disabled={disabled || !onAddOutputs}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onAddOutputs?.([definition.destinationType]);
                    }}
                  >
                    Add
                  </button>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="ui-row ui-row--wrap workflow-output-selector-actions">
        <button
          type="button"
          className="ui-button ui-button--sm"
          data-testid="workflow-output-selector-add-all"
          disabled={disabled || !onAddOutputs || destinationTypes.length === 0}
          onClick={() => {
            if (!onAddOutputs || destinationTypes.length === 0) {
              return;
            }
            onAddOutputs(destinationTypes);
          }}
        >
          Add all supported outputs
        </button>
      </div>
    </div>
  );
}
