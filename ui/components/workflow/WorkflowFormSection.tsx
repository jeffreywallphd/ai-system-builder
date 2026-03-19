import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { FormSection } from "../../../application/projection/models/FormSection";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function WorkflowFormSection({
  section,
  onChange,
  availableContextPackages,
}: {
  readonly section: FormSection;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
}): JSX.Element {
  return (
    <ProjectedSectionCard
      section={section}
      onChange={onChange}
      availableContextPackages={availableContextPackages}
    />
  );
}
