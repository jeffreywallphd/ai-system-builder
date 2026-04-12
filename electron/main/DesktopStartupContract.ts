/**
 * Defines and validates the startup contract used to safely exchange initialization context between desktop process boundaries.
 */
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
});

export const DesktopStartupBootSequence = Object.freeze([
  DesktopStartupBootStepIds.preLoginBootstrap,
  DesktopStartupBootStepIds.authBootstrapIpcRegistration,
  DesktopStartupBootStepIds.mainWindowCreation,
]);

export const DesktopPostLoginWarmupStepIds = Object.freeze({
  pythonRuntimeResolution: "python-runtime-resolution",
  serviceSupervisorStartup: "service-supervisor-startup",
  deferredFeatureRegistration: "deferred-feature-registration",
});

export const DesktopPostLoginWarmupSequence = Object.freeze([
  DesktopPostLoginWarmupStepIds.pythonRuntimeResolution,
  DesktopPostLoginWarmupStepIds.serviceSupervisorStartup,
  DesktopPostLoginWarmupStepIds.deferredFeatureRegistration,
]);

export const PreLoginAuthShellInitializers = Object.freeze([
  "desktop-storage-auth-shell-pre-login",
  "auth-minimal-identity-host",
  "auth-bootstrap-ipc",
]);

export const PreLoginAuthShellForbiddenInitializers = Object.freeze([
  "desktop-connectivity-monitor",
  "python-runtime-resolution",
  "service-supervisor",
  "workflow-persistence",
  "execution-history",
  "workflow-run-history",
  "studio-shell-backend-api",
  "system-studio-backend-api",
  "system-runtime-backend-api",
  "canonical-registry-runtime",
  "agent-runtime",
]);

export const PreLoginStartupForbiddenRuntimeGroups = Object.freeze([
  "service-supervisor",
  "python-runtime-resolution",
  "workflow-persistence",
  "execution-history",
  "workflow-run-history",
  "studio-shell-backend-api",
  "system-studio-backend-api",
  "system-runtime-backend-api",
  "desktop-connectivity-monitor",
]);

export const DesktopStartupRequiredAuthBootstrapIpcChannels = Object.freeze([
  DesktopBootstrapIpcChannels.bootstrap,
  DesktopBootstrapIpcChannels.storageGetItem,
  DesktopBootstrapIpcChannels.storageSetItem,
  DesktopBootstrapIpcChannels.storageRemoveItem,
  DesktopBootstrapIpcChannels.deferredFeatureApiReady,
  DesktopBootstrapIpcChannels.postLoginRuntimeStatus,
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
  indexOfRequiredStep(DesktopStartupBootStepIds.preLoginBootstrap);
  indexOfRequiredStep(DesktopStartupBootStepIds.authBootstrapIpcRegistration);
  indexOfRequiredStep(DesktopStartupBootStepIds.mainWindowCreation);
  if (DesktopStartupBootSequence.includes(DesktopPostLoginWarmupStepIds.pythonRuntimeResolution)) {
    throw new Error("Desktop startup boot contract cannot include python runtime resolution.");
  }
  if (DesktopStartupBootSequence.includes(DesktopPostLoginWarmupStepIds.serviceSupervisorStartup)) {
    throw new Error("Desktop startup boot contract cannot include service-supervisor startup.");
  }

  const preLoginForbidden = new Set(PreLoginAuthShellForbiddenInitializers);
  const preLoginViolations = PreLoginAuthShellInitializers.filter((initializer) => preLoginForbidden.has(initializer));
  if (preLoginViolations.length > 0) {
    throw new Error(`Pre-login bootstrap includes forbidden runtime initializers: ${preLoginViolations.join(", ")}.`);
  }
  const deferredRuntimeBoundaryMissing = PreLoginStartupForbiddenRuntimeGroups.filter((group) => !preLoginForbidden.has(group));
  if (deferredRuntimeBoundaryMissing.length > 0) {
    throw new Error(
      `Pre-login startup contract is missing deferred runtime guard groups: ${deferredRuntimeBoundaryMissing.join(", ")}.`,
    );
  }

  if (!DesktopStartupRequiredAuthBootstrapIpcChannels.includes(DesktopBootstrapIpcChannels.bootstrap)) {
    throw new Error("Desktop startup contract requires bootstrap IPC channel for preload sync bootstrap.");
  }
}

