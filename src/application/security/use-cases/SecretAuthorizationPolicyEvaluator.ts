import {
  SecretAccessActions,
  SecretAccessDecisionReasons,
  SecretActorTypes,
  evaluateSecretAccessDecision,
  type SecretAccessDecision,
} from "../../../domain/security/SecretDomain";
import type { ISecretAccessPolicyPort } from "../ports/SecretServicePorts";

const RuntimeActorTypes = new Set<string>([
  SecretActorTypes.serverRuntime,
  SecretActorTypes.workspaceService,
]);

const HumanActorTypes = new Set<string>([
  SecretActorTypes.serverAdmin,
  SecretActorTypes.workspaceMember,
  SecretActorTypes.user,
]);

export class SecretAuthorizationPolicyEvaluator implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]): Promise<SecretAccessDecision> {
    const domainDecision = evaluateSecretAccessDecision(input);
    if (!domainDecision.allowed) {
      return domainDecision;
    }

    if (
      input.action === SecretAccessActions.retrievePlaintext
      && !this.isRuntimeActor(input.actor.actorType)
      && input.actor.actorType !== SecretActorTypes.serverAdmin
    ) {
      return Object.freeze({
        ...domainDecision,
        allowed: false,
        reason: SecretAccessDecisionReasons.runtimeAccessRequired,
        auditEvent: "secret-access-denied",
      });
    }

    if (
      this.isRuntimeActor(input.actor.actorType)
      && this.isAdministrativeMutation(input.action)
    ) {
      return Object.freeze({
        ...domainDecision,
        allowed: false,
        reason: SecretAccessDecisionReasons.administrativeAccessRequired,
        auditEvent: "secret-access-denied",
      });
    }

    if (!this.isKnownActorType(input.actor.actorType)) {
      return Object.freeze({
        ...domainDecision,
        allowed: false,
        reason: SecretAccessDecisionReasons.actorTypeNotAllowed,
        auditEvent: "secret-access-denied",
      });
    }

    return domainDecision;
  }

  private isRuntimeActor(actorType: string): boolean {
    return RuntimeActorTypes.has(actorType);
  }

  private isKnownActorType(actorType: string): boolean {
    return this.isRuntimeActor(actorType) || HumanActorTypes.has(actorType);
  }

  private isAdministrativeMutation(action: string): boolean {
    return action === SecretAccessActions.create
      || action === SecretAccessActions.rotate
      || action === SecretAccessActions.disable
      || action === SecretAccessActions.delete;
  }
}
