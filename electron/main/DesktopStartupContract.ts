import { DesktopBootstrapIpcChannels } from "../shared/DesktopBootstrapIpcChannels";

export const DesktopStartupPhases = Object.freeze({
  hostBootstrap: "desktop-startup.host-bootstrap",
  preLoginAuthShellBootstrap: "desktop-startup.pre-login-auth-shell-bootstrap",
  identityAuthHostReadiness: "desktop-startup.identity-auth-host-readiness",
  mainWindowCreation: "desktop-startup.main-window-creation",
  postLoginWarmup: "desktop-startup.post-login-warmup",
  deferredFeatureRegistration: "desktop-startup.deferred-feature-registration",
  deferredFeatureRuntime: "desktop-startup.deferred-feature-runtime",
});

export const DesktopStartupBootStepIds = Object.freeze({
  preLoginBootstrap: "pre-login-bootstrap",
  authBootstrapIpcRegistration: "auth-bootstrap-ipc-registration",
  mainWindowCreation: "main-window-creation",
  serviceSupervisorStartup: "service-supervisor-startup",
  deferredFeatureRegistration: "deferred-feature-registration",
});

export const DesktopStartupBootSequence = Object.freeze([
  DesktopStartupBootStepIds.preLoginBootstrap,
  DesktopStartupBootStepIds.authBootstrapIpcRegistration,
  DesktopStartupBootStepIds.mainWindowCreation,
  DesktopStartupBootStepIds.serviceSupervisorStartup,
  DesktopStartupBootStepIds.deferredFeatureRegistration,
]);

export const PreLoginAuthShellInitializers = Object.freeze([
  "desktop-storage-auth-shell-pre-login",
  "auth-minimal-identity-host",
  "auth-bootstrap-ipc",
  "desktop-connectivity-monitor",
]);

export const PreLoginAuthShellForbiddenInitializers = Object.freeze([
  "service-supervisor",
  "workflow-runtime",
  "studio-runtime",
  "system-runtime",
]);

export const DesktopStartupRequiredAuthBootstrapIpcChannels = Object.freeze([
  DesktopBootstrapIpcChannels.bootstrap,
  DesktopBootstrapIpcChannels.storageGetItem,
  DesktopBootstrapIpcChannels.storageSetItem,
  DesktopBootstrapIpcChannels.storageRemoveItem,
  DesktopBootstrapIpcChannels.deferredFeatureApiReady,
  DesktopBootstrapIpcChannels.startPostLoginWarmup,
]);

function indexOfRequiredStep(stepId: string): number {
  const index = DesktopStartupBootSequence.indexOf(stepId);
  if (index < 0) {
    throw new Error(`Startup boot contract is missing required step '${stepId}'.`);
  }
  return index;
}

export function validateDesktopStartupContract(): void {
  const mainWindowStepIndex = indexOfRequiredStep(DesktopStartupBootStepIds.mainWindowCreation);
  const supervisorStepIndex = indexOfRequiredStep(DesktopStartupBootStepIds.serviceSupervisorStartup);
  if (mainWindowStepIndex >= supervisorStepIndex) {
    throw new Error("Desktop startup contract requires main-window creation before service-supervisor startup.");
  }

  const preLoginForbidden = new Set(PreLoginAuthShellForbiddenInitializers);
  const preLoginViolations = PreLoginAuthShellInitializers.filter((initializer) => preLoginForbidden.has(initializer));
  if (preLoginViolations.length > 0) {
    throw new Error(`Pre-login bootstrap includes forbidden runtime initializers: ${preLoginViolations.join(", ")}.`);
  }

  if (!DesktopStartupRequiredAuthBootstrapIpcChannels.includes(DesktopBootstrapIpcChannels.bootstrap)) {
    throw new Error("Desktop startup contract requires bootstrap IPC channel for preload sync bootstrap.");
  }
}

