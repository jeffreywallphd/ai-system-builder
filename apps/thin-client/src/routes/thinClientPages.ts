export type ThinClientPageKey = "home" | "artifacts" | "assets" | "image-generation" | "models" | "security" | "settings";

export interface ThinClientPageDefinition {
  key: ThinClientPageKey;
  label: string;
  path: string;
}

export const thinClientPageDefinitions: readonly ThinClientPageDefinition[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "artifacts", label: "Artifacts", path: "/artifacts" },
  { key: "assets", label: "Assets", path: "/assets" },
  { key: "image-generation", label: "Image Generation", path: "/image-generation" },
  { key: "models", label: "Models", path: "/models" },
  { key: "security", label: "Security", path: "/security" },
  { key: "settings", label: "Settings", path: "/settings" },
];

export function resolveThinClientPage(pathname: string): ThinClientPageKey {
  if (pathname === "/artifacts") return "artifacts";
  if (pathname === "/assets") return "assets";
  if (pathname === "/image-generation") return "image-generation";
  if (pathname === "/models") return "models";
  if (pathname === "/security") return "security";
  if (pathname === "/settings") return "settings";
  return "home";
}
