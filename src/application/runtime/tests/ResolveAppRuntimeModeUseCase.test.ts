import { describe, expect, it } from "bun:test";
import { AppRuntimeModes } from "../../../domain/runtime/AppRuntimeMode";
import { ResolveAppRuntimeModeUseCase } from "../ResolveAppRuntimeModeUseCase";

describe("ResolveAppRuntimeModeUseCase", () => {
  const useCase = new ResolveAppRuntimeModeUseCase();

  it("returns browser-development when no desktop host is present", () => {
    expect(useCase.execute({ hasDesktopHost: false, isPackagedDesktopHost: false })).toBe(AppRuntimeModes.browserDevelopment);
  });

  it("returns desktop-production for packaged desktop host", () => {
    expect(useCase.execute({ hasDesktopHost: true, isPackagedDesktopHost: true })).toBe(AppRuntimeModes.desktopProduction);
  });
});
