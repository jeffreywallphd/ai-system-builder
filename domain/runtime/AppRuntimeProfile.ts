import { AppRuntimeModes, type AppRuntimeMode } from "./AppRuntimeMode";

export const AppHostKinds = {
  browser: "browser",
  desktop: "desktop",
} as const;

export type AppHostKind = (typeof AppHostKinds)[keyof typeof AppHostKinds];

export const AppLifecycleStages = {
  development: "development",
  production: "production",
} as const;

export type AppLifecycleStage = (typeof AppLifecycleStages)[keyof typeof AppLifecycleStages];

export const AppDistributionTargets = {
  viteBrowser: "vite-browser",
  electron: "electron",
} as const;

export type AppDistributionTarget = (typeof AppDistributionTargets)[keyof typeof AppDistributionTargets];

export const RendererDeliveryModes = {
  devServer: "dev-server",
  packagedAssets: "packaged-assets",
} as const;

export type RendererDeliveryMode = (typeof RendererDeliveryModes)[keyof typeof RendererDeliveryModes];

export interface AppRuntimeProfile {
  readonly mode: AppRuntimeMode;
  readonly hostKind: AppHostKind;
  readonly lifecycleStage: AppLifecycleStage;
  readonly distributionTarget: AppDistributionTarget;
  readonly rendererDeliveryMode: RendererDeliveryMode;
  readonly usesDesktopBridge: boolean;
  readonly usesDurableDesktopStorage: boolean;
}

const runtimeProfiles = Object.freeze<Record<AppRuntimeMode, AppRuntimeProfile>>({
  [AppRuntimeModes.browserDevelopment]: Object.freeze({
    mode: AppRuntimeModes.browserDevelopment,
    hostKind: AppHostKinds.browser,
    lifecycleStage: AppLifecycleStages.development,
    distributionTarget: AppDistributionTargets.viteBrowser,
    rendererDeliveryMode: RendererDeliveryModes.devServer,
    usesDesktopBridge: false,
    usesDurableDesktopStorage: false,
  }),
  [AppRuntimeModes.desktopDevelopment]: Object.freeze({
    mode: AppRuntimeModes.desktopDevelopment,
    hostKind: AppHostKinds.desktop,
    lifecycleStage: AppLifecycleStages.development,
    distributionTarget: AppDistributionTargets.electron,
    rendererDeliveryMode: RendererDeliveryModes.devServer,
    usesDesktopBridge: true,
    usesDurableDesktopStorage: false,
  }),
  [AppRuntimeModes.desktopProduction]: Object.freeze({
    mode: AppRuntimeModes.desktopProduction,
    hostKind: AppHostKinds.desktop,
    lifecycleStage: AppLifecycleStages.production,
    distributionTarget: AppDistributionTargets.electron,
    rendererDeliveryMode: RendererDeliveryModes.packagedAssets,
    usesDesktopBridge: true,
    usesDurableDesktopStorage: true,
  }),
});

export function getAppRuntimeProfile(mode: AppRuntimeMode): AppRuntimeProfile {
  return runtimeProfiles[mode];
}
