import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
  type DesktopPostLoginWarmupTriggerSource,
  type DesktopRuntimeBootstrapBridge,
} from "../../../electron/shared/DesktopContracts";
import { requestDesktopPostLoginWarmup } from "./DesktopPostLoginWarmup";

const DefaultPollingIntervalMs = 900;
const MinBackoffPollingIntervalMs = 250;
const ReadyPollingIntervalMs = 2200;
const UnavailablePollingIntervalMs = 1400;
const FailedPollingBaseIntervalMs = 900;
const FailedPollingMaxIntervalMs = 7000;
const WarmingPollingMaxIntervalMs = 2600;
const BackoffMultiplier = 1.6;

export interface RendererRuntimeLifecycleService {
  readonly getRuntimeBridge: () => DesktopRuntimeBootstrapBridge | undefined;
  readonly getStatus: () => DesktopPostLoginRuntimeStatus | undefined;
  readonly isReady: (status?: DesktopPostLoginRuntimeStatus) => boolean;
  readonly activate: (triggerSource?: DesktopPostLoginWarmupTriggerSource) => Promise<void>;
}

export interface CreateRendererRuntimeLifecycleServiceOptions {
  readonly getRuntimeBridge?: () => DesktopRuntimeBootstrapBridge | undefined;
  readonly requestWarmup?: (triggerSource: DesktopPostLoginWarmupTriggerSource) => Promise<void>;
}

export interface UseRendererRuntimeLifecycleOptions {
  readonly enabled?: boolean;
  readonly activateOnMount?: boolean;
  readonly triggerSource?: DesktopPostLoginWarmupTriggerSource;
  readonly pollIntervalMs?: number;
}

export interface RendererRuntimeLifecycleState {
  readonly status?: DesktopPostLoginRuntimeStatus;
  readonly hasRuntimeBridge: boolean;
  readonly isReady: boolean;
  readonly isRetrying: boolean;
  readonly refresh: () => void;
  readonly retry: () => Promise<void>;
}

export function resolveRendererRuntimeBridge(): DesktopRuntimeBootstrapBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.aiLoomDesktop?.auth?.runtime ?? window.aiLoomDesktop?.runtime;
}

export function resolveRendererRuntimeStatus(
  bridge: DesktopRuntimeBootstrapBridge | undefined,
): DesktopPostLoginRuntimeStatus | undefined {
  if (!bridge) {
    return undefined;
  }
  return bridge.getLifecycleStatus?.() ?? bridge.getPostLoginRuntimeStatus?.();
}

export function resolveRendererRuntimeReadiness(input: {
  readonly bridge: DesktopRuntimeBootstrapBridge | undefined;
  readonly status: DesktopPostLoginRuntimeStatus | undefined;
}): boolean {
  if (!input.bridge) {
    return true;
  }
  if (input.status) {
    return input.status.state === DesktopPostLoginRuntimeStates.ready;
  }
  if (!input.bridge.isCapabilityReady && !input.bridge.isDeferredFeatureApiReady) {
    return true;
  }
  return input.bridge.isCapabilityReady?.() ?? input.bridge.isDeferredFeatureApiReady();
}

export function resolveRendererRuntimeRefreshStateKey(
  status: DesktopPostLoginRuntimeStatus | undefined,
): string {
  if (!status) {
    return "none";
  }
  const stageStateKey = status.activationStages
    ?.map((stage) => `${stage.stageId}:${stage.state}:${stage.blockingReadiness ? "blocking" : "non-blocking"}`)
    .join(",");
  const failureKey = status.failure
    ? `${status.failure.retryable === false ? "non-retryable" : "retryable"}:${status.failure.message ?? ""}`
    : "none";
  return [
    status.state,
    status.capabilityPhase,
    status.unavailableReason ?? "none",
    status.transport.phase,
    stageStateKey ?? "none",
    failureKey,
  ].join("|");
}

export function resolveRendererRuntimeRefreshIntervalMs(input: {
  readonly status: DesktopPostLoginRuntimeStatus | undefined;
  readonly stableRefreshCount: number;
  readonly defaultPollingIntervalMs?: number;
}): number {
  const defaultPollingIntervalMs = input.defaultPollingIntervalMs ?? DefaultPollingIntervalMs;
  if (!input.status) {
    return Math.max(defaultPollingIntervalMs, UnavailablePollingIntervalMs);
  }

  if (input.status.state === DesktopPostLoginRuntimeStates.ready) {
    return ReadyPollingIntervalMs;
  }

  if (input.status.state === DesktopPostLoginRuntimeStates.warming) {
    const raw = Math.max(
      defaultPollingIntervalMs,
      MinBackoffPollingIntervalMs * Math.pow(BackoffMultiplier, input.stableRefreshCount),
    );
    return Math.min(WarmingPollingMaxIntervalMs, Math.round(raw));
  }

  if (input.status.state === DesktopPostLoginRuntimeStates.failed) {
    const raw = Math.max(
      FailedPollingBaseIntervalMs,
      defaultPollingIntervalMs * Math.pow(BackoffMultiplier, input.stableRefreshCount),
    );
    return Math.min(FailedPollingMaxIntervalMs, Math.round(raw));
  }

  return Math.max(defaultPollingIntervalMs, UnavailablePollingIntervalMs);
}

