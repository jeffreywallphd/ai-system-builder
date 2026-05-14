import type {
  WorkspaceId,
  WorkspaceSystemPackActivation,
} from "../../../contracts/workspace";

/**
 * Persistence-only repository for workspace system-pack activation references.
 * It stores passed activation records only and does not validate, install, copy,
 * mutate, activate, or deactivate system pack definitions.
 */
export interface WorkspaceSystemPackActivationRepository {
  readonly listWorkspaceSystemPackActivations: (
    workspaceId: WorkspaceId,
  ) => Promise<readonly WorkspaceSystemPackActivation[]>;
  readonly readWorkspaceSystemPackActivation: (
    workspaceId: WorkspaceId,
    activationId: string,
  ) => Promise<WorkspaceSystemPackActivation | undefined>;
  readonly saveWorkspaceSystemPackActivation: (
    activation: WorkspaceSystemPackActivation,
  ) => Promise<void>;
  readonly updateWorkspaceSystemPackActivation: (
    activation: WorkspaceSystemPackActivation,
  ) => Promise<void>;
}
