export type DesktopPageKey = "home" | "artifacts" | "system";

export interface DesktopPageDefinition {
  key: DesktopPageKey;
  label: string;
}

export const desktopPageDefinitions: readonly DesktopPageDefinition[] = [
  {
    key: "home",
    label: "Home",
  },
  {
    key: "artifacts",
    label: "Artifacts",
  },
  {
    key: "system",
    label: "System",
  },
];
