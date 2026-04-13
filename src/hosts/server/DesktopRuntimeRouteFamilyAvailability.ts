import type {
  DesktopControlPlaneCapabilityPhase,
  DesktopControlPlaneActivationStageStatus,
  DesktopControlPlaneRuntimeStatus,
  DesktopControlPlaneTransportPhase,
} from "@application/common/DesktopControlPlaneRuntimeContracts";
import {
  AuthoritativeServerCapabilityIds,
  type AuthoritativeServerCapabilityActivationService,
  type AuthoritativeServerRuntimeActivationStageSnapshot,
  type AuthoritativeServerRouteFamilyRuntimeLifecycleSnapshot,
  type AuthoritativeServerRouteFamilyAvailability,
} from "./AuthoritativeServerCapabilityActivation";

export interface DesktopRuntimeLifecycleStatusProvider {
  readonly getStatus: () => Pick<
    DesktopControlPlaneRuntimeStatus,
    "capabilityPhase" | "activationMode" | "triggerSource" | "unavailableReason" | "failure" | "transport" | "activationStages"
  >;
}

export interface AuthoritativeServerRouteFamilyAvailabilityService {
  readonly isRouteFamilyAvailable: (routeFamilyId: string) => boolean;
  readonly resolveRouteFamilyAvailability: (routeFamilyId: string) => AuthoritativeServerRouteFamilyAvailability;
}

function normalizeCapabilityPhase(value: string | undefined): DesktopControlPlaneCapabilityPhase {
  if (value === "ready" || value === "warming" || value === "failed" || value === "pre-login") {
    return value;
  }
  return "pre-login";
}

function normalizeTransportPhase(value: string | undefined): DesktopControlPlaneTransportPhase | undefined {
  if (value === "available" || value === "binding" || value === "unavailable" || value === "failed") {
    return value;
  }
  return undefined;
}

function normalizeActivationStages(
  value: ReadonlyArray<DesktopControlPlaneActivationStageStatus> | undefined,
): ReadonlyArray<AuthoritativeServerRuntimeActivationStageSnapshot> | undefined {
  if (!value || value.length < 1) {
    return undefined;
  }
  return Object.freeze(value.map((stage) => Object.freeze({
    stageId: stage.stageId,
    state: stage.state,
    blockingReadiness: stage.blockingReadiness,
    detail: stage.detail?.trim() ? stage.detail : undefined,
    errorMessage: stage.errorMessage?.trim() ? stage.errorMessage : undefined,
  })));
}

function buildRuntimeLifecycleSnapshot(
  status: ReturnType<DesktopRuntimeLifecycleStatusProvider["getStatus"]>,
): AuthoritativeServerRouteFamilyRuntimeLifecycleSnapshot {
  return Object.freeze({
    capabilityPhase: normalizeCapabilityPhase(status.capabilityPhase),
    transportPhase: normalizeTransportPhase(status.transport?.phase),
    activationMode: status.activationMode?.trim() ? status.activationMode : undefined,
    triggerSource: status.triggerSource?.trim() ? status.triggerSource : undefined,
    unavailableReason: status.unavailableReason?.trim() ? status.unavailableReason : undefined,
    hasFailure: Boolean(status.failure),
    failureRetryable: status.failure?.retryable,
    activationStages: normalizeActivationStages(status.activationStages),
  });
}

function resolveRuntimeLifecycleAvailability(input: {
  readonly routeFamilyAvailability: AuthoritativeServerRouteFamilyAvailability;
  readonly runtimeStatusProvider?: DesktopRuntimeLifecycleStatusProvider;
}): AuthoritativeServerRouteFamilyAvailability {
  const routeFamilyAvailability = input.routeFamilyAvailability;
  if (
    routeFamilyAvailability.capabilityId !== AuthoritativeServerCapabilityIds.deferredRuntimeFeatures
    || !input.runtimeStatusProvider
  ) {
    return routeFamilyAvailability;
  }

  const runtimeStatus = input.runtimeStatusProvider.getStatus();
  const capabilityPhase = normalizeCapabilityPhase(runtimeStatus.capabilityPhase);
  return Object.freeze({
    ...routeFamilyAvailability,
    state: capabilityPhase,
    runtimeLifecycle: buildRuntimeLifecycleSnapshot(runtimeStatus),
    available: capabilityPhase === "ready",
  });
}

export function createAuthoritativeServerRouteFamilyAvailabilityService(input: {
  readonly capabilityActivation: AuthoritativeServerCapabilityActivationService;
  readonly runtimeStatusProvider?: DesktopRuntimeLifecycleStatusProvider;
}): AuthoritativeServerRouteFamilyAvailabilityService {
  return Object.freeze({
    isRouteFamilyAvailable(routeFamilyId) {
      return resolveRuntimeLifecycleAvailability({
        routeFamilyAvailability: input.capabilityActivation.resolveRouteFamilyAvailability(routeFamilyId),
        runtimeStatusProvider: input.runtimeStatusProvider,
      }).available;
    },
    resolveRouteFamilyAvailability(routeFamilyId) {
      return resolveRuntimeLifecycleAvailability({
        routeFamilyAvailability: input.capabilityActivation.resolveRouteFamilyAvailability(routeFamilyId),
        runtimeStatusProvider: input.runtimeStatusProvider,
      });
    },
  });
}
