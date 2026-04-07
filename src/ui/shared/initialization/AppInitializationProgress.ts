export const AppInitializationStageIds = Object.freeze({
  preparingDesktopRuntime: "preparing-desktop-runtime",
  startingLocalServices: "starting-local-services",
  startingIdentityServices: "starting-identity-services",
  loadingSavedSession: "loading-saved-session",
  validatingSession: "validating-session",
  loadingWorkspaceContext: "loading-workspace-context",
  readyForSignIn: "ready-for-sign-in",
  ready: "ready",
} as const);

export type AppInitializationStageId =
  typeof AppInitializationStageIds[keyof typeof AppInitializationStageIds];

export interface AppInitializationProgressUpdate {
  readonly stageId: AppInitializationStageId;
  readonly detail?: string;
}

export interface AppInitializationStagePresentation {
  readonly title: string;
  readonly subtitle: string;
}

export const AppInitializationStageOrder = Object.freeze([
  AppInitializationStageIds.preparingDesktopRuntime,
  AppInitializationStageIds.startingLocalServices,
  AppInitializationStageIds.startingIdentityServices,
  AppInitializationStageIds.loadingSavedSession,
  AppInitializationStageIds.validatingSession,
  AppInitializationStageIds.loadingWorkspaceContext,
  AppInitializationStageIds.readyForSignIn,
  AppInitializationStageIds.ready,
] as const);

const AppInitializationStagePresentationMap: Record<AppInitializationStageId, AppInitializationStagePresentation> = Object.freeze({
  [AppInitializationStageIds.preparingDesktopRuntime]: Object.freeze({
    title: "Preparing app startup",
    subtitle: "Getting the desktop app runtime ready.",
  }),
  [AppInitializationStageIds.startingLocalServices]: Object.freeze({
    title: "Starting services",
    subtitle: "Starting local services required by the app.",
  }),
  [AppInitializationStageIds.startingIdentityServices]: Object.freeze({
    title: "Starting sign-in services",
    subtitle: "Connecting sign-in services for this desktop session.",
  }),
  [AppInitializationStageIds.loadingSavedSession]: Object.freeze({
    title: "Checking your saved sign-in",
    subtitle: "Looking for an existing sign-in on this device.",
  }),
  [AppInitializationStageIds.validatingSession]: Object.freeze({
    title: "Checking your saved sign-in",
    subtitle: "Verifying your saved sign-in with the identity service.",
  }),
  [AppInitializationStageIds.loadingWorkspaceContext]: Object.freeze({
    title: "Loading your workspace access",
    subtitle: "Loading your workspace context and permissions.",
  }),
  [AppInitializationStageIds.readyForSignIn]: Object.freeze({
    title: "Preparing sign-in",
    subtitle: "You can sign in now.",
  }),
  [AppInitializationStageIds.ready]: Object.freeze({
    title: "Setup complete",
    subtitle: "Initialization completed successfully.",
  }),
});

export function getAppInitializationStagePresentation(stageId: AppInitializationStageId): AppInitializationStagePresentation {
  return AppInitializationStagePresentationMap[stageId];
}
