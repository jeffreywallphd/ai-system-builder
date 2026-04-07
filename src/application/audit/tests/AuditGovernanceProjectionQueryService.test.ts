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
  AuditLedgerQueryService,
  type AuditLedgerQueryAuthorizer,
  type AuditLedgerQueryReadScope,
} from "../use-cases/AuditLedgerQueryService";
import { AuditGovernanceProjectionQueryService } from "../use-cases/AuditGovernanceProjectionQueryService";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public constructor(private readonly events: ReadonlyArray<CanonicalAuditEvent>) {}

  public async appendAuditEvent(
    _event: CanonicalAuditEvent,
    _context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    throw new Error("append not used by projection query tests");
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    const filtered = this.events.filter((event) => {
      if (query.workspaceId && query.workspaceId !== event.scope.workspaceId) {
        return false;
      }
      if (query.filters?.eventTypes?.length && !query.filters.eventTypes.includes(event.eventType)) {
        return false;
      }
      if (query.filters?.outcomes?.length && !query.filters.outcomes.includes(event.outcome)) {
        return false;
      }
      if (query.filters?.includeThinSafeOnly && event.category === AuditEventCategories.protectedData) {
        return false;
      }
      return true;
    });

    const offset = query.pagination?.offset ?? 0;
    const limit = query.pagination?.limit ?? filtered.length;
    return Object.freeze(filtered.slice(offset, offset + limit));
  }

  public async countAuditEvents(query: AuditLedgerQuery): Promise<number> {
    const filtered = await this.listAuditEvents({
      ...query,
      pagination: undefined,
      limit: undefined,
      offset: undefined,
    });
    return filtered.length;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }
}

class StaticAuthorizer implements AuditLedgerQueryAuthorizer {
  public constructor(private readonly scope: AuditLedgerQueryReadScope) {}

  public async authorizeAuditLedgerRead(_input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }) {
    return {
      allowed: true as const,
      scope: this.scope,
    };
  }
}

function createEvent(input: {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: CanonicalAuditEvent["category"];
  readonly outcome: CanonicalAuditEvent["outcome"];
  readonly hasProtectedData?: boolean;
  readonly occurredAt: string;
}): CanonicalAuditEvent {
  return createCanonicalAuditEvent({
    eventId: input.eventId,
    eventType: input.eventType,
    category: input.category,
    action: `${input.eventType}.action`,
    outcome: input.outcome,
    occurredAt: input.occurredAt,
    actor: {
      actorId: "user:auditor",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:auditor",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace-alpha",
    },
    payload: {
      hasProtectedData: input.hasProtectedData ?? false,
      redactionReasons: input.hasProtectedData ? ["secret-material"] : [],
      userSafeDetails: {
        marker: input.eventType,
      },
      adminOnlyDetails: input.hasProtectedData
        ? {
          secretId: "secret:alpha",
        }
        : undefined,
    },
    integrity: {
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    },
  });
}

