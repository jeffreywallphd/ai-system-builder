import {
  createFeatureModelDefaultSettingKey,
  createTaskModelDefaultSettingKey,
  GLOBAL_MODEL_DEFAULT_SETTING_KEY,
  type ModelDefaultConfig,
  type ResolveModelDefaultRequest,
  type ResolvedModelDefault,
} from "../../../contracts/settings";
import type { ApplicationSettingsPort, ModelDefaultResolverPort } from "../../ports/settings";

const BUILTIN_MODEL_DEFAULT: ModelDefaultConfig = {
  provider: "transformers",
  modelId: "google/flan-t5-small",
  inferenceMode: "text2text",
  device: "auto",
  torchDtype: "auto",
};

type ResolutionSource = {
  source: ResolvedModelDefault["source"];
  settingKey?: string;
  configured?: boolean;
  value: unknown;
};

export interface DefaultModelDefaultResolverDependencies {
  settings: ApplicationSettingsPort;
}

export class DefaultModelDefaultResolver implements ModelDefaultResolverPort {
  private readonly settings: ApplicationSettingsPort;

  public constructor(dependencies: DefaultModelDefaultResolverDependencies) {
    this.settings = dependencies.settings;
  }

  public async resolve(request: ResolveModelDefaultRequest): Promise<ResolvedModelDefault> {
    const keys = [
      request.featureKey ? createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey) : undefined,
      createTaskModelDefaultSettingKey(request.taskKey),
      GLOBAL_MODEL_DEFAULT_SETTING_KEY,
      "runtime.python.defaultDevice",
      "runtime.python.defaultTorchDtype",
    ].filter((key): key is string => Boolean(key));

    const values = await this.settings.readValues({ keys });
    const valuesByKey = new Map(values.map((value) => [value.key, value] as const));

    const sources: ResolutionSource[] = [
      request.featureKey
        ? {
          source: "feature",
          settingKey: createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey),
          configured: valuesByKey.get(createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey))?.configured,
          value: valuesByKey.get(createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey))?.value,
        }
        : undefined,
      {
        source: "task",
        settingKey: createTaskModelDefaultSettingKey(request.taskKey),
        configured: valuesByKey.get(createTaskModelDefaultSettingKey(request.taskKey))?.configured,
        value: valuesByKey.get(createTaskModelDefaultSettingKey(request.taskKey))?.value,
      },
      {
        source: "global",
        settingKey: GLOBAL_MODEL_DEFAULT_SETTING_KEY,
        configured: valuesByKey.get(GLOBAL_MODEL_DEFAULT_SETTING_KEY)?.configured,
        value: valuesByKey.get(GLOBAL_MODEL_DEFAULT_SETTING_KEY)?.value,
      },
      {
        source: "builtin",
        configured: true,
        value: BUILTIN_MODEL_DEFAULT,
      },
    ].filter((source): source is ResolutionSource => Boolean(source));

    let resolved: ResolvedModelDefault | undefined;
    for (const candidate of sources) {
      if (!candidate.configured) {
        continue;
      }
      const normalized = this.normalizeConfiguredModelDefault(candidate);
      resolved = {
        ...normalized,
        source: candidate.source,
        settingKey: candidate.settingKey,
      };
      break;
    }

    if (!resolved) {
      resolved = { ...BUILTIN_MODEL_DEFAULT, source: "builtin" };
    }

    return {
      ...resolved,
      device: this.resolveDevice(
        sources.filter((source) => source.source !== "builtin"),
        valuesByKey.get("runtime.python.defaultDevice")?.value,
      ),
      torchDtype: this.resolveTorchDtype(
        sources.filter((source) => source.source !== "builtin"),
        valuesByKey.get("runtime.python.defaultTorchDtype")?.value,
      ),
    };
  }

  private normalizeConfiguredModelDefault(source: ResolutionSource): ModelDefaultConfig {
    const value = source.value;
    if (!value || typeof value !== "object") {
      throw new Error(this.createInvalidMessage(source, "must be an object."));
    }

    const input = value as Record<string, unknown>;
    if (typeof input.modelId !== "string" || input.modelId.trim().length === 0) {
      throw new Error(this.createInvalidMessage(source, "must include a non-empty modelId."));
    }

    if ("provider" in input && input.provider !== "transformers") {
      throw new Error(this.createInvalidMessage(source, 'provider must be "transformers".'));
    }

    if (input.inferenceMode !== "text2text" && input.inferenceMode !== "causal" && input.inferenceMode !== "chat") {
      throw new Error(this.createInvalidMessage(source, "must include a supported inferenceMode."));
    }

    const config: ModelDefaultConfig = {
      provider: "transformers",
      modelId: input.modelId.trim(),
      inferenceMode: input.inferenceMode,
    };

    if (input.device === "cpu" || input.device === "cuda" || input.device === "auto") {
      config.device = input.device;
    }

    if (
      input.torchDtype === "auto"
      || input.torchDtype === "float16"
      || input.torchDtype === "bfloat16"
      || input.torchDtype === "float32"
    ) {
      config.torchDtype = input.torchDtype;
    }

    return config;
  }

  private resolveDevice(sources: ResolutionSource[], runtimeValue: unknown): NonNullable<ModelDefaultConfig["device"]> {
    for (const source of sources) {
      if (!source.configured || !source.value || typeof source.value !== "object") {
        continue;
      }
      const input = source.value as Record<string, unknown>;
      if (input.device === "cpu" || input.device === "cuda" || input.device === "auto") {
        return input.device;
      }
    }

    if (runtimeValue === "cpu" || runtimeValue === "cuda" || runtimeValue === "auto") {
      return runtimeValue;
    }

    return "auto";
  }

  private resolveTorchDtype(
    sources: ResolutionSource[],
    runtimeValue: unknown,
  ): NonNullable<ModelDefaultConfig["torchDtype"]> {
    for (const source of sources) {
      if (!source.configured || !source.value || typeof source.value !== "object") {
        continue;
      }
      const input = source.value as Record<string, unknown>;
      if (
        input.torchDtype === "auto"
        || input.torchDtype === "float16"
        || input.torchDtype === "bfloat16"
        || input.torchDtype === "float32"
      ) {
        return input.torchDtype;
      }
    }

    if (
      runtimeValue === "auto"
      || runtimeValue === "float16"
      || runtimeValue === "bfloat16"
      || runtimeValue === "float32"
    ) {
      return runtimeValue;
    }

    return "auto";
  }

  private createInvalidMessage(source: ResolutionSource, reason: string): string {
    return `Configured model default "${source.settingKey ?? source.source}" is invalid: ${reason}`;
  }
}
