import { useCallback, useEffect, useMemo, useState } from "react";

import { createDesktopPythonRuntimeClient, type DesktopPythonRuntimeClient } from "../api/desktopPythonRuntimeClient";

export interface UsePythonRuntimeFooterOptions {
  enabled: boolean;
  client?: DesktopPythonRuntimeClient;
}

export interface UsePythonRuntimeFooterResult {
  statusLabel: string;
  healthLabel: string;
  capabilitiesLabel: string;
  logs: Array<{ timestamp: string; level: "info" | "warn" | "error"; message: string }>;
  loading: boolean;
  error?: string;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function usePythonRuntimeFooter(options: UsePythonRuntimeFooterOptions): UsePythonRuntimeFooterResult {
  const client = useMemo(
    () => options.client ?? createDesktopPythonRuntimeClient(),
    [options.client],
  );
  const [statusLabel, setStatusLabel] = useState("unknown");
  const [healthLabel, setHealthLabel] = useState("unknown");
  const [capabilitiesLabel, setCapabilitiesLabel] = useState("none");
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: "info" | "warn" | "error"; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<DesktopPythonRuntimeClient["readStatus"]>>) => {
    setStatusLabel(snapshot.supervisorStatus);
    setHealthLabel(snapshot.healthy ? "healthy" : "unhealthy");
    setCapabilitiesLabel(snapshot.capabilities.length > 0 ? snapshot.capabilities.join(", ") : "none");
    setLogs(snapshot.logs);
  }, []);

  const onRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await client.readStatus();
      applySnapshot(snapshot);
      setError(undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load runtime status.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, client]);

  const runControl = useCallback(async (action: "start" | "stop" | "restart") => {
    setLoading(true);
    try {
      const snapshot = await client.controlRuntime(action);
      applySnapshot(snapshot);
      setError(undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Runtime action failed.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, client]);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    void onRefresh();
    const timer = setInterval(() => {
      void onRefresh();
    }, 2_500);

    return () => {
      clearInterval(timer);
    };
  }, [onRefresh, options.enabled]);

  return {
    statusLabel,
    healthLabel,
    capabilitiesLabel,
    logs,
    loading,
    error,
    onStart: () => runControl("start"),
    onStop: () => runControl("stop"),
    onRestart: () => runControl("restart"),
    onRefresh,
  };
}
