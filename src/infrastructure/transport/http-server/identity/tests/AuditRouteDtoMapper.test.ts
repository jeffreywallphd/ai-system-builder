import { describe, expect, it } from "bun:test";
import {
  toAuditLedgerDetailApiRequest,
  toAuditLedgerListApiRequest,
  toAuditLedgerQueryLogPayload,
} from "../dto/AuditRouteDtoMapper";

const workspaceContext = Object.freeze({
  actor: Object.freeze({
    userIdentityId: "user-1",
  }),
  workspace: Object.freeze({
    workspaceId: "workspace-1",
  }),
});

describe("Audit route DTO mapper", () => {
  it("maps workspace context and parsed query into an audit list request", () => {
    const request = toAuditLedgerListApiRequest(
      workspaceContext,
      Object.freeze({
        limit: 25,
        cursor: "cursor-1",
      }),
    );

    expect(request).toEqual({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      query: {
        limit: 25,
        cursor: "cursor-1",
      },
    });
  });

  it("maps workspace context and event id into an audit detail request", () => {
    const request = toAuditLedgerDetailApiRequest(workspaceContext, "event-1");

    expect(request).toEqual({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      eventId: "event-1",
    });
  });

  it("maps query params into transport log payload shape", () => {
    const payload = toAuditLedgerQueryLogPayload(
      new URLSearchParams("cursor=cursor-1&limit=10"),
    );

    expect(payload).toEqual({
      query: {
        cursor: "cursor-1",
        limit: "10",
      },
    });
  });
});

