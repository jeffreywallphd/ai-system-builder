export type ThinClientPageKey = "home" | "artifacts" | "image-generation" | "models";
export type ThinClientPageKey = "home" | "artifacts" | "image-generation";

export interface ThinClientPageDefinition {
  key: ThinClientPageKey;
  label: string;
  path: string;
}

export const thinClientPageDefinitions: readonly ThinClientPageDefinition[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "artifacts", label: "Artifacts", path: "/artifacts" },
  { key: "image-generation", label: "Image Generation", path: "/image-generation" },
  { key: "models", label: "Models", path: "/models" },
];

export function resolveThinClientPage(pathname: string): ThinClientPageKey {
  if (pathname === "/artifacts") return "artifacts";
  if (pathname === "/image-generation") return "image-generation";
  if (pathname === "/models") return "models";
  return "home";
}
