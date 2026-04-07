import { describe, expect, it } from "bun:test";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditScopeKinds,
  createCanonicalAuditEvent,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "../AuditApplicationContracts";
import {
  AuditLedgerQueryErrorCodes,
  AuditLedgerQueryService,
  type AuditLedgerQueryReadScope,
  type AuditLedgerQueryAuthorizer,
} from "../use-cases/AuditLedgerQueryService";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public readonly events: CanonicalAuditEvent[];

  public listQuery?: AuditLedgerQuery;

  public countQuery?: AuditLedgerQuery;

  public constructor(events: CanonicalAuditEvent[]) {
    this.events = events;
  }

  public async appendAuditEvent(
    event: CanonicalAuditEvent,
    _context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    this.events.push(event);
    return {
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event,
    };
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    this.listQuery = query;
    const limit = query.pagination?.limit ?? query.limit ?? this.events.length;
    return this.events.slice(0, limit);
  }

  public async countAuditEvents(query: AuditLedgerQuery): Promise<number> {
    this.countQuery = query;
    return this.events.length;
  }
}

class StaticAuthorizer implements AuditLedgerQueryAuthorizer {
  public constructor(private readonly decision: {
    readonly allowed: boolean;
    readonly scope?: AuditLedgerQueryReadScope;
    readonly reason?: string;
  }) {}

  public async authorizeAuditLedgerRead(_input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<{
    readonly allowed: boolean;
    readonly scope?: AuditLedgerQueryReadScope;
    readonly reason?: string;
  }> {
    return this.decision;
  }
}

function createEvent(eventId: string, occurredAt: string): CanonicalAuditEvent {
  return createCanonicalAuditEvent({
    eventId,
    eventType: "workspace-policy-updated",
    category: AuditEventCategories.policy,
    action: "policy.updated",
    outcome: "succeeded",
    occurredAt,
    actor: {
      actorId: "user:auditor",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:auditor",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace:alpha",
    },
    protectedResource: {
      resourceType: "policy",
      resourceId: "policy:alpha",
      resourceRef: "policy:alpha",
      sensitivityClass: "sensitive",
      workspaceId: "workspace:alpha",
    },
    payload: {
      hasProtectedData: false,
      redactionReasons: [],
      userSafeDetails: {
        reason: "updated",
      },
    },
    integrity: {
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    },
  });
}

describe("AuditLedgerQueryService", () => {
  it("returns invalid-request when requesterId is missing", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const service = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({ allowed: true }),
    });

    const outcome = await service.listAuditEvents({
      requesterId: " ",
      query: {},
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }

    expect(outcome.error.code).toBe(AuditLedgerQueryErrorCodes.invalidRequest);
  });

  it("returns forbidden when read access is denied", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const service = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({
        allowed: false,
        reason: "missing governance permission",
      }),
    });

    const outcome = await service.listAuditEvents({
      requesterId: "user:auditor",
      query: {},
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }

    expect(outcome.error.code).toBe(AuditLedgerQueryErrorCodes.forbidden);
    expect(outcome.error.message).toContain("missing governance permission");
  });

  it("applies logical scope constraints for workspace, actor, and resources", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createEvent("audit:event:1", "2026-04-07T19:00:00.000Z"),
    ]);
    const service = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({
        allowed: true,
        scope: {
          workspaceIds: ["workspace:alpha"],
          actorIds: ["user:auditor"],
          resourceTypes: ["policy"],
          resourceIds: ["policy:alpha"],
          enforceThinSafeOnly: true,
          canReadProtectedData: false,
        },
      }),
    });

    const outcome = await service.listAuditEvents({
      requesterId: "user:auditor",
      query: {
        workspaceId: "workspace:alpha",
        filters: {
          workspaceIds: ["workspace:alpha", "workspace:beta"],
          actorIds: ["user:auditor", "user:other"],
          resourceTypes: ["policy", "secret"],
          resourceIds: ["policy:alpha", "policy:beta"],
          hasProtectedData: false,
        },
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(repository.listQuery?.filters?.workspaceIds).toEqual(["workspace:alpha"]);
    expect(repository.listQuery?.filters?.actorIds).toEqual(["user:auditor"]);
    expect(repository.listQuery?.filters?.resourceTypes).toEqual(["policy"]);
    expect(repository.listQuery?.filters?.resourceIds).toEqual(["policy:alpha"]);
    expect(repository.listQuery?.filters?.includeThinSafeOnly).toBeTrue();
    expect(repository.listQuery?.filters?.hasProtectedData).toBeFalse();
  });

  it("returns an empty successful page when requested scope is outside authorized workspace scope", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createEvent("audit:event:1", "2026-04-07T19:00:00.000Z"),
    ]);
    const service = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({
        allowed: true,
        scope: {
          workspaceIds: ["workspace:alpha"],
        },
      }),
    });

    const outcome = await service.listAuditEvents({
      requesterId: "user:auditor",
      query: {
        workspaceId: "workspace:beta",
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.response.events).toHaveLength(0);
    expect(outcome.value.response.totalCount).toBe(0);
    expect(repository.listQuery).toBeUndefined();
  });

  it("returns deterministic pagination with default sorting and hasMore", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createEvent("audit:event:3", "2026-04-07T19:03:00.000Z"),
      createEvent("audit:event:2", "2026-04-07T19:02:00.000Z"),
      createEvent("audit:event:1", "2026-04-07T19:01:00.000Z"),
    ]);
    const service = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({ allowed: true }),
    });

    const outcome = await service.listAuditEvents({
      requesterId: "user:auditor",
      query: {
        pagination: {
          limit: 2,
          offset: 0,
        },
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(repository.listQuery?.pagination?.limit).toBe(3);
    expect(repository.listQuery?.sorting?.sortBy).toBe("occurredAt");
    expect(repository.listQuery?.sorting?.sortDirection).toBe("desc");
    expect(outcome.value.response.events.map((event) => event.eventId)).toEqual([
      "audit:event:3",
      "audit:event:2",
    ]);
    expect(outcome.value.pagination.hasMore).toBeTrue();
    expect(outcome.value.response.totalCount).toBe(3);
  });
});
