import type { FormSection } from "../../../application/projection/models/FormSection";
import WorkflowFormField from "./WorkflowFormField";

export default function WorkflowFormSection({ section, onChange }: { readonly section: FormSection; readonly onChange: (id: string, value: unknown) => void }): JSX.Element {
  return <div className="ui-card"><div className="ui-card__body ui-stack"><h3>{section.title}</h3>{section.fields.map((field) => <WorkflowFormField key={field.id} field={field} onChange={onChange} />)}</div></div>;
}
