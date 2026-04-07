import type {
  TransportConnectionContext,
  TransportConnectionTrustValidationResult,
  TransportSecurityPolicy,
  TransportSecurityScenario,
} from "@domain/security/TransportSecurityDomain";
import type { TransportSecurityResolvedTrustSnapshot } from "./TransportSecurityAuditPorts";

export interface ResolveTransportSecurityPolicyRequest {
  readonly scenario: TransportSecurityScenario;
  readonly localPeerType: TransportConnectionContext["localPeerType"];
  readonly remotePeerType: TransportConnectionContext["remotePeerType"];
  readonly workspaceId?: string;
}

export interface ResolveTransportSecurityPolicyResult {
  readonly policy: TransportSecurityPolicy;
  readonly source: "baseline" | "override";
}

export interface EvaluateTransportConnectionPolicyRequest {
  readonly policy: TransportSecurityPolicy;
  readonly context: TransportConnectionContext;
  readonly evaluatedAt?: string;
}

export interface TransportConnectionPolicyDecisionAuditEvent {
  readonly event: "transport-connection-accepted" | "transport-connection-rejected";
  readonly connectionId: string;
  readonly scenario: TransportSecurityScenario;
  readonly policyId: string;
  readonly actorType: TransportConnectionContext["actorType"];
  readonly localPeerType: TransportConnectionContext["localPeerType"];
  readonly remotePeerType: TransportConnectionContext["remotePeerType"];
  readonly channelType: TransportConnectionContext["channelType"];
  readonly rejectionReasons: ReadonlyArray<string>;
  readonly resolvedTrustState?: TransportSecurityResolvedTrustSnapshot;
  readonly occurredAt: string;
}

export interface ITransportSecurityPolicyResolverPort {
  resolveTransportSecurityPolicy(
    request: ResolveTransportSecurityPolicyRequest,
  ): Promise<ResolveTransportSecurityPolicyResult>;
}

export interface ITransportConnectionPolicyEvaluatorPort {
  evaluateTransportConnectionPolicy(
    request: EvaluateTransportConnectionPolicyRequest,
  ): Promise<TransportConnectionTrustValidationResult>;
}

export interface ITransportConnectionPolicyAuditPort {
  recordTransportConnectionPolicyDecision(
    event: TransportConnectionPolicyDecisionAuditEvent,
  ): Promise<void>;
}

export interface TransportSecurityPolicyEvaluationPorts {
  readonly transportSecurityPolicyResolverPort: ITransportSecurityPolicyResolverPort;
  readonly transportConnectionPolicyEvaluatorPort: ITransportConnectionPolicyEvaluatorPort;
  readonly transportConnectionPolicyAuditPort?: ITransportConnectionPolicyAuditPort;
}

