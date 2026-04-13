import type {
  DesktopControlPlaneCapabilityPhase,
  DesktopControlPlaneRuntimeStatus,
} from "@application/common/DesktopControlPlaneRuntimeContracts";
import {
  AuthoritativeServerCapabilityIds,
  type AuthoritativeServerCapabilityActivationService,
  type AuthoritativeServerRouteFamilyAvailability,
} from "./AuthoritativeServerCapabilityActivation";

export interface DesktopRuntimeLifecycleStatusProvider {
  readonly getStatus: () => Pick<DesktopControlPlaneRuntimeStatus, "capabilityPhase">;
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

  const capabilityPhase = normalizeCapabilityPhase(input.runtimeStatusProvider.getStatus().capabilityPhase);
  return Object.freeze({
    ...routeFamilyAvailability,
    state: capabilityPhase,
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
