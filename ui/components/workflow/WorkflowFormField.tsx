import type { FormField } from "../../../application/projection/models/FormField";
import NodePropertyField from "../nodes/NodePropertyField";
import type { NodePropertyFieldViewModel } from "../../presenters/NodePresenter";

function toNodePropertyField(field: FormField): NodePropertyFieldViewModel {
  return Object.freeze({
    id: field.propertyId,
    name: field.label,
    type: field.type,
    value: field.value,
    description: field.description,
    isEditable: true,
    isAdvanced: field.visibility === "advanced",
    isEmpty: field.value === undefined || field.value === null || field.value === "",
    options: field.options,
  });
}

export default function WorkflowFormField({
  field,
  onChange,
}: {
  readonly field: FormField;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return (
    <NodePropertyField
      field={toNodePropertyField(field)}
      onChange={(_, value) => onChange(field.id, value)}
    />
  );
}
