import type { ExploreAssetSummary } from "@application/asset-registry/ExploreAssetQueryService";
import { RegistryService } from "../services/RegistryService";
import {
  buildWorkflowStudioOpenExistingPath,
  buildWorkflowStudioResumeDraftPath,
} from "../studio-shell/workflow/WorkflowStudioEntryRouting";
import {
  buildWorkflowStudioRunDetailPath,
  buildWorkflowStudioRunHistoryPath,
} from "../studio-shell/workflow/WorkflowStudioRunRouting";
import { RunContextKinds, RunInterfaceService } from "./RunInterface";

export interface PersistedWorkflowEntry {
  readonly workflowId: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly status: "draft" | "saved";
  readonly updatedAt?: string;
}

export interface PersistedWorkflowEntryResult {
  readonly ok: boolean;
  readonly data?: ReadonlyArray<PersistedWorkflowEntry>;
  readonly error?: string;
}

function toPersistedWorkflowEntry(asset: ExploreAssetSummary): PersistedWorkflowEntry | undefined {
  if (asset.taxonomy?.semanticRole !== "workflow" || asset.metadata.sourceType !== "workflow-persistence") {
    return undefined;
  }
  if (asset.status !== "draft" && asset.status !== "saved") {
    return undefined;
  }
  return Object.freeze({
    workflowId: asset.id.assetId,
    displayName: asset.displayName,
    summary: asset.metadata.summary,
    status: asset.status,
    updatedAt: asset.metadata.lastModifiedAt,
  });
}

export class PersistedWorkflowEntryService {
  constructor(
    private readonly registryService = new RegistryService(),
    private readonly runInterfaceService = new RunInterfaceService(),
  ) {}

  public async listEntries(limit = 8): Promise<PersistedWorkflowEntryResult> {
    try {
      const response = await this.registryService.searchExploreAssets({
        limit,
        filters: {
          semanticRoles: Object.freeze(["workflow"]),
          sourceTypes: Object.freeze(["workflow-persistence"]),
        },
      });
      if (!response.ok || !response.data) {
        return Object.freeze({
          ok: false,
          error: response.error?.message ?? "Failed to load persisted workflows.",
        });
      }

      const entries = response.data.assets
        .map((asset) => toPersistedWorkflowEntry(asset))
        .filter((asset): asset is PersistedWorkflowEntry => Boolean(asset));
      return Object.freeze({
        ok: true,
        data: Object.freeze(entries),
      });
    } catch {
      return Object.freeze({
        ok: false,
        error: "Failed to load persisted workflows.",
      });
    }
  }

  public buildWorkflowStudioOpenPath(entry: PersistedWorkflowEntry): string {
    return entry.status === "draft"
      ? buildWorkflowStudioResumeDraftPath(entry.workflowId)
      : buildWorkflowStudioOpenExistingPath(entry.workflowId);
  }

  public buildRunWorkflowPath(entry: PersistedWorkflowEntry): string {
    return this.runInterfaceService.resolveLaunchPath({
      contextKind: RunContextKinds.workflow,
      workflowId: entry.workflowId,
      workflowStatus: entry.status,
      assetId: entry.workflowId,
      source: "run",
      runIntentLabel: "Run workflow",
      actionKind: "run",
      originPath: "/run",
      originLabel: "Run",
    });
  }

  public buildWorkflowRunHistoryPath(entry: PersistedWorkflowEntry): string {
    return buildWorkflowStudioRunHistoryPath({
      workflowId: entry.workflowId,
      workflowStatus: entry.status,
    });
  }

  public buildWorkflowRunDetailPath(entry: PersistedWorkflowEntry, runId: string): string {
    return buildWorkflowStudioRunDetailPath(runId, {
      workflowId: entry.workflowId,
      workflowStatus: entry.status,
    });
  }
}

