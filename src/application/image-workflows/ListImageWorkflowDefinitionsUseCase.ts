import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import type { ImageWorkflowDefinition } from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageWorkflowDefinitionListQuery,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  ListImageWorkflowDefinitionsRequest,
  ListImageWorkflowDefinitionsResult,
} from "./ImageWorkflowSystemQueryContracts";
import {
  toImageWorkflowDefinitionListItem,
  toImageWorkflowDefinitionReadinessSummary,
} from "./ImageWorkflowSystemQueryContracts";
import {
  authorizeWorkflowQueryAction,
  createQueryBoundaryContext,
  isHiddenByAuthorization,
  normalizeLimit,
  normalizeOffset,
  normalizeOptional,
  normalizeRevisionArray,
  normalizeStringArray,
  normalizeVisibilityArray,
} from "./ImageWorkflowSystemQueryShared";

const BatchFloor = 50;
const BatchCeiling = 100;

export class ListImageWorkflowDefinitionsUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: ListImageWorkflowDefinitionsRequest): Promise<ListImageWorkflowDefinitionsResult> {
    const context = createQueryBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      occurredAt: request.occurredAt,
    });
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const search = normalizeOptional(request.search)?.toLowerCase();
    const versionTags = normalizeStringArray(request.versionTags);
    const revisions = normalizeRevisionArray(request.revisions);
    const repositoryQuery = toRepositoryQuery(request, context.workspaceId);
    const targetVisibleCount = offset + limit + 1;
    const batchSize = Math.min(BatchCeiling, Math.max(BatchFloor, limit * 2));
    const visible: ImageWorkflowDefinition[] = [];
    let repositoryOffset = 0;

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      await authorizeWorkflowQueryAction({
        ports: this.ports,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.workflowList,
        occurredAt: context.occurredAtIso,
        correlationId: request.correlationId,
      });

      while (visible.length < targetVisibleCount) {
        const batch = await this.ports.workflowRepository.listWorkflowDefinitions({
          ...repositoryQuery,
          limit: batchSize,
          offset: repositoryOffset,
        });
        if (batch.length < 1) {
          break;
        }

        repositoryOffset += batch.length;
        const candidateRows = batch.filter((workflow) =>
          matchesWorkflowPostFilters(workflow, search, versionTags, revisions));
        const decisions = await Promise.all(candidateRows.map(async (workflow) => {
          try {
            await authorizeWorkflowQueryAction({
              ports: this.ports,
              workspaceId: context.workspaceId,
              actorUserId: context.actorUserId,
              action: ImageWorkflowSystemPermissionActions.workflowRead,
              resourceId: workflow.workflowId,
              ownerUserId: workflow.ownership.ownerUserId,
              visibility: workflow.ownership.visibility,
              occurredAt: context.occurredAtIso,
              correlationId: request.correlationId,
            });
            return true;
          } catch (error) {
            if (isHiddenByAuthorization(error)) {
              return false;
            }
            throw error;
          }
        }));

        for (let index = 0; index < candidateRows.length; index += 1) {
          if (decisions[index]) {
            const workflow = candidateRows[index];
            if (workflow) {
              visible.push(workflow);
            }
          }
        }

        if (batch.length < batchSize) {
          break;
        }
      }

      const paged = Object.freeze(visible
        .slice(offset, offset + limit)
        .map((workflow) => toImageWorkflowDefinitionListItem(
          workflow,
          toImageWorkflowDefinitionReadinessSummary(workflow, context.occurredAtIso),
        )));
      const hasMore = visible.length > (offset + limit);

      return Object.freeze({
        items: paged,
        pagination: Object.freeze({
          limit,
          offset,
          returned: paged.length,
          hasMore,
        }),
      });
    });
  }
}

function toRepositoryQuery(
  request: ListImageWorkflowDefinitionsRequest,
  workspaceId: string,
): ImageWorkflowDefinitionListQuery {
  return Object.freeze({
    workspaceId,
    ownerUserIds: normalizeStringArray(request.ownerUserIds),
    visibilities: normalizeVisibilityArray(request.visibilities),
    operationKinds: normalizeStringArray(request.operationKinds),
    lifecycleStates: request.lifecycleStates,
    activationStatuses: request.activationStatuses,
    lineageIds: normalizeStringArray(request.lineageIds),
    tags: normalizeStringArray(request.tags),
    includeRetired: request.includeRetired,
  });
}

function matchesWorkflowPostFilters(
  workflow: ImageWorkflowDefinition,
  search: string | undefined,
  versionTags: ReadonlyArray<string> | undefined,
  revisions: ReadonlyArray<number> | undefined,
): boolean {
  if (versionTags && !versionTags.includes(workflow.version.versionTag)) {
    return false;
  }
  if (revisions && !revisions.includes(workflow.version.revision)) {
    return false;
  }
  if (!search) {
    return true;
  }

  const searchHaystack = `${workflow.workflowId} ${workflow.display.title} ${workflow.display.summary ?? ""} ${workflow.display.tags.join(" ")}`
    .toLowerCase();
  return searchHaystack.includes(search);
}
