import type { FormField } from "../../../application/projection/models/FormField";

export default function WorkflowFormField({ field, onChange }: { readonly field: FormField; readonly onChange: (id: string, value: unknown) => void }): JSX.Element {
  return (
    <label className="ui-stack ui-stack--2xs">
      <span className="ui-field__label">{field.label}</span>
      <input className="ui-input" value={String(field.value ?? "")} onChange={(event) => onChange(field.id, event.target.value)} />
    </label>
  );
}
