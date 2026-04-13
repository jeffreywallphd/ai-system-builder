import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
  type DesktopPostLoginWarmupTriggerSource,
  type DesktopRuntimeBootstrapBridge,
} from "../../../electron/shared/DesktopContracts";
import { requestDesktopPostLoginWarmup } from "./DesktopPostLoginWarmup";

const DefaultPollingIntervalMs = 900;

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
  const [isRetrying, setIsRetrying] = useState(false);

  const refresh = useCallback(() => {
    if (!enabled) {
      setStatus(undefined);
      return;
    }
    setStatus(service.getStatus());
  }, [enabled, service]);

  useEffect(() => {
    if (!enabled) {
      setStatus(undefined);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !activateOnMount) {
      return;
    }
    void service.activate(triggerSource).finally(() => {
      refresh();
    });
  }, [activateOnMount, enabled, refresh, service, triggerSource]);

  useEffect(() => {
    if (!enabled || !service.getRuntimeBridge()) {
      return;
    }
    const interval = window.setInterval(() => {
      refresh();
    }, pollIntervalMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, refresh, service]);

  const retry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await service.activate(triggerSource);
      refresh();
    } finally {
      setIsRetrying(false);
    }
  }, [refresh, service, triggerSource]);

  return Object.freeze({
    status,
    isReady: service.isReady(status),
    isRetrying,
    refresh,
    retry,
  });
}
