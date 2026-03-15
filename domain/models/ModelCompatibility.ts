import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "./interfaces/IModelCompatibility";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values: ReadonlyArray<string>): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function hasIntersection(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean {
  const rightSet = new Set(normalizeArray(right));
  return normalizeArray(left).some((value) => rightSet.has(value));
}

export class ModelCompatibility implements IModelCompatibility {
  public readonly inputModalities: ReadonlyArray<ModelModality>;
  public readonly outputModalities: ReadonlyArray<ModelModality>;
  public readonly supportedTasks: ReadonlyArray<ModelTask>;
  public readonly supportedRuntimes: ReadonlyArray<RuntimeEngine>;
  public readonly allowsAnyRuntime: boolean;
  public readonly architectureFamilies: ReadonlyArray<string>;
  public readonly allowsAnyArchitectureFamily: boolean;
  public readonly compatibleAssetTypes: ReadonlyArray<string>;

  constructor(params: {
    inputModalities?: ReadonlyArray<ModelModality>;
    outputModalities?: ReadonlyArray<ModelModality>;
    supportedTasks?: ReadonlyArray<ModelTask>;
    supportedRuntimes?: ReadonlyArray<RuntimeEngine>;
    allowsAnyRuntime?: boolean;
    architectureFamilies?: ReadonlyArray<string>;
    allowsAnyArchitectureFamily?: boolean;
    compatibleAssetTypes?: ReadonlyArray<string>;
  } = {}) {
    this.inputModalities = Object.freeze([...(params.inputModalities ?? [])]);
    this.outputModalities = Object.freeze([...(params.outputModalities ?? [])]);
    this.supportedTasks = Object.freeze([...(params.supportedTasks ?? [])]);
    this.supportedRuntimes = Object.freeze([...(params.supportedRuntimes ?? [])]);
    this.allowsAnyRuntime = params.allowsAnyRuntime ?? false;
    this.architectureFamilies = Object.freeze([
      ...(params.architectureFamilies ?? []),
    ]);
    this.allowsAnyArchitectureFamily =
      params.allowsAnyArchitectureFamily ?? false;
    this.compatibleAssetTypes = Object.freeze([
      ...(params.compatibleAssetTypes ?? []),
    ]);
  }

  public supportsInputModality(modality: ModelModality): boolean {
    return normalizeArray(this.inputModalities).includes(normalize(modality));
  }

  public supportsOutputModality(modality: ModelModality): boolean {
    return normalizeArray(this.outputModalities).includes(normalize(modality));
  }

  public supportsTask(task: ModelTask): boolean {
    return normalizeArray(this.supportedTasks).includes(normalize(task));
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (this.allowsAnyRuntime) {
      return true;
    }

    return normalizeArray(this.supportedRuntimes).includes(normalize(runtime));
  }

  public supportsArchitectureFamily(family: string): boolean {
    if (this.allowsAnyArchitectureFamily) {
      return true;
    }

    return normalizeArray(this.architectureFamilies).includes(normalize(family));
  }

  public supportsAssetType(assetType: string): boolean {
    return normalizeArray(this.compatibleAssetTypes).includes(
      normalize(assetType)
    );
  }

  public isCompatibleWith(other: IModelCompatibility): boolean {
    const runtimeCompatible =
      this.allowsAnyRuntime ||
      other.allowsAnyRuntime ||
      hasIntersection(this.supportedRuntimes, other.supportedRuntimes);

    if (!runtimeCompatible) {
      return false;
    }

    const architectureCompatible =
      this.allowsAnyArchitectureFamily ||
      other.allowsAnyArchitectureFamily ||
      hasIntersection(this.architectureFamilies, other.architectureFamilies);

    if (!architectureCompatible) {
      return false;
    }

    const modalityFlowCompatible =
      hasIntersection(this.outputModalities, other.inputModalities) ||
      hasIntersection(other.outputModalities, this.inputModalities) ||
      hasIntersection(this.inputModalities, other.inputModalities) ||
      hasIntersection(this.outputModalities, other.outputModalities);

    const taskCompatible =
      hasIntersection(this.supportedTasks, other.supportedTasks);

    const assetCompatible =
      hasIntersection(this.compatibleAssetTypes, other.compatibleAssetTypes);

    return modalityFlowCompatible || taskCompatible || assetCompatible;
  }

  public static any(): ModelCompatibility {
    return new ModelCompatibility({
      allowsAnyRuntime: true,
      allowsAnyArchitectureFamily: true,
      inputModalities: ["generic"],
      outputModalities: ["generic"],
      supportedTasks: ["generic"],
    });
  }

  public static from(
    compatibility: IModelCompatibility
  ): ModelCompatibility {
    return new ModelCompatibility({
      inputModalities: compatibility.inputModalities,
      outputModalities: compatibility.outputModalities,
      supportedTasks: compatibility.supportedTasks,
      supportedRuntimes: compatibility.supportedRuntimes,
      allowsAnyRuntime: compatibility.allowsAnyRuntime,
      architectureFamilies: compatibility.architectureFamilies,
      allowsAnyArchitectureFamily:
        compatibility.allowsAnyArchitectureFamily,
      compatibleAssetTypes: compatibility.compatibleAssetTypes,
    });
  }
}
