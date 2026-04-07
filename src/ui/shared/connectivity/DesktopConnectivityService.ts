import type { OfflineConnectivitySurfaceStateDto } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { parseOfflineConnectivitySurfaceStateDto } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";

export interface DesktopOfflineModeRequest {
  readonly active: boolean;
  readonly detail?: string;
}

export interface DesktopConnectivityBridgeLike {
  getConnectivityState(): Promise<string>;
  setOfflineMode(requestJson: string): Promise<string>;
}

export interface DesktopConnectivityApiLike {
  readonly connectivity?: DesktopConnectivityBridgeLike;
}

export class DesktopConnectivityService {
  public async getConnectivityState(
    desktopBridge: DesktopConnectivityApiLike | undefined = resolveDesktopBridge(),
  ): Promise<OfflineConnectivitySurfaceStateDto | undefined> {
    const connectivityBridge = desktopBridge?.connectivity;
    if (!connectivityBridge) {
      return undefined;
    }

    const payload = await connectivityBridge.getConnectivityState();
    return parseOfflineConnectivitySurfaceStateDto(JSON.parse(payload));
  }

  public async setOfflineMode(
    request: DesktopOfflineModeRequest,
    desktopBridge: DesktopConnectivityApiLike | undefined = resolveDesktopBridge(),
  ): Promise<OfflineConnectivitySurfaceStateDto | undefined> {
    const connectivityBridge = desktopBridge?.connectivity;
    if (!connectivityBridge) {
      return undefined;
    }

    const response = await connectivityBridge.setOfflineMode(JSON.stringify(request));
    return parseOfflineConnectivitySurfaceStateDto(JSON.parse(response));
  }
}

function resolveDesktopBridge(): DesktopConnectivityApiLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop;
}
