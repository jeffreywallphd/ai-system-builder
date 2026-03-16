import type { INodeProperty } from "../../../domain/nodes/interfaces/INodeProperty";

export interface IComfyWidgetInputValue {
  readonly name: string;
  readonly value: unknown;
}

export class ComfyPropertyAdapter {
  public adaptProperty(property: INodeProperty): IComfyWidgetInputValue | undefined {
    if (!property.isPersisted) {
      return undefined;
    }

    if (property.isEmpty() && property.defaultValue === undefined) {
      return undefined;
    }

    return Object.freeze({
      name: property.id,
      value: this.toComfyValue(property),
    });
  }

  public adaptProperties(
    properties: ReadonlyArray<INodeProperty>
  ): Readonly<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const property of properties) {
      const adapted = this.adaptProperty(property);

      if (!adapted) {
        continue;
      }

      result[adapted.name] = adapted.value;
    }

    return Object.freeze(result);
  }

  private toComfyValue(property: INodeProperty): unknown {
    const value = property.value;

    switch (property.type) {
      case "integer":
        return typeof value === "number" ? Math.trunc(value) : value;

      case "number":
      case "slider":
        return value;

      case "boolean":
        return typeof value === "boolean" ? value : Boolean(value);

      case "multi-select":
      case "model-list":
        return Array.isArray(value) ? [...value] : value;

      case "json":
      case "key-value":
        return value === undefined ? undefined : value;

      case "select":
      case "model-reference":
      case "template":
      case "code":
      case "multiline-text":
      case "text":
      case "file":
      case "directory":
      case "secret":
      case "color":
      case "date":
      case "duration":
      case "generic":
      default:
        return value;
    }
  }
}
