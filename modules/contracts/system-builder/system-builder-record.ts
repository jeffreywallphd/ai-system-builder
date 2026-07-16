import type { AssetReference } from "../asset";
import type { AssetCompositionPlanId } from "../asset-composition";
import type { WorkspaceId } from "../workspace";
import type { SystemBuilderComposition } from "./system-builder-composition";
import type { SystemBuilderSystemId } from "./system-builder-id";
import type { SystemBuilderStatus } from "./system-builder-status";

/**
 * Workspace-owned design-time state for a composed system.
 *
 * Operational builder-application, host, installer, runtime, and resource-health
 * fields do not belong on this record.
 */
export interface SystemBuilderRecord {
  readonly systemId: SystemBuilderSystemId;
  readonly targetWorkspaceId: WorkspaceId;
  readonly name: string;
  readonly description?: string;
  readonly status: SystemBuilderStatus;
  readonly composition: SystemBuilderComposition;
  readonly sourceCompositionPlanId?: AssetCompositionPlanId;
  readonly systemDefinitionRef?: AssetReference;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string;
}
