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
};

type ResolutionSource = {
  source: ResolvedModelDefault["source"];
  settingKey?: string;
  value?: unknown;
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
    ].filter((key): key is string => Boolean(key));

    const values = await this.settings.readValues({ keys });
    const valuesByKey = new Map(values.map((value) => [value.key, value.value] as const));

    const sources: ResolutionSource[] = [
      request.featureKey
        ? {
          source: "feature",
          settingKey: createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey),
          value: valuesByKey.get(createFeatureModelDefaultSettingKey(request.featureKey, request.taskKey)),
        }
        : undefined,
      {
        source: "task",
        settingKey: createTaskModelDefaultSettingKey(request.taskKey),
        value: valuesByKey.get(createTaskModelDefaultSettingKey(request.taskKey)),
      },
      {
        source: "global",
        settingKey: GLOBAL_MODEL_DEFAULT_SETTING_KEY,
        value: valuesByKey.get(GLOBAL_MODEL_DEFAULT_SETTING_KEY),
      },
      {
        source: "builtin",
        value: BUILTIN_MODEL_DEFAULT,
      },
    ].filter((source): source is ResolutionSource => Boolean(source));

    for (const candidate of sources) {
      const normalized = this.tryNormalize(candidate.value);
      if (!normalized) {
        continue;
      }

      return {
        ...normalized,
        source: candidate.source,
        settingKey: candidate.settingKey,
      };
    }

    return {
      ...BUILTIN_MODEL_DEFAULT,
      source: "builtin",
    };
  }

  private tryNormalize(value: unknown): ModelDefaultConfig | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const input = value as Record<string, unknown>;
    if (typeof input.modelId !== "string" || input.modelId.trim().length === 0) {
      return undefined;
    }

    if (input.inferenceMode !== "text2text" && input.inferenceMode !== "causal" && input.inferenceMode !== "chat") {
      return undefined;
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
}
