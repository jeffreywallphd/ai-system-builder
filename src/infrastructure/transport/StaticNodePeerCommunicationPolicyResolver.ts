import type {
  NodePeerCapability,
  NodePeerOperationClass,
  ResolveNodePeerCommunicationPolicyRequest,
  ResolveNodePeerCommunicationPolicyResult,
  INodePeerCommunicationPolicyResolverPort,
} from "../../application/security/ports/NodePeerCommunicationPolicyPorts";

export interface NodePeerCommunicationPolicyRule {
  readonly localNodeId: string;
  readonly remoteNodeId: string;
  readonly allowedOperationClasses: ReadonlyArray<NodePeerOperationClass>;
  readonly exposedCapabilities: ReadonlyArray<NodePeerCapability>;
  readonly policyId?: string;
}

export interface StaticNodePeerCommunicationPolicyResolverOptions {
  readonly enabledByDefault?: boolean;
  readonly rules?: ReadonlyArray<NodePeerCommunicationPolicyRule>;
  readonly defaultPolicyId?: string;
}

export class StaticNodePeerCommunicationPolicyResolver implements INodePeerCommunicationPolicyResolverPort {
  private readonly enabledByDefault: boolean;
  private readonly defaultPolicyId: string;
  private readonly rules: ReadonlyArray<NodePeerCommunicationPolicyRule>;

  public constructor(options?: StaticNodePeerCommunicationPolicyResolverOptions) {
    this.enabledByDefault = options?.enabledByDefault ?? false;
    this.defaultPolicyId = options?.defaultPolicyId ?? "node-peer-policy:default-deny:v1";
    this.rules = Object.freeze((options?.rules ?? []).map((rule) => Object.freeze({
      ...rule,
      localNodeId: normalizeRequired(rule.localNodeId, "localNodeId"),
      remoteNodeId: normalizeRequired(rule.remoteNodeId, "remoteNodeId"),
      allowedOperationClasses: Object.freeze([...rule.allowedOperationClasses]),
      exposedCapabilities: Object.freeze([...rule.exposedCapabilities]),
      policyId: normalizeOptional(rule.policyId),
    })));
  }

  public async resolveNodePeerCommunicationPolicy(
    request: ResolveNodePeerCommunicationPolicyRequest,
  ): Promise<ResolveNodePeerCommunicationPolicyResult> {
    const localNodeId = normalizeRequired(request.localNodeId, "localNodeId");
    const remoteNodeId = normalizeRequired(request.remoteNodeId, "remoteNodeId");
    const occurredAt = normalizeOptional(request.asOf) ?? new Date().toISOString();

    const matched = this.rules.find((rule) => (
      rule.localNodeId === localNodeId
      && rule.remoteNodeId === remoteNodeId
      && rule.allowedOperationClasses.includes(request.operationClass)
    ));

    if (!matched) {
      return Object.freeze({
        policyId: this.defaultPolicyId,
        peerChannelsEnabled: false,
        allowedOperationClasses: Object.freeze([]),
        exposedCapabilities: Object.freeze([]),
        allowedPeerNodeIds: Object.freeze([]),
        source: "baseline",
        resolvedAt: occurredAt,
      });
    }

    return Object.freeze({
      policyId: matched.policyId ?? `${this.defaultPolicyId}:${localNodeId}:${remoteNodeId}`,
      peerChannelsEnabled: this.enabledByDefault || matched.allowedOperationClasses.length > 0,
      allowedOperationClasses: Object.freeze([...matched.allowedOperationClasses]),
      exposedCapabilities: Object.freeze([...matched.exposedCapabilities]),
      allowedPeerNodeIds: Object.freeze([matched.remoteNodeId]),
      source: "configured",
      resolvedAt: occurredAt,
    });
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Node peer communication policy ${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
