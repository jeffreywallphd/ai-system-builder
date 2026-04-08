import {
  createOfflineSynchronizationStateSnapshot,
  type OfflineConnectivitySurfaceStateDto,
  type OfflineSynchronizationStateSnapshotDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { parseOfflineConnectivitySurfaceStateDto } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";
import { parseOfflineSynchronizationStateSnapshotDto } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";

export interface DesktopOfflineModeRequest {
  readonly active: boolean;
  readonly detail?: string;
}

export interface DesktopConnectivityBridgeLike {
  getConnectivityState(): Promise<string>;
  setOfflineMode(requestJson: string): Promise<string>;
  getSynchronizationStateSnapshot?(): Promise<string>;
}

export interface DesktopConnectivityApiLike {
  readonly connectivity?: DesktopConnectivityBridgeLike;
}

export class DesktopConnectivityService {
  private static readonly fallbackWorkspaceId = "desktop-local";

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

  public async getSynchronizationStateSnapshot(
    desktopBridge: DesktopConnectivityApiLike | undefined = resolveDesktopBridge(),
  ): Promise<OfflineSynchronizationStateSnapshotDto | undefined> {
    const connectivityBridge = desktopBridge?.connectivity;
    if (!connectivityBridge) {
      return undefined;
    }

    if (typeof connectivityBridge.getSynchronizationStateSnapshot === "function") {
      const payload = await connectivityBridge.getSynchronizationStateSnapshot();
      return parseOfflineSynchronizationStateSnapshotDto(JSON.parse(payload));
    }

    const connectivity = await this.getConnectivityState(desktopBridge);
    if (!connectivity) {
      return undefined;
    }

    const timestamp = new Date().toISOString();
    return createOfflineSynchronizationStateSnapshot({
      workspaceId: DesktopConnectivityService.fallbackWorkspaceId,
      cachedResources: Object.freeze([]),
      drafts: Object.freeze([]),
      queue: Object.freeze({
        queueId: "desktop-offline-sync",
        operations: Object.freeze([]),
        localExecutionRegistrations: Object.freeze([]),
        pendingRunSubmissions: Object.freeze([]),
        outcomes: Object.freeze([]),
        updatedAt: timestamp,
      }),
      connectivity,
      lastAttemptedAt: connectivity.lastChangedAt,
    });
  }
}

function resolveDesktopBridge(): DesktopConnectivityApiLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop;
}
