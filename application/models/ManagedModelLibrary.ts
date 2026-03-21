import type { ModelLibraryTruthState } from "../ports/interfaces/IWorkflowExecutor";

export interface ManagedModelLibraryItem {
  readonly id: string;
  readonly name: string;
  readonly state: ModelLibraryTruthState;
  readonly location?: string;
  readonly detail: string;
  readonly registered: boolean;
  readonly verified: boolean;
}

export interface ManagedModelLibrarySnapshot {
  readonly mode: "managed-local" | "browser-download-fallback";
  readonly location: string;
  readonly detail: string;
  readonly items: ReadonlyArray<ManagedModelLibraryItem>;
}
