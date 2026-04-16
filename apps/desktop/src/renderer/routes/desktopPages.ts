export type DesktopPageKey = "home" | "system";

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
    key: "system",
    label: "System",
  },
];
