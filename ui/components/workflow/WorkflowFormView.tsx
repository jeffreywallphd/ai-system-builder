import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { FormSchema } from "../../../application/projection/models/FormSchema";
import type { WorkflowOutputViewModel } from "../../presenters/WorkflowOutputPresenter";
import WorkflowFormSection from "./WorkflowFormSection";
import WorkflowOutputViewer from "./WorkflowOutputViewer";

export default function WorkflowFormView({
  schema,
  output,
  onChange,
  availableContextPackages,
  availableContextRecipes,
}: {
  readonly schema: FormSchema;
  readonly output: WorkflowOutputViewModel;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
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
        />
      ))}
      <WorkflowOutputViewer output={output} mode="form" />
    </div>
  );
}
