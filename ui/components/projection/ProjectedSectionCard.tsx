import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { ProjectedSection } from "../../../application/projection/models/ProjectedSection";
import ProjectedFieldEditor from "./ProjectedFieldEditor";

export default function ProjectedSectionCard({
  section,
  onChange,
  availableContextPackages,
  availableContextRecipes,
}: {
  readonly section: ProjectedSection;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
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
            <ProjectedFieldEditor
              key={field.id}
              field={field}
              onChange={onChange}
              availableContextPackages={availableContextPackages}
              availableContextRecipes={availableContextRecipes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
