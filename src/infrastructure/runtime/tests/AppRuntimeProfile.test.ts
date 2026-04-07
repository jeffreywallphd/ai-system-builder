import { describe, expect, it } from "bun:test";
import { AppRuntimeModes } from "../../../domain/runtime/AppRuntimeMode";
import {
  AppDistributionTargets,
  AppHostKinds,
  AppLifecycleStages,
  RendererDeliveryModes,
  getAppRuntimeProfile,
} from "../../../domain/runtime/AppRuntimeProfile";

describe("getAppRuntimeProfile", () => {
  it("describes browser development as browser-hosted dev-server distribution", () => {
    const profile = getAppRuntimeProfile(AppRuntimeModes.browserDevelopment);

    expect(profile.hostKind).toBe(AppHostKinds.browser);
    expect(profile.lifecycleStage).toBe(AppLifecycleStages.development);
    expect(profile.distributionTarget).toBe(AppDistributionTargets.viteBrowser);
    expect(profile.rendererDeliveryMode).toBe(RendererDeliveryModes.devServer);
    expect(profile.usesDesktopBridge).toBe(false);
    expect(profile.usesDurableDesktopStorage).toBe(false);
    expect(profile.supportsManagedLocalRuntime).toBe(true);
    expect(profile.supportsLocalWorkspaceFilesystem).toBe(false);
    expect(profile.supportsBrowserWorkspaceStorage).toBe(true);
  });

  it("describes packaged desktop as desktop-hosted packaged assets", () => {
    const profile = getAppRuntimeProfile(AppRuntimeModes.desktopProduction);

    expect(profile.hostKind).toBe(AppHostKinds.desktop);
    expect(profile.lifecycleStage).toBe(AppLifecycleStages.production);
    expect(profile.distributionTarget).toBe(AppDistributionTargets.electron);
    expect(profile.rendererDeliveryMode).toBe(RendererDeliveryModes.packagedAssets);
    expect(profile.usesDesktopBridge).toBe(true);
    expect(profile.usesDurableDesktopStorage).toBe(true);
    expect(profile.supportsManagedLocalRuntime).toBe(true);
    expect(profile.supportsLocalWorkspaceFilesystem).toBe(true);
    expect(profile.supportsBrowserWorkspaceStorage).toBe(false);
  });
});
