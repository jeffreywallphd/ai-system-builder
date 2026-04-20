export type DesktopPageKey = "home" | "artifacts" | "system";

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
    key: "system",
    label: "System",
  },
];
