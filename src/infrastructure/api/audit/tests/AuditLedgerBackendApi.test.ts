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
} from "@application/audit/AuditApplicationContracts";
import {
  AuditLedgerQueryService,
  type AuditLedgerQueryAuthorizer,
  type AuditLedgerQueryReadScope,
} from "@application/audit/use-cases/AuditLedgerQueryService";
import { AuditLedgerBackendApi } from "../AuditLedgerBackendApi";
import { AuditLedgerObservability, type AuditLedgerObservabilityLogEvent, type AuditLedgerObservabilityLogger } from "../AuditLedgerObservability";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public constructor(private readonly events: ReadonlyArray<CanonicalAuditEvent>) {}

  public async appendAuditEvent(
    _event: CanonicalAuditEvent,
    _context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    throw new Error("append not used by AuditLedgerBackendApi tests");
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    const offset = query.pagination?.offset ?? 0;
    const limit = query.pagination?.limit ?? this.events.length;
    return this.events.slice(offset, offset + limit);
  }

  public async countAuditEvents(): Promise<number> {
    return this.events.length;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }
}

class StaticAuthorizer implements AuditLedgerQueryAuthorizer {
  public constructor(private readonly scope: AuditLedgerQueryReadScope) {}

  public async authorizeAuditLedgerRead() {
    return {
      allowed: true as const,
      scope: this.scope,
    };
  }
}

class ThrowingListAuditLedgerRepository extends InMemoryAuditLedgerRepository {
  public override async listAuditEvents(_query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    throw new Error("database token=abc123 path=C:\\secret\\audit.db");
  }
}

class RecordingAuditLedgerObservabilityLogger implements AuditLedgerObservabilityLogger {
  public readonly infoEvents: AuditLedgerObservabilityLogEvent[] = [];
  public readonly warnEvents: AuditLedgerObservabilityLogEvent[] = [];
  public readonly errorEvents: AuditLedgerObservabilityLogEvent[] = [];

  public info(event: AuditLedgerObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: AuditLedgerObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: AuditLedgerObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

function createAuditEvent(eventId: string): CanonicalAuditEvent {
  return createCanonicalAuditEvent({
    eventId,
    eventType: "workspace-policy-updated",
    category: AuditEventCategories.policy,
    action: "policy.updated",
    outcome: "succeeded",
    occurredAt: "2026-04-07T19:00:00.000Z",
    recordedAt: "2026-04-07T19:00:30.000Z",
    actor: {
      actorId: "user:admin",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:admin",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace-alpha",
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

describe("AuditLedgerBackendApi", () => {
  it("returns list/query metadata and deterministic pagination", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createAuditEvent("audit:event:1"),
      createAuditEvent("audit:event:2"),
    ]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.listAuditEvents({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      query: {
        pagination: {
          limit: 1,
          offset: 0,
        },
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.events).toHaveLength(1);
    expect(response.data?.totalCount).toBe(2);
    expect(response.data?.pagination.hasMore).toBeTrue();
  });

  it("maps detail not-found into stable API semantics", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.getAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:missing",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });

  it("returns invalid-request for missing actor/workspace context", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const listResponse = await api.listAuditEvents({
      actorUserIdentityId: " ",
      workspaceId: "workspace-alpha",
    });
    expect(listResponse.ok).toBeFalse();
    expect(listResponse.error?.code).toBe("invalid-request");

    const detailResponse = await api.getAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: " ",
      eventId: "audit:event:1",
    });
    expect(detailResponse.ok).toBeFalse();
    expect(detailResponse.error?.code).toBe("invalid-request");
  });

  it("returns governance projection list with facets and explanatory metadata", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createAuditEvent("audit:event:1"),
      createAuditEvent("audit:event:2"),
    ]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.listGovernanceAuditEvents({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      query: {
        pagination: {
          limit: 1,
          offset: 0,
        },
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.events).toHaveLength(1);
    expect(response.data?.facets.some((facet) => facet.key === "eventType")).toBeTrue();
    expect(response.data?.explanatory.detailVisibility).toBe("user-safe");
  });

  it("returns governance projection detail with role-sensitive visibility", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createAuditEvent("audit:event:1"),
    ]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.getGovernanceAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.event.visibility).toBe("admin");
    expect(response.data?.event.explanatory.roleSensitivity).toBe("workspace-admin");
  });

  it("maps internal query failures to stable internal error and emits observability diagnostics", async () => {
    const repository = new ThrowingListAuditLedgerRepository([
      createAuditEvent("audit:event:1"),
    ]);

    const logger = new RecordingAuditLedgerObservabilityLogger();
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
      observability: new AuditLedgerObservability({ logger }),
    });

    const response = await api.listAuditEvents({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      query: {
        pagination: {
          limit: 10,
          offset: 0,
        },
      },
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("internal");
    expect(response.error?.message).toBe("Audit ledger query failed.");
    expect(logger.errorEvents.length + logger.warnEvents.length).toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify({
      error: logger.errorEvents,
      warn: logger.warnEvents,
    });
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("C:\\secret\\audit.db");
  });
});

