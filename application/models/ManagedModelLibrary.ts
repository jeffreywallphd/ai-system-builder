import type { ModelLibraryTruthState } from "../ports/interfaces/IWorkflowExecutor";

export interface ManagedModelLibraryItem {
  readonly id: string;
  readonly name: string;
  readonly state: ModelLibraryTruthState;
  readonly location?: string;
  readonly detail: string;
  readonly registered: boolean;
  readonly verified: boolean;
  readonly sourceOfTruth: "catalog" | "filesystem" | "catalog-and-filesystem" | "browser-download-fallback";
  readonly artifactCount?: number;
  readonly presentArtifactCount?: number;
  readonly missingArtifactCount?: number;
  readonly verificationErrors?: ReadonlyArray<string>;
}

export interface ManagedModelLibrarySnapshot {
  readonly mode: "managed-local" | "browser-download-fallback";
  readonly location: string;
  readonly detail: string;
  readonly sourceOfTruth: "managed-local-filesystem" | "browser-download-fallback";
  readonly recordedAt: Date;
  readonly items: ReadonlyArray<ManagedModelLibraryItem>;
}
