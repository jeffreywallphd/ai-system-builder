import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { UiDependencies } from "./types";
import { createUiDependencies } from "./createUiDependencies";
import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";

const UiDependenciesContext = createContext<UiDependencies | undefined>(undefined);

export interface AppProvidersProps extends PropsWithChildren {
  readonly config?: AppRuntimeConfig;
}

export function AppProviders({
  children,
  config,
}: AppProvidersProps): JSX.Element {
  const dependencies = useMemo(() => createUiDependencies({ config }), [config]);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async (): Promise<void> => {
      const startupTimeoutMs = dependencies.settingsStore.getSettings().runtime.startupTimeoutMs;
      const startedAt = Date.now();

      await dependencies.runtimeConsoleStore.initializeRuntime();

      while (!isCancelled) {
        try {
          await dependencies.mcpStore.initialize();
          await dependencies.runtimeConsoleStore.refreshHealth();
          await dependencies.workflowStore.refreshCurrentWorkflowMcpTooling();
          return;
        } catch {
          await dependencies.runtimeConsoleStore.refreshHealth().catch(() => undefined);

          if (Date.now() - startedAt >= startupTimeoutMs) {
            return;
          }

          await sleep(500);
        }
      }
    };

    void bootstrap().catch(() => undefined);

    return () => {
      isCancelled = true;
      dependencies.runtimeConsoleStore.dispose();
    };
  }, [dependencies]);

  return (
    <UiDependenciesContext.Provider value={dependencies}>
      {children}
    </UiDependenciesContext.Provider>
  );
}

export function useUiDependencies(): UiDependencies {
  const value = useContext(UiDependenciesContext);

  if (!value) {
    throw new Error("useUiDependencies must be used within AppProviders.");
  }

  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
