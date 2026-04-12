import { describe, expect, it } from "bun:test";
import type {
  IPlatformAuditEventRepository,
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { PlatformRunSubmissionAuditSink } from "../PlatformRunSubmissionAuditSink";

class InMemoryPlatformAuditRepository implements IPlatformAuditEventRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendAuditEvent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }

  public async listAuditEvents(_query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return Object.freeze([...this.events]);
  }
}

describe("PlatformRunSubmissionAuditSink", () => {
  it("maps submission denial events to platform runs audit records", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformRunSubmissionAuditSink(repository);

    await sink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-denied",
      occurredAt: "2026-04-07T15:00:00.000Z",
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:alpha",
      details: Object.freeze({
        validationCode: "forbidden",
        issueCount: 1,
      }),
    }));

    expect(repository.events.length).toBe(1);
    expect(repository.events[0]?.eventKind).toBe("runs");
    expect(repository.events[0]?.action).toBe("run.submission.denied");
    expect(repository.events[0]?.actorId).toBe("user:alpha");
    expect(repository.events[0]?.workspaceId).toBe("workspace-alpha");
    expect(repository.events[0]?.outcome).toBe("denied");
  });

  it("maps lifecycle transition events to succeeded outcome with run target context", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformRunSubmissionAuditSink(repository);

    await sink.recordRunSubmissionEvent(Object.freeze({
      type: "run-lifecycle-transitioned",
      occurredAt: "2026-04-07T15:00:00.000Z",
      workspaceId: "workspace-alpha",
      runId: "run:123",
      details: Object.freeze({
        fromState: "none",
        toState: "submitted",
      }),
    }));

    expect(repository.events.length).toBe(1);
    expect(repository.events[0]?.action).toBe("run.lifecycle.transitioned");
    expect(repository.events[0]?.targetRef).toBe("run:123");
    expect(repository.events[0]?.outcome).toBe("succeeded");
  });

  it("maps repeated denial-pattern events as denied orchestration actions", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformRunSubmissionAuditSink(repository);

    await sink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-denial-pattern-detected",
      occurredAt: "2026-04-08T09:00:00.000Z",
      workspaceId: "workspace-alpha",
      actorServiceId: "service:run-validation",
      details: Object.freeze({
        issueCategory: "authorization-denial",
        attemptsInWindow: 3,
      }),
    }));

    expect(repository.events.length).toBe(1);
    expect(repository.events[0]?.action).toBe("run.submission.denial-pattern.detected");
    expect(repository.events[0]?.outcome).toBe("denied");
    expect(repository.events[0]?.actorId).toBe("service:run-validation");
  });
});
