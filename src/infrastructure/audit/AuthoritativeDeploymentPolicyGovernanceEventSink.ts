import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type {
  DeploymentPolicyGovernanceEvent,
  IDeploymentPolicyGovernanceEventSink,
} from "@application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

const DeploymentPolicyAuditActionsByType = Object.freeze({
  "deployment-policy-active-profile-changed": "policy.deployment.active-profile.changed",
  "deployment-policy-overrides-mutated": "policy.deployment.overrides.mutated",
} as const satisfies Record<DeploymentPolicyGovernanceEvent["type"], string>);

export class AuthoritativeDeploymentPolicyGovernanceEventSink implements IDeploymentPolicyGovernanceEventSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    if (event.channel !== "audit") {
      return;
    }

    const actorUserIdentityId = normalizeOptional(event.actorUserIdentityId);
    const actorServiceId = normalizeOptional(event.actorServiceId);
    const actor = actorUserIdentityId
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorServiceId ?? "system:deployment-policy-admin",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorServiceId ?? "system:deployment-policy-admin",
      });

    const scopeId = normalizeOptional(event.scopeId) ?? "system";
    const profileId = normalizeOptional(event.profileId);
    const policyFamilyIds = event.policyFamilyIds;
    const protectedResource = profileId
      ? Object.freeze({
        resourceType: "deployment-policy-profile",
        resourceId: `${scopeId}:${profileId}`,
        resourceRef: `deployment-policy-profile:${scopeId}:${profileId}`,
        sensitivityClass: "standard" as const,
        workspaceId: event.scopeKind === "workspace" ? scopeId : undefined,
      })
      : Object.freeze({
        resourceType: "deployment-policy-scope",
        resourceId: scopeId,
        resourceRef: `deployment-policy-scope:${scopeId}`,
        sensitivityClass: "standard" as const,
        workspaceId: event.scopeKind === "workspace" ? scopeId : undefined,
      });

    await this.recorder.recordPolicyEvent({
      operationKey: `deployment-policy-governance:${event.type}:${scopeId}:${profileId ?? event.occurredAt}`,
      eventType: event.type,
      action: DeploymentPolicyAuditActionsByType[event.type],
      outcome: resolveAuditOutcome(event.outcome),
      occurredAt: event.occurredAt,
      actor,
      scope: event.scopeKind === "workspace"
        ? Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId: scopeId,
        })
        : Object.freeze({
          kind: AuditScopeKinds.global,
        }),
      protectedResource,
      correlationId: normalizeOptional(event.correlationId),
      payload: Object.freeze({
        userSafeDetails: Object.freeze({
          channel: event.channel,
          scopeKind: event.scopeKind,
          scopeId,
          profileId,
          policyFamilyIds,
          outcome: event.outcome,
        }),
        adminOnlyDetails: event.details
          ? Object.freeze({
            details: event.details,
          })
          : undefined,
      }),
    });
  }
}

function resolveAuditOutcome(
  outcome: DeploymentPolicyGovernanceEvent["outcome"],
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (outcome === "succeeded") {
    return AuditEventOutcomes.succeeded;
  }
  if (outcome === "rejected") {
    return AuditEventOutcomes.rejected;
  }
  return AuditEventOutcomes.failed;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
