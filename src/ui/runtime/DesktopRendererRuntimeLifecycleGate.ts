import {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
  type DesktopPostLoginWarmupTriggerSource,
} from "../../../electron/shared/DesktopContracts";
import { requestDesktopPostLoginWarmup } from "./DesktopPostLoginWarmup";
import {
  resolveRendererRuntimeBridge,
  resolveRendererRuntimeReadiness,
  resolveRendererRuntimeStatus,
} from "./RendererRuntimeLifecycleService";

export const DesktopRendererRuntimeLifecycleUnavailableCode = "AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE";
export const DesktopRendererRuntimeLifecycleUnavailableDetail = "Desktop runtime APIs are unavailable until post-login lifecycle readiness is reached.";

export interface DesktopRendererRuntimeLifecycleUnavailableError {
  readonly code: typeof DesktopRendererRuntimeLifecycleUnavailableCode;
  readonly message: string;
}

export interface ResolveDesktopRendererRuntimeLifecycleGateOptions {
  readonly apiPath: string;
  readonly triggerSource?: DesktopPostLoginWarmupTriggerSource;
}

export type DesktopRendererRuntimeLifecycleGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DesktopRendererRuntimeLifecycleUnavailableError };

export function resolveDesktopRendererRuntimeLifecycleGate(
  options: ResolveDesktopRendererRuntimeLifecycleGateOptions,
): DesktopRendererRuntimeLifecycleGateResult {
  const runtimeBridge = resolveRendererRuntimeBridge();
  if (!runtimeBridge) {
    return Object.freeze({ ok: true });
  }

  const runtimeStatus = resolveRendererRuntimeStatus(runtimeBridge);
  const isReady = resolveRendererRuntimeReadiness({
    bridge: runtimeBridge,
    status: runtimeStatus,
  });
  if (isReady) {
    return Object.freeze({ ok: true });
  }

  void requestDesktopPostLoginWarmup(options.triggerSource ?? DesktopPostLoginWarmupTriggerSources.featureDemand)
    .catch(() => undefined);

  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: DesktopRendererRuntimeLifecycleUnavailableCode,
      message: buildLifecycleUnavailableMessage(options.apiPath, runtimeStatus),
    }),
  });
}

function buildLifecycleUnavailableMessage(
  apiPath: string,
  status: DesktopPostLoginRuntimeStatus | undefined,
): string {
  if (!status) {
    return `${DesktopRendererRuntimeLifecycleUnavailableDetail} Requested API: ${apiPath}.`;
  }

  const unavailableReason = status.unavailableReason ? ` (${status.unavailableReason})` : "";
  return `${DesktopRendererRuntimeLifecycleUnavailableDetail} Current runtime state: ${status.state}${unavailableReason}; capability=${status.capabilityPhase}; transport=${status.transport.phase}. Requested API: ${apiPath}.`;
}
