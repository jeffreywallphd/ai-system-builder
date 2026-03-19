import type { FormSection } from "../../../application/projection/models/FormSection";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function WorkflowFormSection({
  section,
  onChange,
}: {
  readonly section: FormSection;
  readonly onChange: (id: string, value: unknown) => void;
}): JSX.Element {
  return <ProjectedSectionCard section={section} onChange={onChange} />;
}
