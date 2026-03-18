import type { FormSection } from "../../../application/projection/models/FormSection";
import WorkflowFormField from "./WorkflowFormField";

export default function WorkflowFormSection({
  section,
  onChange,
}: {
  readonly section: FormSection;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <h3 className="ui-heading-3">{section.title}</h3>
          {section.description ? (
            <p className="ui-text-secondary ui-text-small">{section.description}</p>
          ) : null}
        </div>

        <div className="ui-stack ui-stack--sm">
          {section.fields.map((field) => (
            <WorkflowFormField key={field.id} field={field} onChange={onChange} />
          ))}
        </div>
      </div>
    </div>
  );
}
