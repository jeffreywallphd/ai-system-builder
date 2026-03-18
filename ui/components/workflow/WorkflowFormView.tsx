import type { FormSchema } from "../../../application/projection/models/FormSchema";
import type { WorkflowOutputViewModel } from "../../presenters/WorkflowOutputPresenter";
import WorkflowFormSection from "./WorkflowFormSection";
import WorkflowOutputViewer from "./WorkflowOutputViewer";

export default function WorkflowFormView({
  schema,
  output,
  onChange,
}: {
  readonly schema: FormSchema;
  readonly output: WorkflowOutputViewModel;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return (
    <div className="ui-stack ui-stack--md">
      {schema.sections.map((section) => (
        <WorkflowFormSection key={section.id} section={section} onChange={onChange} />
      ))}
      <WorkflowOutputViewer output={output} mode="form" />
    </div>
  );
}
