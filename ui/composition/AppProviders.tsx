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
    void dependencies.runtimeConsoleStore.initializeRuntime();
    void dependencies.mcpStore.refresh().catch(() => undefined);

    return () => {
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
