import type { FormField } from "@application/projection/models/FormField";
import ProjectedFieldEditor from "../projection/ProjectedFieldEditor";

export default function WorkflowFormField({
  field,
  onChange,
}: {
  readonly field: FormField;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return <ProjectedFieldEditor field={field} onChange={onChange} />;
}

