import {
  AppRuntimeModes,
  type AppRuntimeMode,
} from "../../domain/runtime/AppRuntimeMode";

export interface ResolveAppRuntimeModeRequest {
  readonly hasDesktopHost: boolean;
  readonly isPackagedDesktopHost: boolean;
}

export class ResolveAppRuntimeModeUseCase {
  public execute(request: ResolveAppRuntimeModeRequest): AppRuntimeMode {
    if (!request.hasDesktopHost) {
      return AppRuntimeModes.browserDevelopment;
    }

    return request.isPackagedDesktopHost
      ? AppRuntimeModes.desktopProduction
      : AppRuntimeModes.desktopDevelopment;
  }
}