export function createRendererRuntimeLifecycleService(
  options: CreateRendererRuntimeLifecycleServiceOptions = {},
): RendererRuntimeLifecycleService {
  const getRuntimeBridge = options.getRuntimeBridge ?? resolveRendererRuntimeBridge;
  const requestWarmup = options.requestWarmup ?? requestDesktopPostLoginWarmup;
  return Object.freeze({
    getRuntimeBridge,
    getStatus: () => resolveRendererRuntimeStatus(getRuntimeBridge()),
    isReady: (status) => resolveRendererRuntimeReadiness({
      bridge: getRuntimeBridge(),
      status,
    }),
    activate: async (triggerSource = DesktopPostLoginWarmupTriggerSources.featureDemand) => {
      await requestWarmup(triggerSource);
    },
  });
}

export function useRendererRuntimeLifecycle(
  options: UseRendererRuntimeLifecycleOptions = {},
): RendererRuntimeLifecycleState {
  const enabled = options.enabled ?? true;
  const activateOnMount = options.activateOnMount ?? false;
  const triggerSource = options.triggerSource ?? DesktopPostLoginWarmupTriggerSources.featureDemand;
  const pollIntervalMs = options.pollIntervalMs ?? DefaultPollingIntervalMs;
  const service = useMemo(() => createRendererRuntimeLifecycleService(), []);
  const [status, setStatus] = useState<DesktopPostLoginRuntimeStatus | undefined>(() => (
    enabled ? service.getStatus() : undefined
  ));
  const [hasRuntimeBridge, setHasRuntimeBridge] = useState<boolean>(() => (
    enabled ? Boolean(service.getRuntimeBridge()) : false
  ));
  const [isRetrying, setIsRetrying] = useState(false);
  const stableRefreshCountRef = useRef(0);
  const previousRefreshStateKeyRef = useRef<string>(resolveRendererRuntimeRefreshStateKey(status));

  const refreshRuntimeSnapshot = useCallback((resetBackoff: boolean) => {
    if (!enabled) {
      setStatus(undefined);
      setHasRuntimeBridge(false);
      stableRefreshCountRef.current = 0;
      previousRefreshStateKeyRef.current = resolveRendererRuntimeRefreshStateKey(undefined);
      return;
    }
    const nextBridge = service.getRuntimeBridge();
    const nextStatus = service.getStatus();
    setHasRuntimeBridge(Boolean(nextBridge));
    const nextKey = resolveRendererRuntimeRefreshStateKey(nextStatus);
    if (resetBackoff || previousRefreshStateKeyRef.current !== nextKey) {
      stableRefreshCountRef.current = 0;
    } else {
      stableRefreshCountRef.current += 1;
    }
    previousRefreshStateKeyRef.current = nextKey;
    setStatus(nextStatus);
  }, [enabled, service]);

  const refresh = useCallback(() => {
    refreshRuntimeSnapshot(true);
  }, [refreshRuntimeSnapshot]);

  useEffect(() => {
    if (!enabled) {
      setStatus(undefined);
      return;
    }
    refreshRuntimeSnapshot(true);
  }, [enabled, refreshRuntimeSnapshot]);

  useEffect(() => {
    if (!enabled || !activateOnMount) {
      return;
    }
    void service.activate(triggerSource).finally(() => {
      refreshRuntimeSnapshot(true);
    });
  }, [activateOnMount, enabled, refreshRuntimeSnapshot, service, triggerSource]);

  useEffect(() => {
    if (!enabled || !service.getRuntimeBridge()) {
      return;
    }
    const interval = resolveRendererRuntimeRefreshIntervalMs({
      status,
      stableRefreshCount: stableRefreshCountRef.current,
      defaultPollingIntervalMs: pollIntervalMs,
    });
    const timer = window.setTimeout(() => {
      refreshRuntimeSnapshot(false);
    }, interval);
    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, pollIntervalMs, refreshRuntimeSnapshot, service, status]);

  useEffect(() => {
    if (!enabled || !hasRuntimeBridge || typeof window === "undefined") {
      return;
    }
    const handleFocus = () => {
      refreshRuntimeSnapshot(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshRuntimeSnapshot(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, hasRuntimeBridge, refreshRuntimeSnapshot]);

  const retry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await service.activate(triggerSource);
      refreshRuntimeSnapshot(true);
    } finally {
      setIsRetrying(false);
    }
  }, [refreshRuntimeSnapshot, service, triggerSource]);

  return Object.freeze({
    status,
    hasRuntimeBridge,
    isReady: service.isReady(status),
    isRetrying,
    refresh,
    retry,
  });
}
