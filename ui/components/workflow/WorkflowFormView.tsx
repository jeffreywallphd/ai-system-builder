import type { FormSchema } from "../../../application/projection/models/FormSchema";
import WorkflowFormSection from "./WorkflowFormSection";

export default function WorkflowFormView({ schema, onChange }: { readonly schema: FormSchema; readonly onChange: (id: string, value: unknown) => void }): JSX.Element {
  return <div className="ui-stack">{schema.sections.map((section) => <WorkflowFormSection key={section.id} section={section} onChange={onChange} />)}</div>;
}
