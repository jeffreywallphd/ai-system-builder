export const AppRuntimeModes = {
  browserDevelopment: "browser-development",
  desktopDevelopment: "desktop-development",
  desktopProduction: "desktop-production",
} as const;

export type AppRuntimeMode = (typeof AppRuntimeModes)[keyof typeof AppRuntimeModes];

export function isDesktopRuntimeMode(mode: AppRuntimeMode): boolean {
  return mode === AppRuntimeModes.desktopDevelopment || mode === AppRuntimeModes.desktopProduction;
}

export function isProductionRuntimeMode(mode: AppRuntimeMode): boolean {
  return mode === AppRuntimeModes.desktopProduction;
}
