import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { ProjectedField } from "../../../application/projection/models/ProjectedField";
import NodePropertyField from "../nodes/NodePropertyField";
import type { NodePropertyFieldViewModel } from "../../presenters/NodePresenter";
import ContextPackageReferenceFieldEditor from "./ContextPackageReferenceFieldEditor";
import ContextRecipeSelectionFieldEditor from "./ContextRecipeSelectionFieldEditor";

function toNodePropertyField(field: ProjectedField): NodePropertyFieldViewModel {
  return Object.freeze({
    id: field.propertyId,
    name: field.label,
    type: field.type,
    value: field.value,
    defaultValue: field.defaultValue,
    description: field.description,
    isEditable: field.isEditable,
    isAdvanced: field.visibility === "advanced",
    isEmpty: field.value === undefined || field.value === null || field.value === "",
    min: field.min,
    max: field.max,
    step: field.step,
    shouldClampToRange: field.shouldClampToRange,
    visibility: field.visibility,
    options: field.options,
  });
}

export default function ProjectedFieldEditor({
  field,
  onChange,
  availableContextPackages,
  availableContextRecipes,
}: {
  readonly field: ProjectedField;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextPackages?: ReadonlyArray<IContextPackageSummary>;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
}): JSX.Element {
  if (field.presentation === "context-package-references") {
    return (
      <ContextPackageReferenceFieldEditor
        field={field}
        onChange={onChange}
        availableContextPackages={availableContextPackages}
      />
    );
  }

  if (field.presentation === "context-recipe-selections") {
    return (
      <ContextRecipeSelectionFieldEditor
        field={field}
        onChange={onChange}
        availableContextRecipes={availableContextRecipes}
      />
    );
  }

  return (
    <NodePropertyField
      field={toNodePropertyField(field)}
      onChange={(_, value) => onChange(field.id, value)}
    />
  );
}
