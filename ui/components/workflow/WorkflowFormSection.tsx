import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { FormSection } from "../../../application/projection/models/FormSection";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function WorkflowFormSection({
  section,
  onChange,
  availableContextPackages,
  availableContextRecipes,
}: {
  readonly section: FormSection;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
}): JSX.Element {
  return (
    <ProjectedSectionCard
      section={section}
      onChange={onChange}
      availableContextPackages={availableContextPackages}
      availableContextRecipes={availableContextRecipes}
    />
  );
}
