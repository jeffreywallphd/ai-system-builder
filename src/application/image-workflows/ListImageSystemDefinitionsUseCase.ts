import { runInTransactionBoundary } from "@application/common/ports/PlatformTransactionPorts";
import type { ImageSystemDefinition } from "@domain/systems/ImageSystemDomain";
import {
  ImageWorkflowSystemPermissionActions,
  type ImageSystemDefinitionListQuery,
  type ImageWorkflowSystemDefinitionPorts,
} from "./ports";
import type {
  ListImageSystemDefinitionsRequest,
  ListImageSystemDefinitionsResult,
} from "./ImageWorkflowSystemQueryContracts";
import {
  toImageSystemDefinitionListItem,
  toImageSystemDefinitionReadinessSummary,
} from "./ImageWorkflowSystemQueryContracts";
import {
  authorizeSystemQueryAction,
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

export class ListImageSystemDefinitionsUseCase {
  public constructor(
    private readonly ports: ImageWorkflowSystemDefinitionPorts,
  ) {}

  public async execute(request: ListImageSystemDefinitionsRequest): Promise<ListImageSystemDefinitionsResult> {
    const context = createQueryBoundaryContext({
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      occurredAt: request.occurredAt,
    });
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const search = normalizeOptional(request.search)?.toLowerCase();
    const workflowVersionTags = normalizeStringArray(request.workflowVersionTags);
    const workflowRevisions = normalizeRevisionArray(request.workflowRevisions);
    const repositoryQuery = toRepositoryQuery(request, context.workspaceId);
    const targetVisibleCount = offset + limit + 1;
    const batchSize = Math.min(BatchCeiling, Math.max(BatchFloor, limit * 2));
    const visible: ImageSystemDefinition[] = [];
    let repositoryOffset = 0;

    return runInTransactionBoundary(this.ports.transactionManager, async () => {
      await authorizeSystemQueryAction({
        ports: this.ports,
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        action: ImageWorkflowSystemPermissionActions.systemList,
        occurredAt: context.occurredAtIso,
        correlationId: request.correlationId,
      });

      while (visible.length < targetVisibleCount) {
        const batch = await this.ports.systemRepository.listSystemDefinitions({
          ...repositoryQuery,
          limit: batchSize,
          offset: repositoryOffset,
        });
        if (batch.length < 1) {
          break;
        }

        repositoryOffset += batch.length;
        const candidateRows = batch.filter((system) =>
          matchesSystemPostFilters(system, search, workflowVersionTags, workflowRevisions));
        const decisions = await Promise.all(candidateRows.map(async (system) => {
          try {
            await authorizeSystemQueryAction({
              ports: this.ports,
              workspaceId: context.workspaceId,
              actorUserId: context.actorUserId,
              action: ImageWorkflowSystemPermissionActions.systemRead,
              resourceId: system.systemId,
              ownerUserId: system.ownership.ownerUserId,
              visibility: system.ownership.visibility,
              sharingPolicyId: system.ownership.sharingPolicyId,
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
            const system = candidateRows[index];
            if (system) {
              visible.push(system);
            }
          }
        }

        if (batch.length < batchSize) {
          break;
        }
      }

      const paged = Object.freeze(visible
        .slice(offset, offset + limit)
        .map((system) => toImageSystemDefinitionListItem(
          system,
          toImageSystemDefinitionReadinessSummary(system, context.occurredAtIso),
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
  request: ListImageSystemDefinitionsRequest,
  workspaceId: string,
): ImageSystemDefinitionListQuery {
  return Object.freeze({
    workspaceId,
    ownerUserIds: normalizeStringArray(request.ownerUserIds),
    visibilities: normalizeVisibilityArray(request.visibilities),
    sharingPolicyIds: normalizeStringArray(request.sharingPolicyIds),
    workflowIds: normalizeStringArray(request.workflowIds),
    workflowLineageIds: normalizeStringArray(request.workflowLineageIds),
    lifecycleStates: request.lifecycleStates,
    runtimeStatuses: request.runtimeStatuses,
    tags: normalizeStringArray(request.tags),
    includeArchived: request.includeArchived,
  });
}

function matchesSystemPostFilters(
  system: ImageSystemDefinition,
  search: string | undefined,
  workflowVersionTags: ReadonlyArray<string> | undefined,
  workflowRevisions: ReadonlyArray<number> | undefined,
): boolean {
  if (workflowVersionTags && !workflowVersionTags.includes(system.workflowBinding.workflowVersionTag)) {
    return false;
  }
  if (workflowRevisions && !workflowRevisions.includes(system.workflowBinding.workflowRevision)) {
    return false;
  }
  if (!search) {
    return true;
  }

  const searchHaystack = `${system.systemId} ${system.display.title} ${system.display.summary ?? ""} ${system.display.tags.join(" ")}`
    .toLowerCase();
  return searchHaystack.includes(search);
}
