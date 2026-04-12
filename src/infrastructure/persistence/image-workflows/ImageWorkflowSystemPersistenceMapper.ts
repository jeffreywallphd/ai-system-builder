import {
  rehydrateImageWorkflowDefinition,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  rehydrateImageSystemDefinition,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";

export interface ImageWorkflowDefinitionRecordRow {
  readonly workflow_id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly visibility: ImageWorkflowDefinition["ownership"]["visibility"];
  readonly operation_kind: string;
  readonly lifecycle_state: ImageWorkflowDefinition["lifecycleState"];
  readonly activation_status: ImageWorkflowDefinition["activationStatus"];
  readonly lineage_id: string;
  readonly version_tag: string;
  readonly revision: number;
  readonly translator_id: string;
  readonly template_id: string;
  readonly tags_json: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly persistence_revision: number;
  readonly schema_version: number;
  readonly definition_json: string;
}

export interface ImageSystemDefinitionRecordRow {
  readonly system_id: string;
  readonly workspace_id: string;
  readonly owner_user_id: string | null;
  readonly visibility: ImageSystemDefinition["ownership"]["visibility"];
  readonly sharing_policy_id: string | null;
  readonly workflow_id: string;
  readonly workflow_lineage_id: string;
  readonly workflow_version_tag: string;
  readonly workflow_revision: number;
  readonly lifecycle_state: ImageSystemDefinition["lifecycleState"];
  readonly runtime_status: ImageSystemDefinition["runtimeStatus"];
  readonly tags_json: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly persistence_revision: number;
  readonly schema_version: number;
  readonly definition_json: string;
}

export interface ImageWorkflowSystemMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: string;
  readonly record_kind: "workflow-definition" | "system-definition";
  readonly record_id: string;
  readonly record_snapshot_json: string;
  readonly actor_user_id: string;
  readonly correlation_id: string | null;
  readonly reason: string | null;
  readonly occurred_at: string;
  readonly created_at: string;
}

export function normalizeImageWorkflowSystemLookup(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeImageWorkflowSystemOperationKey(operationKey: string): string {
  const normalized = operationKey.trim();
  if (!normalized) {
    throw new Error("Image workflow/system mutation operationKey is required.");
  }
  return normalized;
}

export function mapImageWorkflowDefinitionToRowValues(input: {
  readonly workflow: ImageWorkflowDefinition;
  readonly persistenceRevision: number;
  readonly schemaVersion: number;
}): ReadonlyArray<unknown> {
  const { workflow } = input;
  return Object.freeze([
    workflow.workflowId,
    workflow.ownership.workspaceId,
    workflow.ownership.ownerUserId ?? null,
    workflow.ownership.visibility,
    workflow.operationKind,
    workflow.lifecycleState,
    workflow.activationStatus,
    workflow.version.lineageId,
    workflow.version.versionTag,
    workflow.version.revision,
    workflow.backendTranslation.translatorId,
    workflow.backendTranslation.templateId,
    JSON.stringify(workflow.display.tags),
    workflow.createdAt,
    workflow.updatedAt,
    input.persistenceRevision,
    input.schemaVersion,
    JSON.stringify(workflow),
  ]);
}

export function mapImageSystemDefinitionToRowValues(input: {
  readonly system: ImageSystemDefinition;
  readonly persistenceRevision: number;
  readonly schemaVersion: number;
}): ReadonlyArray<unknown> {
  const { system } = input;
  return Object.freeze([
    system.systemId,
    system.ownership.workspaceId,
    system.ownership.ownerUserId ?? null,
    system.ownership.visibility,
    system.ownership.sharingPolicyId ?? null,
    system.workflowBinding.workflowId,
    system.workflowBinding.workflowLineageId,
    system.workflowBinding.workflowVersionTag,
    system.workflowBinding.workflowRevision,
    system.lifecycleState,
    system.runtimeStatus,
    JSON.stringify(system.display.tags),
    system.createdAt,
    system.updatedAt,
    input.persistenceRevision,
    input.schemaVersion,
    JSON.stringify(system),
  ]);
}

export function mapImageWorkflowDefinitionRowToDomain(
  row: Pick<ImageWorkflowDefinitionRecordRow, "definition_json">,
): ImageWorkflowDefinition {
  return rehydrateImageWorkflowDefinition(parseJsonObject<ImageWorkflowDefinition>(
    row.definition_json,
    "Image workflow definition",
  ));
}

export function mapImageSystemDefinitionRowToDomain(
  row: Pick<ImageSystemDefinitionRecordRow, "definition_json">,
): ImageSystemDefinition {
  return rehydrateImageSystemDefinition(parseJsonObject<ImageSystemDefinition>(
    row.definition_json,
    "Image system definition",
  ));
}

export function parseWorkflowMutationReplayRow(
  row: ImageWorkflowSystemMutationReplayRow,
): ImageWorkflowDefinition {
  if (row.record_kind !== "workflow-definition") {
    throw new Error(
      `Image workflow mutation replay '${row.operation_key}' has incompatible record kind '${row.record_kind}'.`,
    );
  }

  return rehydrateImageWorkflowDefinition(parseJsonObject<ImageWorkflowDefinition>(
    row.record_snapshot_json,
    "Image workflow mutation replay",
  ));
}

export function parseSystemMutationReplayRow(
  row: ImageWorkflowSystemMutationReplayRow,
): ImageSystemDefinition {
  if (row.record_kind !== "system-definition") {
    throw new Error(
      `Image system mutation replay '${row.operation_key}' has incompatible record kind '${row.record_kind}'.`,
    );
  }

  return rehydrateImageSystemDefinition(parseJsonObject<ImageSystemDefinition>(
    row.record_snapshot_json,
    "Image system mutation replay",
  ));
}

export function parseTagsJson(tagsJson: string): ReadonlyArray<string> {
  const parsed = parseJsonObject<ReadonlyArray<unknown>>(tagsJson, "Image workflow/system tags");
  if (!Array.isArray(parsed)) {
    throw new Error("Image workflow/system tags payload must be an array.");
  }

  return Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string"));
}

function parseJsonObject<TValue>(payload: string, label: string): TValue {
  try {
    return JSON.parse(payload) as TValue;
  } catch {
    throw new Error(`${label} payload could not be parsed from persistence.`);
  }
}
