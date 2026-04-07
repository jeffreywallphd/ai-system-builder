import type { NodePropertyFieldViewModel } from "../../presenters/NodePresenter";
import { attachInstalledModelOptions, type InstalledModelOption } from "../../models/buildInstalledModelOptions";
import NodePropertyField from "./NodePropertyField";

export interface NodePropertyEditorProps {
  readonly fields: ReadonlyArray<NodePropertyFieldViewModel>;
  readonly disabled?: boolean;
  readonly availableModels?: ReadonlyArray<InstalledModelOption>;
  readonly onPropertyChange?: (propertyId: string, value: unknown) => void;
}

export default function NodePropertyEditor({
  fields,
  disabled,
  availableModels,
  onPropertyChange,
}: NodePropertyEditorProps): JSX.Element {
  const visibleFields = fields.filter((field) => field.visibility !== "hidden");

  if (visibleFields.length === 0) {
    return (
      <div className="ui-empty-state">
        <p className="ui-text-secondary">This node does not expose editable properties.</p>
      </div>
    );
  }

  const basicFields = visibleFields.filter((field) => !field.isAdvanced);
  const advancedFields = visibleFields.filter((field) => field.isAdvanced);

  return (
    <div className="ui-stack ui-stack--md">
      {basicFields.length > 0 ? (
        <div className="ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div className="ui-heading-4">Properties</div>
            <span className="ui-text-small ui-subtle">{basicFields.length} basic</span>
          </div>

          <div className="ui-stack ui-stack--sm">
            {basicFields.map((field) => (
              <NodePropertyField
                key={field.id}
                field={attachInstalledModelOptions(field, availableModels)}
                disabled={disabled}
                onChange={onPropertyChange}
              />
            ))}
          </div>
        </div>
      ) : null}

      {advancedFields.length > 0 ? (
        <div className="ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div className="ui-heading-4">Advanced</div>
            <span className="ui-text-small ui-subtle">{advancedFields.length} advanced</span>
          </div>

          <div className="ui-stack ui-stack--sm">
            {advancedFields.map((field) => (
              <NodePropertyField
                key={field.id}
                field={attachInstalledModelOptions(field, availableModels)}
                disabled={disabled}
                onChange={onPropertyChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
