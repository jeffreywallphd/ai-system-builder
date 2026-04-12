export const DesktopBootstrapIpcChannels = Object.freeze({
  bootstrap: "ai-loom-desktop:get-bootstrap-sync",
  storageGetItem: "ai-loom-desktop-storage:getItem",
  storageSetItem: "ai-loom-desktop-storage:setItem",
  storageRemoveItem: "ai-loom-desktop-storage:removeItem",
  deferredFeatureApiReady: "ai-loom-desktop-runtime:is-feature-api-ready",
  postLoginRuntimeStatus: "ai-loom-desktop-runtime:get-post-login-runtime-status",
  startPostLoginWarmup: "ai-loom-desktop-runtime:start-post-login-warmup",
  connectivityGetState: "ai-loom-desktop-connectivity:get-state",
  connectivitySetOfflineMode: "ai-loom-desktop-connectivity:set-offline-mode",
  secretsIsAvailable: "ai-loom-desktop-secrets:is-available",
  secretsGet: "ai-loom-desktop-secrets:get",
  secretsSet: "ai-loom-desktop-secrets:set",
  secretsRemove: "ai-loom-desktop-secrets:remove",
});

