import type { IModel } from "../../domain/models/interfaces/IModel";
import type { NodePropertyFieldViewModel } from "../presenters/NodePresenter";
import { formatBytes } from "../presenters/PresenterFormatting";

export interface InstalledModelOption {
  readonly label: string;
  readonly value: string;
  readonly tasks: ReadonlyArray<string>;
  readonly inputModalities: ReadonlyArray<string>;
  readonly outputModalities: ReadonlyArray<string>;
}

export function buildInstalledModelOptions(
  installedModels: ReadonlyArray<IModel>
): ReadonlyArray<InstalledModelOption> {
  return Object.freeze(
    [...installedModels]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((model) => {
        const details = [model.publisher, model.architectureFamily, formatBytes(model.artifact.sizeBytes)]
          .filter(Boolean)
          .join(" · ");

        return Object.freeze({
          value: model.id,
          label: details ? `${model.name} (${details})` : model.name,
          tasks: Object.freeze([...model.compatibility.supportedTasks]),
          inputModalities: Object.freeze([...model.compatibility.inputModalities]),
          outputModalities: Object.freeze([...model.compatibility.outputModalities]),
        });
      })
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesAny(
  expected: ReadonlyArray<string> | undefined,
  available: ReadonlyArray<string>,
): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  const availableSet = new Set(available.map(normalize));
  return expected.map(normalize).some((value) => availableSet.has(value));
}

function filterInstalledModelOptions(
  installedModelOptions: ReadonlyArray<InstalledModelOption>,
  selection: NodePropertyFieldViewModel["modelSelection"],
): ReadonlyArray<InstalledModelOption> {
  if (!selection) {
    return installedModelOptions;
  }

  return Object.freeze(
    installedModelOptions.filter((option) =>
      matchesAny(selection.tasks, option.tasks)
        && matchesAny(selection.inputModalities, option.inputModalities)
        && matchesAny(selection.outputModalities, option.outputModalities)
    ),
  );
}

function isModelSelectorField(field: NodePropertyFieldViewModel): boolean {
  const effectiveType = field.editorType ?? field.type;
  return effectiveType === "model" || effectiveType === "model-reference" || effectiveType === "model-list";
}

export function attachInstalledModelOptions(
  field: NodePropertyFieldViewModel,
  installedModelOptions?: ReadonlyArray<InstalledModelOption>
): NodePropertyFieldViewModel {
  if (!isModelSelectorField(field)) {
    return field;
  }

  const options = installedModelOptions
    ? filterInstalledModelOptions(installedModelOptions, field.modelSelection)
    : field.options;

  return Object.freeze({
    ...field,
    options,
  });
}
