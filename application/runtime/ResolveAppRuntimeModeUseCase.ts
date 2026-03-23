import { type AppRuntimeMode } from "../../domain/runtime/AppRuntimeMode";
import { getAppRuntimeProfile } from "../../domain/runtime/AppRuntimeProfile";

export interface ResolveAppRuntimeModeRequest {
  readonly hasDesktopHost: boolean;
  readonly isPackagedDesktopHost: boolean;
}

export class ResolveAppRuntimeModeUseCase {
  public execute(request: ResolveAppRuntimeModeRequest): AppRuntimeMode {
    return getAppRuntimeProfile(request.hasDesktopHost
      ? (request.isPackagedDesktopHost ? "desktop-production" : "desktop-development")
      : "browser-development").mode;
  }
}
