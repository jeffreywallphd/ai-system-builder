import type {
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { IRunNodeAssignmentEligibilityService } from "@application/runs/ports/RunAssignmentEligibilityPorts";
import { toRunDetail, type RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { mapPlatformRunRecordToCanonicalRun } from "./RunCreationPersistenceMapper";

export interface SelectAssignmentReadyRunsRequest {
  readonly reservationOwner: string;
  readonly asOf?: string;
  readonly queueId?: string;
  readonly workspaceId?: string;
  readonly nodeId?: string;
  readonly limit?: number;
  readonly reservationTtlSeconds?: number;
}

export interface AssignmentReadySelectionItem {
  readonly run: RunDetail;
  readonly queue: {
    readonly queueId: string;
    readonly enteredAt: string;
    readonly eligibleAt: string;
    readonly orderKey: string;
    readonly claimToken: string;
    readonly claimExpiresAt: string;
  };
}

export interface SelectAssignmentReadyRunsResult {
  readonly asOf: string;
  readonly items: ReadonlyArray<AssignmentReadySelectionItem>;
}

interface SelectAssignmentReadyRunsUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly assignmentEligibilityService?: IRunNodeAssignmentEligibilityService;
  readonly now?: () => Date;
}

const DefaultLimit = 10;
const DefaultReservationTtlSeconds = 30;

export class SelectAssignmentReadyRunsUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: SelectAssignmentReadyRunsUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(input: SelectAssignmentReadyRunsRequest): Promise<SelectAssignmentReadyRunsResult> {
    const reservationOwner = normalizeOptional(input.reservationOwner);
    if (!reservationOwner) {
      return Object.freeze({
        asOf: this.now().toISOString(),
        items: Object.freeze([]),
      });
    }

    const asOf = normalizeOptional(input.asOf) ?? this.now().toISOString();
    const nodeId = normalizeOptional(input.nodeId);
    if (nodeId && !this.dependencies.assignmentEligibilityService) {
      return Object.freeze({
        asOf,
        items: Object.freeze([]),
      });
    }
    const claimed = await this.dependencies.queueRepository.claimAssignmentReadyRuns({
      asOf,
      reservationOwner,
      reservationTtlSeconds: normalizePositiveInteger(input.reservationTtlSeconds, DefaultReservationTtlSeconds),
      limit: normalizePositiveInteger(input.limit, DefaultLimit),
      queueId: normalizeOptional(input.queueId),
      workspaceId: normalizeOptional(input.workspaceId),
    });

    const items: AssignmentReadySelectionItem[] = [];
    for (const queueEntry of claimed) {
      if (!queueEntry.claimToken || !queueEntry.claimExpiresAt) {
        continue;
      }
      const run = await this.dependencies.runRepository.findRunById(queueEntry.runId);
      if (!run) {
        continue;
      }
      if (nodeId && this.dependencies.assignmentEligibilityService) {
        const eligibility = await this.dependencies.assignmentEligibilityService.evaluateNodeEligibility({
          asOf,
          run,
          queueEntry,
          nodeId,
        });
        if (!eligibility.eligible) {
          await this.dependencies.queueRepository.releaseRunClaim({
            runId: queueEntry.runId,
            claimToken: queueEntry.claimToken,
            releasedAt: asOf,
          });
          continue;
        }
      }
      items.push(Object.freeze({
        run: toRunDetail(mapPlatformRunRecordToCanonicalRun(run)),
        queue: Object.freeze({
          queueId: queueEntry.queueId,
          enteredAt: queueEntry.enteredAt,
          eligibleAt: queueEntry.eligibleAt,
          orderKey: queueEntry.orderKey,
          claimToken: queueEntry.claimToken,
          claimExpiresAt: queueEntry.claimExpiresAt,
        }),
      }));
    }

    return Object.freeze({
      asOf,
      items: Object.freeze(items),
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return value as number;
}
