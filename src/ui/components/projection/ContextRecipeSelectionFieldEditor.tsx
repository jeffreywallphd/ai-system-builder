import { useEffect, useMemo, useState } from "react";
import type { IContextRecipeSummary } from "../../../application/ports/interfaces/IContextRecipeRepository";
import type { ProjectedField } from "../../../application/projection/models/ProjectedField";

interface ContextRecipeSelection {
  readonly recipeId: string;
  readonly alias?: string;
  readonly isEnabled?: boolean;
  readonly surfaceInTool?: boolean;
}

function toSelections(value: unknown): ReadonlyArray<ContextRecipeSelection> {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, ContextRecipeSelection>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const recipeId = typeof record.recipeId === "string" ? record.recipeId.trim() : "";
    if (!recipeId || deduped.has(recipeId)) {
      continue;
    }

    deduped.set(recipeId, {
      recipeId,
      alias: typeof record.alias === "string" ? record.alias.trim() || undefined : undefined,
      isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : true,
      surfaceInTool: typeof record.surfaceInTool === "boolean" ? record.surfaceInTool : true,
    });
  }

  return [...deduped.values()];
}

function moveSelection(
  selections: ReadonlyArray<ContextRecipeSelection>,
  index: number,
  direction: -1 | 1
): ReadonlyArray<ContextRecipeSelection> {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= selections.length) {
    return selections;
  }

  const next = [...selections];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function resolveRecipeOptionLabel(contextRecipe: IContextRecipeSummary): string {
  return contextRecipe.version
    ? `${contextRecipe.name} (${contextRecipe.id} · ${contextRecipe.version})`
    : `${contextRecipe.name} (${contextRecipe.id})`;
}

function recipeSummaryText(contextRecipe?: IContextRecipeSummary): string {
  if (!contextRecipe) {
    return "Summary unavailable for this recipe.";
  }

  return contextRecipe.description ?? `Uses ${contextRecipe.packageReferenceCount} referenced context package(s).`;
}

export default function ContextRecipeSelectionFieldEditor({
  field,
  onChange,
  availableContextRecipes,
}: {
  readonly field: ProjectedField;
  readonly onChange: (id: string, value: unknown) => void;
  readonly availableContextRecipes?: ReadonlyArray<IContextRecipeSummary>;
}): JSX.Element {
  const selections = toSelections(field.value);
  const recipeSummaries = availableContextRecipes ?? [];
  const availableRecipeOptions = useMemo(
    () =>
      recipeSummaries
        .map((contextRecipe) => ({
          label: resolveRecipeOptionLabel(contextRecipe),
          value: contextRecipe.id,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [recipeSummaries]
  );
  const unboundRecipeOptions = useMemo(
    () => availableRecipeOptions.filter((option) => !selections.some((selection) => selection.recipeId === option.value)),
    [availableRecipeOptions, selections]
  );
  const [newRecipeId, setNewRecipeId] = useState(unboundRecipeOptions[0]?.value ?? "");

  useEffect(() => {
    setNewRecipeId((current) => {
      if (current && unboundRecipeOptions.some((option) => option.value === current)) {
        return current;
      }

      return unboundRecipeOptions[0]?.value ?? "";
    });
  }, [unboundRecipeOptions]);

  const updateSelections = (nextValue: ReadonlyArray<ContextRecipeSelection>): void => {
    onChange(field.id, nextValue);
  };

  const updateSelection = (index: number, patch: Partial<ContextRecipeSelection>): void => {
    updateSelections(
      selections.map((selection, currentIndex) =>
        currentIndex === index
          ? {
              ...selection,
              ...patch,
              recipeId: patch.recipeId?.trim() || selection.recipeId,
            }
          : selection
      )
    );
  };

  const removeSelection = (index: number): void => {
    updateSelections(selections.filter((_selection, currentIndex) => currentIndex !== index));
  };

  const addSelection = (): void => {
    if (!newRecipeId) {
      return;
    }

    const summary = recipeSummaries.find((recipe) => recipe.id === newRecipeId);
    updateSelections([
      ...selections,
      {
        recipeId: newRecipeId,
        alias: summary?.name,
        isEnabled: true,
        surfaceInTool: true,
      },
    ]);
  };

  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <label className="ui-field__label">{field.label}</label>
          {field.description ? <div className="ui-field__hint">{field.description}</div> : null}
        </div>

        {selections.length === 0 ? <div className="ui-subtle">No context recipes assigned yet.</div> : null}

        {selections.map((selection, index) => {
          const summary = recipeSummaries.find((recipe) => recipe.id === selection.recipeId);
          const recipeOptions = availableRecipeOptions.filter(
            (option) => option.value === selection.recipeId || !selections.some((entry) => entry.recipeId === option.value)
          );

          return (
            <div key={`${field.id}-${selection.recipeId}`} className="ui-card ui-subtle">
              <div className="ui-card__body ui-stack ui-stack--xs">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <strong>Recipe {index + 1}</strong>
                  <div className="ui-row ui-row--wrap">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={index === 0}
                      onClick={() => updateSelections(moveSelection(selections, index, -1))}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={index === selections.length - 1}
                      onClick={() => updateSelections(moveSelection(selections, index, 1))}
                    >
                      Move down
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => removeSelection(index)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Recipe</label>
                  {recipeOptions.length > 0 ? (
                    <select
                      className="ui-select"
                      value={selection.recipeId}
                      onChange={(event) => updateSelection(index, { recipeId: event.target.value })}
                    >
                      {recipeOptions.map((option) => (
                        <option key={`${field.id}-${selection.recipeId}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="ui-input"
                      type="text"
                      value={selection.recipeId}
                      onChange={(event) => updateSelection(index, { recipeId: event.target.value })}
                    />
                  )}
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Recipe summary</label>
                  <div className="ui-subtle ui-text-small">{recipeSummaryText(summary)}</div>
                </div>

                <div className="ui-field">
                  <label className="ui-field__label">Display name</label>
                  <input
                    className="ui-input"
                    type="text"
                    value={selection.alias ?? ""}
                    onChange={(event) => updateSelection(index, { alias: event.target.value || undefined })}
                  />
                </div>

                <label className="ui-row ui-row--wrap">
                  <input
                    className="ui-checkbox"
                    type="checkbox"
                    checked={selection.isEnabled !== false}
                    onChange={(event) => updateSelection(index, { isEnabled: event.target.checked })}
                  />
                  <span className="ui-text-body">Enabled by default</span>
                </label>

                <label className="ui-row ui-row--wrap">
                  <input
                    className="ui-checkbox"
                    type="checkbox"
                    checked={selection.surfaceInTool !== false}
                    onChange={(event) => updateSelection(index, { surfaceInTool: event.target.checked })}
                  />
                  <span className="ui-text-body">Show as a non-technical preset in Tools UI</span>
                </label>
              </div>
            </div>
          );
        })}

        <div className="ui-stack ui-stack--xs">
          <div className="ui-field">
            <label className="ui-field__label">Attach context recipe</label>
            {unboundRecipeOptions.length > 0 ? (
              <select
                className="ui-select"
                value={newRecipeId}
                onChange={(event) => setNewRecipeId(event.target.value)}
              >
                {unboundRecipeOptions.map((option) => (
                  <option key={`${field.id}-new-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="ui-input"
                type="text"
                placeholder="No more saved recipes available"
                value=""
                disabled
                readOnly
              />
            )}
          </div>

          <div>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={addSelection}
              disabled={!newRecipeId}
            >
              Add context recipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
