import {
  describeRuntimeDependencyResolution,
  type RuntimeDependencyResolution,
} from "../../application/runtime/RuntimeDependencyOrchestrator";

export function createRuntimeDependencyMetadata(
  resolution: RuntimeDependencyResolution,
  reason = "runtime-dependency-unavailable",
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    reason,
    dependency: resolution,
    state: resolution.state,
    availability: resolution.availability,
    degraded: resolution.degraded,
    remediationHints: resolution.remediationHints,
  });
}

export function createRuntimeDependencyDetail(
  resolution: RuntimeDependencyResolution,
  fallbackMessage?: string,
): string {
  const detail = describeRuntimeDependencyResolution(resolution);
  return detail || fallbackMessage || `${resolution.requestedDependencyId} is ${resolution.state}.`;
}
