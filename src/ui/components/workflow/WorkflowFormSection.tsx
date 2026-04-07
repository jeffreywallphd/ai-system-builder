import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { FormSection } from "../../../application/projection/models/FormSection";
import type { InstalledModelOption } from "../../models/buildInstalledModelOptions";
import ProjectedSectionCard from "../projection/ProjectedSectionCard";

export default function WorkflowFormSection({
  section,
  onChange,
  availableContextPackages,
  availableContextRecipes,
  availableModels,
}: {
  readonly section: FormSection;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
  readonly availableModels?: ReadonlyArray<InstalledModelOption>;
}): JSX.Element {
  return (
    <ProjectedSectionCard
      section={section}
      onChange={onChange}
      availableContextPackages={availableContextPackages}
      availableContextRecipes={availableContextRecipes}
      availableModels={availableModels}
    />
  );
}