describe("AuditGovernanceProjectionQueryService", () => {
  it("returns projection summaries with facets and explanatory metadata", async () => {
    const repository = new InMemoryAuditLedgerRepository(Object.freeze([
      createEvent({
        eventId: "audit:event:1",
        eventType: "workspace-policy-updated",
        category: AuditEventCategories.policy,
        outcome: "succeeded",
        occurredAt: "2026-04-07T10:00:00.000Z",
      }),
      createEvent({
        eventId: "audit:event:2",
        eventType: "workspace-member-removed",
        category: AuditEventCategories.administrative,
        outcome: "rejected",
        occurredAt: "2026-04-07T11:00:00.000Z",
      }),
    ]));

    const queryService = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({
        workspaceIds: ["workspace-alpha"],
        canReadProtectedData: false,
        detailVisibility: "user-safe",
      }),
    });
    const projectionService = new AuditGovernanceProjectionQueryService({
      auditLedgerQueryService: queryService,
    });

    const outcome = await projectionService.listGovernanceAuditEvents({
      requesterId: "user:auditor",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.totalCount).toBe(2);
    expect(outcome.value.events).toHaveLength(2);
    expect(outcome.value.facets.find((facet) => facet.key === "eventType")?.options.length).toBe(2);
    expect(outcome.value.explanatory.detailVisibility).toBe("user-safe");
    expect(outcome.value.events[0]?.summary.includes("(")).toBeTrue();
  });

  it("preserves role-sensitive detail shaping for user-safe and admin readers", async () => {
    const protectedEvent = createEvent({
      eventId: "audit:event:protected",
      eventType: "secret-access-evaluated",
      category: AuditEventCategories.protectedData,
      outcome: "succeeded",
      hasProtectedData: true,
      occurredAt: "2026-04-07T12:00:00.000Z",
    });
    const repository = new InMemoryAuditLedgerRepository(Object.freeze([protectedEvent]));

    const userSafeProjectionService = new AuditGovernanceProjectionQueryService({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          canReadProtectedData: true,
          detailVisibility: "user-safe",
        }),
      }),
    });
    const adminProjectionService = new AuditGovernanceProjectionQueryService({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          canReadProtectedData: true,
          detailVisibility: "admin",
        }),
      }),
    });

    const userSafe = await userSafeProjectionService.getGovernanceAuditEventDetail({
      requesterId: "user:member",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:protected",
    });
    const admin = await adminProjectionService.getGovernanceAuditEventDetail({
      requesterId: "user:admin",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:protected",
    });

    expect(userSafe.ok).toBeTrue();
    expect(admin.ok).toBeTrue();
    if (!userSafe.ok || !admin.ok) {
      return;
    }

    expect(userSafe.value.visibility).toBe("user-safe");
    expect(userSafe.value.adminOnlyDetails).toBeUndefined();
    expect(admin.value.visibility).toBe("admin");
    expect(admin.value.adminOnlyDetails?.secretId).toBe("secret:alpha");
  });

  it("supports policy seams for projection shaping and compliance/export notes", async () => {
    const repository = new InMemoryAuditLedgerRepository(Object.freeze([
      createEvent({
        eventId: "audit:event:policy-seam",
        eventType: "workspace-policy-updated",
        category: AuditEventCategories.policy,
        outcome: "succeeded",
        occurredAt: "2026-04-07T13:00:00.000Z",
      }),
    ]));
    const queryService = new AuditLedgerQueryService({
      repository,
      authorizer: new StaticAuthorizer({
        workspaceIds: ["workspace-alpha"],
        canReadProtectedData: true,
        detailVisibility: "admin",
      }),
    });
    const projectionService = new AuditGovernanceProjectionQueryService({
      auditLedgerQueryService: queryService,
      projectionPolicy: Object.freeze({
        summarizeEvent: ({ event }) => `profile-summary:${event.eventType}`,
        resolveTargetRef: () => "workspace:projection-policy",
        buildFacets: () => Object.freeze([Object.freeze({
          key: "category",
          options: Object.freeze([Object.freeze({
            value: "policy",
            count: 1,
          })]),
        })]),
        listExplanatoryNotes: () => Object.freeze([
          "Projection policy seam applied for deployment-profile governance review shaping.",
        ]),
        listComplianceExportNotes: () => Object.freeze([
          "Compliance export pathways are not implemented in this slice; policy hook only defines extension seam.",
        ]),
      }),
    });

    const listOutcome = await projectionService.listGovernanceAuditEvents({
      requesterId: "user:admin",
      query: Object.freeze({
        workspaceId: "workspace-alpha",
      }),
    });
    expect(listOutcome.ok).toBeTrue();
    if (!listOutcome.ok) {
      return;
    }

    expect(listOutcome.value.events[0]?.summary).toBe("profile-summary:workspace-policy-updated");
    expect(listOutcome.value.events[0]?.targetRef).toBe("workspace:projection-policy");
    expect(listOutcome.value.facets).toEqual([{
      key: "category",
      options: [{
        value: "policy",
        count: 1,
      }],
    }]);
    expect(listOutcome.value.explanatory.notes).toContain(
      "Projection policy seam applied for deployment-profile governance review shaping.",
    );
    expect(listOutcome.value.explanatory.notes).toContain(
      "Compliance export pathways are not implemented in this slice; policy hook only defines extension seam.",
    );

    const detailOutcome = await projectionService.getGovernanceAuditEventDetail({
      requesterId: "user:admin",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:policy-seam",
    });
    expect(detailOutcome.ok).toBeTrue();
    if (!detailOutcome.ok) {
      return;
    }

    expect(detailOutcome.value.explanatory.notes).toContain(
      "Projection policy seam applied for deployment-profile governance review shaping.",
    );
    expect(detailOutcome.value.explanatory.notes).toContain(
      "Compliance export pathways are not implemented in this slice; policy hook only defines extension seam.",
    );
  });
});
