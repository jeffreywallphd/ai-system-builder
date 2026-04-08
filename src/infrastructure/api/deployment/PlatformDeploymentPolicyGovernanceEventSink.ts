import { randomUUID } from "node:crypto";
import {
  PlatformAuditEventKinds,
  type IPlatformAuditEventRepository,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  DeploymentPolicyGovernanceEvent,
  IDeploymentPolicyGovernanceEventSink,
} from "@application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts";

const DeploymentPolicyAuditActionsByType = Object.freeze({
  "deployment-policy-active-profile-changed": "policy.deployment.active-profile.changed",
  "deployment-policy-overrides-mutated": "policy.deployment.overrides.mutated",
} as const satisfies Record<DeploymentPolicyGovernanceEvent["type"], string>);

export interface DeploymentPolicyGovernanceOperationalLogger {
  info(event: {
    readonly event: string;
    readonly operation: string;
    readonly outcome: "success" | "warn";
    readonly scopeKind: string;
    readonly scopeId: string;
    readonly actorUserIdentityId?: string;
    readonly profileId?: string;
    readonly policyFamilyIds?: ReadonlyArray<string>;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly occurredAt: string;
  }): void;
}

export class PlatformDeploymentPolicyGovernanceEventSink implements IDeploymentPolicyGovernanceEventSink {
  public constructor(
    private readonly repository: IPlatformAuditEventRepository,
    private readonly logger?: DeploymentPolicyGovernanceOperationalLogger,
  ) {}

  public async recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    if (event.channel === "audit") {
      await this.recordAuditEvent(event);
      return;
    }

    if (event.channel !== "operational") {
      return;
    }

    this.logger?.info({
      event: "deployment.policy.governance-event.recorded",
      operation: "deployment-policy.governance-event",
      outcome: event.outcome === "succeeded" ? "success" : "warn",
      scopeKind: event.scopeKind,
      scopeId: event.scopeId,
      actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
      profileId: normalizeOptional(event.profileId),
      policyFamilyIds: event.policyFamilyIds,
      details: event.details,
      occurredAt: event.occurredAt,
    });
  }

  private async recordAuditEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    const actorId = normalizeOptional(event.actorUserIdentityId)
      ?? normalizeOptional(event.actorServiceId)
      ?? "system:deployment-policy-admin";
    const scopeId = normalizeOptional(event.scopeId) ?? "system";
    const profileId = normalizeOptional(event.profileId);
    const targetRef = profileId
      ? `deployment-policy:${scopeId}:${profileId}`
      : `deployment-policy-scope:${scopeId}`;

    await this.repository.appendAuditEvent(Object.freeze({
      eventId: `audit:deployment-policy:${randomUUID()}`,
      eventKind: PlatformAuditEventKinds.system,
      action: DeploymentPolicyAuditActionsByType[event.type],
      actorId,
      workspaceId: event.scopeKind === "workspace" ? scopeId : undefined,
      userIdentityId: normalizeOptional(event.actorUserIdentityId),
      targetRef,
      outcome: resolvePlatformAuditOutcome(event.outcome),
      occurredAt: event.occurredAt,
      correlationId: normalizeOptional(event.correlationId),
      details: Object.freeze({
        scopeKind: event.scopeKind,
        scopeId,
        policyFamilyIds: event.policyFamilyIds,
        profileId,
        ...event.details,
      }),
    }), Object.freeze({
      operationKey: `deployment-policy-governance:${event.type}:${scopeId}:${profileId ?? event.occurredAt}`,
      actorId,
      occurredAt: event.occurredAt,
      correlationId: normalizeOptional(event.correlationId),
    }));
  }
}

function resolvePlatformAuditOutcome(
  outcome: DeploymentPolicyGovernanceEvent["outcome"],
): "succeeded" | "denied" | "failed" | "rejected" {
  if (outcome === "succeeded") {
    return "succeeded";
  }
  if (outcome === "rejected") {
    return "rejected";
  }
  return "failed";
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
