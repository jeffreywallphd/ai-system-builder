export type SyncBridgeMethod = (...args: ReadonlyArray<any>) => any;
export type AsyncBridgeMethod = (...args: ReadonlyArray<any>) => Promise<any>;
export type SyncBridgeGroup = Record<string, SyncBridgeMethod>;
export type AsyncBridgeGroup = Record<string, AsyncBridgeMethod>;

export interface DesktopIpcRendererLike {
  sendSync(channel: string, ...args: ReadonlyArray<any>): unknown;
  invoke(channel: string, ...args: ReadonlyArray<any>): Promise<unknown>;
}

export interface DeferredBridgeGuards {
  guardDeferredSyncGroup<TGroup extends SyncBridgeGroup>(groupName: string, group: TGroup): TGroup;
  guardDeferredAsyncGroup<TGroup extends AsyncBridgeGroup>(groupName: string, group: TGroup): TGroup;
}
