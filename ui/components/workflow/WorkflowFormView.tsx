import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { FormSchema } from "../../../application/projection/models/FormSchema";
import type { WorkflowOutputViewModel } from "../../presenters/WorkflowOutputPresenter";
import type { InstalledModelOption } from "../../models/buildInstalledModelOptions";
import WorkflowFormSection from "./WorkflowFormSection";
import WorkflowOutputViewer from "./WorkflowOutputViewer";

export default function WorkflowFormView({
  schema,
  output,
  onChange,
  availableContextPackages,
  availableContextRecipes,
  availableModels,
}: {
  readonly schema: FormSchema;
  readonly output: WorkflowOutputViewModel;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
  readonly availableModels?: ReadonlyArray<InstalledModelOption>;
}): JSX.Element {
  return (
    <div className="ui-stack ui-stack--md">
      {schema.sections.map((section) => (
        <WorkflowFormSection
          key={section.id}
          section={section}
          onChange={onChange}
          availableContextPackages={availableContextPackages}
          availableContextRecipes={availableContextRecipes}
          availableModels={availableModels}
        />
      ))}
      <WorkflowOutputViewer output={output} mode="form" />
    </div>
  );
}
