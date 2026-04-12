import type { IRunOrchestrationQueuePersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAsOf(value: string | undefined, now: () => Date): string {
  const candidate = normalizeOptional(value) ?? now().toISOString();
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new ListStaleSchedulingReservationsValidationError("asOf must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

export class ListStaleSchedulingReservationsValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ListStaleSchedulingReservationsValidationError";
  }
}

export interface SchedulingStaleQueueReservation {
  readonly runId: string;
  readonly queueId: string;
  readonly workspaceId?: string;
  readonly claimToken: string;
  readonly claimedBy: string;
  readonly claimedAt: string;
  readonly claimExpiresAt: string;
  readonly staleSeconds: number;
}

export interface ListStaleSchedulingReservationsRequest {
  readonly workspaceId: string;
  readonly queueId?: string;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListStaleSchedulingReservationsResult {
  readonly asOf: string;
  readonly totalCount: number;
  readonly items: ReadonlyArray<SchedulingStaleQueueReservation>;
}

export class ListStaleSchedulingReservationsUseCase {
  private readonly now: () => Date;

  public constructor(
    private readonly dependencies: {
      readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
      readonly now?: () => Date;
    },
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(input: ListStaleSchedulingReservationsRequest): Promise<ListStaleSchedulingReservationsResult> {
    const workspaceId = normalizeOptional(input.workspaceId);
    if (!workspaceId) {
      throw new ListStaleSchedulingReservationsValidationError("workspaceId is required.");
    }

    const asOf = normalizeAsOf(input.asOf, this.now);
    const limit = Math.max(1, Math.min(200, input.limit ?? 50));
    const offset = Math.max(0, input.offset ?? 0);
    const queueId = normalizeOptional(input.queueId);

    const staleReservations = this.dependencies.queueRepository.listStaleQueueReservations
      ? await this.dependencies.queueRepository.listStaleQueueReservations({
        asOf,
        workspaceId,
        queueId,
        limit,
        offset,
      })
      : await this.fallbackListStaleReservations({
        asOf,
        workspaceId,
        queueId,
        limit,
        offset,
      });

    return Object.freeze({
      asOf,
      totalCount: staleReservations.length,
      items: Object.freeze(staleReservations.map((entry) => this.toStaleReservation(entry, asOf))),
    });
  }

  private async fallbackListStaleReservations(input: {
    readonly asOf: string;
    readonly workspaceId: string;
    readonly queueId?: string;
    readonly limit: number;
    readonly offset: number;
  }) {
    if (!this.dependencies.queueRepository.listQueueEntries) {
      return Object.freeze([]);
    }
    const queueEntries = await this.dependencies.queueRepository.listQueueEntries({
      workspaceId: input.workspaceId,
      queueId: input.queueId,
      includeDequeued: false,
      limit: input.limit,
      offset: input.offset,
    });
    return Object.freeze(queueEntries
      .filter((entry) => Boolean(entry.claimToken && entry.claimedBy && entry.claimedAt && entry.claimExpiresAt))
      .filter((entry) => Date.parse(entry.claimExpiresAt!) <= Date.parse(input.asOf))
      .map((entry) => Object.freeze({
        runId: entry.runId,
        queueId: entry.queueId,
        workspaceId: entry.workspaceId,
        claimToken: entry.claimToken!,
        claimedBy: entry.claimedBy!,
        claimedAt: entry.claimedAt!,
        claimExpiresAt: entry.claimExpiresAt!,
      })));
  }

  private toStaleReservation(
    entry: {
      readonly runId: string;
      readonly queueId: string;
      readonly workspaceId?: string;
      readonly claimToken: string;
      readonly claimedBy: string;
      readonly claimedAt: string;
      readonly claimExpiresAt: string;
    },
    asOf: string,
  ): SchedulingStaleQueueReservation {
    const staleSeconds = Math.max(
      0,
      Math.floor((Date.parse(asOf) - Date.parse(entry.claimExpiresAt)) / 1000),
    );
    return Object.freeze({
      ...entry,
      staleSeconds,
    });
  }
}

