import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds, type TaxonomyBehaviorKind, type TaxonomySemanticRole, type TaxonomyStructuralKind } from "../../../domain/taxonomy/CompositionTaxonomy";

export interface RegistryFilterState {
  readonly structuralKinds: ReadonlyArray<TaxonomyStructuralKind>;
  readonly semanticRoles: ReadonlyArray<TaxonomySemanticRole>;
  readonly behaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
}

export interface AssetFilterPanelProps {
  readonly value: RegistryFilterState;
  readonly onChange: (next: RegistryFilterState) => void;
  readonly disabled?: boolean;
}

interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

const structuralKindOptions: ReadonlyArray<FilterOption<TaxonomyStructuralKind>> = Object.freeze([
  { value: TaxonomyStructuralKinds.atomic, label: "Atomic" },
  { value: TaxonomyStructuralKinds.composite, label: "Composite" },
  { value: TaxonomyStructuralKinds.system, label: "System" },
]);

const semanticRoleOptions: ReadonlyArray<FilterOption<TaxonomySemanticRole>> = Object.freeze([
  { value: TaxonomySemanticRoles.model, label: "Model" },
  { value: TaxonomySemanticRoles.dataset, label: "Dataset" },
  { value: TaxonomySemanticRoles.tool, label: "Tool" },
  { value: TaxonomySemanticRoles.promptTemplate, label: "Prompt Template" },
  { value: TaxonomySemanticRoles.embeddingIndex, label: "Embedding Index" },
  { value: TaxonomySemanticRoles.configProfile, label: "Config Profile" },
  { value: TaxonomySemanticRoles.workflow, label: "Workflow" },
  { value: TaxonomySemanticRoles.contextBundle, label: "Context Bundle" },
  { value: TaxonomySemanticRoles.datasetPipeline, label: "Dataset Pipeline" },
  { value: TaxonomySemanticRoles.trainingRecipe, label: "Training Recipe" },
  { value: TaxonomySemanticRoles.toolChain, label: "Tool Chain" },
  { value: TaxonomySemanticRoles.system, label: "System" },
]);

const behaviorKindOptions: ReadonlyArray<FilterOption<TaxonomyBehaviorKind>> = Object.freeze([
  { value: TaxonomyBehaviorKinds.none, label: "None" },
  { value: TaxonomyBehaviorKinds.deterministic, label: "Deterministic" },
  { value: TaxonomyBehaviorKinds.conditional, label: "Conditional" },
  { value: TaxonomyBehaviorKinds.iterative, label: "Iterative" },
  { value: TaxonomyBehaviorKinds.autonomous, label: "Autonomous" },
]);

function toggleValue<T extends string>(values: ReadonlyArray<T>, value: T): ReadonlyArray<T> {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  disabled,
  onToggle,
}: {
  readonly title: string;
  readonly options: ReadonlyArray<FilterOption<T>>;
  readonly selected: ReadonlyArray<T>;
  readonly disabled?: boolean;
  readonly onToggle: (value: T) => void;
}): JSX.Element {
  return (
    <fieldset className="ui-stack ui-stack--2xs" style={{ border: "none", margin: 0, padding: 0 }}>
      <legend className="ui-text-small" style={{ fontWeight: 600 }}>{title}</legend>
      {options.map((option) => (
        <label key={option.value} className="ui-row ui-row--wrap" style={{ alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
            disabled={disabled}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function AssetFilterPanel({ value, onChange, disabled }: AssetFilterPanelProps): JSX.Element {
  return (
    <div className="ui-stack ui-stack--sm" data-testid="registry-filter-panel">
      <FilterGroup
        title="Structural kind"
        options={structuralKindOptions}
        selected={value.structuralKinds}
        disabled={disabled}
        onToggle={(entry) => onChange({ ...value, structuralKinds: toggleValue(value.structuralKinds, entry) })}
      />

      <details>
        <summary>Advanced filters</summary>
        <div className="ui-stack ui-stack--sm" style={{ marginTop: "0.5rem" }}>
          <FilterGroup
            title="Semantic role"
            options={semanticRoleOptions}
            selected={value.semanticRoles}
            disabled={disabled}
            onToggle={(entry) => onChange({ ...value, semanticRoles: toggleValue(value.semanticRoles, entry) })}
          />
          <FilterGroup
            title="Behavior kind"
            options={behaviorKindOptions}
            selected={value.behaviorKinds}
            disabled={disabled}
            onToggle={(entry) => onChange({ ...value, behaviorKinds: toggleValue(value.behaviorKinds, entry) })}
          />
        </div>
      </details>
    </div>
  );
}
