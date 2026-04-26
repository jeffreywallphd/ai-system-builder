export type ApplicationSettingKey = string;

export const APPLICATION_SETTING_CATEGORIES = [
  "huggingface",
  "models",
  "runtime",
  "datasetPreparation",
  "publishing",
] as const;

export type ApplicationSettingCategory = (typeof APPLICATION_SETTING_CATEGORIES)[number];

export const APPLICATION_SETTING_VALUE_KINDS = [
  "string",
  "number",
  "boolean",
  "secret",
  "select",
  "object",
] as const;

export type ApplicationSettingValueKind = (typeof APPLICATION_SETTING_VALUE_KINDS)[number];

export type ApplicationSettingScope = "application" | "workspace" | "profile";

export interface ApplicationSettingOption {
  value: string;
  label?: string;
}

export interface SecretSettingValue {
  kind: "secret";
  configured: boolean;
  maskedValue?: string;
}

export type ApplicationSettingPrimitiveValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | SecretSettingValue;

export interface ApplicationSettingDefinition {
  key: ApplicationSettingKey;
  category: ApplicationSettingCategory;
  label: string;
  description?: string;
  valueKind: ApplicationSettingValueKind;
  sensitive?: boolean;
  defaultValue?: ApplicationSettingPrimitiveValue;
  options?: ApplicationSettingOption[];
  scope?: ApplicationSettingScope;
}

export interface ApplicationSettingValue {
  key: ApplicationSettingKey;
  configured: boolean;
  value?: ApplicationSettingPrimitiveValue;
  masked?: boolean;
  maskedValue?: string;
  updatedAt?: string;
}
