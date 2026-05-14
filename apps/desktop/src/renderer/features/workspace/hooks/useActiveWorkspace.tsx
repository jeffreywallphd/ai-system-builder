import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type WorkspaceUiStatus = "active" | "archived";

export interface WorkspaceUiRecord {
  id: string;
  displayName: string;
  status: WorkspaceUiStatus;
  includeSystemFoundationAssets?: boolean;
  createdAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  includeSystemFoundationAssets: boolean;
}

export interface ActiveWorkspaceContextValue {
  workspaces: readonly WorkspaceUiRecord[];
  activeWorkspace?: WorkspaceUiRecord;
  activeWorkspaceId?: string;
  loading: boolean;
  error?: string;
  selectWorkspace: (workspaceId: string) => void;
  clearActiveWorkspace: () => void;
  createWorkspace: (input: CreateWorkspaceInput) => WorkspaceUiRecord;
}

export const DESKTOP_WORKSPACE_STORAGE_KEY = "ai-system-builder.desktop.workspaces";
export const DESKTOP_ACTIVE_WORKSPACE_STORAGE_KEY = "ai-system-builder.desktop.activeWorkspaceId";

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createWorkspaceId(name: string, existing: readonly WorkspaceUiRecord[]): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";
  let candidate = base;
  let suffix = 2;
  const ids = new Set(existing.map((workspace) => workspace.id));
  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | undefined>(undefined);

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceUiRecord[]>(() => safeReadJson<WorkspaceUiRecord[]>(DESKTOP_WORKSPACE_STORAGE_KEY, []));
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>(() => (typeof window === "undefined" ? undefined : window.localStorage.getItem(DESKTOP_ACTIVE_WORKSPACE_STORAGE_KEY) ?? undefined));
  const [error, setError] = useState<string | undefined>(undefined);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId && workspace.status === "active"),
    [activeWorkspaceId, workspaces],
  );

  const persistWorkspaces = useCallback((nextWorkspaces: WorkspaceUiRecord[]) => {
    setWorkspaces(nextWorkspaces);
    safeWriteJson(DESKTOP_WORKSPACE_STORAGE_KEY, nextWorkspaces);
  }, []);

  const selectWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace) {
      setError("That workspace is not available. Select another workspace or create a new one.");
      return;
    }
    if (workspace.status === "archived") {
      setError("That workspace is archived. Select another workspace or create a new one.");
      return;
    }
    setError(undefined);
    setActiveWorkspaceId(workspace.id);
    if (typeof window !== "undefined") window.localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_STORAGE_KEY, workspace.id);
  }, [workspaces]);

  const clearActiveWorkspace = useCallback(() => {
    setError(undefined);
    setActiveWorkspaceId(undefined);
    if (typeof window !== "undefined") window.localStorage.removeItem(DESKTOP_ACTIVE_WORKSPACE_STORAGE_KEY);
  }, []);

  const createWorkspace = useCallback((input: CreateWorkspaceInput) => {
    const displayName = input.name.trim();
    if (!displayName) {
      setError("Enter a workspace name.");
      throw new Error("Enter a workspace name.");
    }
    const workspace: WorkspaceUiRecord = {
      id: createWorkspaceId(displayName, workspaces),
      displayName,
      status: "active",
      includeSystemFoundationAssets: input.includeSystemFoundationAssets,
      createdAt: new Date().toISOString(),
    };
    const nextWorkspaces = [...workspaces, workspace];
    persistWorkspaces(nextWorkspaces);
    setActiveWorkspaceId(workspace.id);
    if (typeof window !== "undefined") window.localStorage.setItem(DESKTOP_ACTIVE_WORKSPACE_STORAGE_KEY, workspace.id);
    setError(undefined);
    return workspace;
  }, [persistWorkspaces, workspaces]);

  const value = useMemo<ActiveWorkspaceContextValue>(() => ({
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading: false,
    error: error ?? (activeWorkspaceId && !activeWorkspace ? "The selected workspace is unavailable. Select another workspace or create a new one." : undefined),
    selectWorkspace,
    clearActiveWorkspace,
    createWorkspace,
  }), [activeWorkspace, activeWorkspaceId, clearActiveWorkspace, createWorkspace, error, selectWorkspace, workspaces]);

  return <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>;
}

export function useActiveWorkspace(): ActiveWorkspaceContextValue {
  const context = useContext(ActiveWorkspaceContext);
  if (!context) {
    throw new Error("useActiveWorkspace must be used inside ActiveWorkspaceProvider.");
  }
  return context;
}
