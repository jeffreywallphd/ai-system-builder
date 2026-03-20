import type { IModel } from "../../domain/models/interfaces/IModel";
import type { NodePropertyFieldViewModel } from "../presenters/NodePresenter";
import { formatBytes } from "../presenters/PresenterFormatting";

export interface InstalledModelOption {
  readonly label: string;
  readonly value: string;
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
        });
      })
  );
}

export function attachInstalledModelOptions(
  field: NodePropertyFieldViewModel,
  installedModelOptions?: ReadonlyArray<InstalledModelOption>
): NodePropertyFieldViewModel {
  if ((field.editorType ?? field.type) !== "model") {
    return field;
  }

  const options = installedModelOptions && installedModelOptions.length > 0
    ? installedModelOptions
    : field.options;

  return Object.freeze({
    ...field,
    options,
  });
}
