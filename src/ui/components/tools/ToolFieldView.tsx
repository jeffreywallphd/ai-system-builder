import type { ToolField } from "../../../application/projection/models/ToolField";
import ProjectedFieldEditor from "../projection/ProjectedFieldEditor";

export default function ToolFieldView({
  field,
  onChange,
}: {
  readonly field: ToolField;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return <ProjectedFieldEditor field={field} onChange={onChange} />;
}
