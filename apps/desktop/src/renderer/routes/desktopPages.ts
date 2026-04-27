export type DesktopPageKey = "home" | "artifacts" | "models" | "settings" | "system";

export interface DesktopPageDefinition {
  key: DesktopPageKey;
  label: string;
}

export const desktopPageDefinitions: readonly DesktopPageDefinition[] = [
  {
    key: "artifacts",
    label: "Data",
  },
  {
    key: "models",
    label: "Models",
  },
  {
    key: "settings",
    label: "Settings",
  },
  {
    key: "system",
    label: "System",
  },
];
