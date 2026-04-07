import type { StudioAssetRegistration } from "./StudioAssetRegistry";
import { applyStudioAssetPropertySchemaDefaults } from "./StudioAssetPropertySchema";

function normalizeConfig(config: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(config ?? {}) });
}

export function resolveStudioAssetDefaultConfig(input: {
  readonly registration: StudioAssetRegistration;
  readonly config?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> | undefined {
  const baseConfig = normalizeConfig(input.config);
  const propertySchema = input.registration.contract.propsSchema.propertySchema;
  if (!propertySchema) {
    return Object.keys(baseConfig).length > 0 ? baseConfig : undefined;
  }

  const withDefaults = applyStudioAssetPropertySchemaDefaults({
    schema: propertySchema,
    config: baseConfig,
  });

  return Object.keys(withDefaults).length > 0 ? withDefaults : undefined;
}
