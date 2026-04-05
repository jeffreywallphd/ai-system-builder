import type { AuthenticatedTrustState } from "../../../domain/security/TransportSecurityDomain";

export const NodePeerOperationClasses = Object.freeze({
  runtimeTrustMaterialReplication: "runtime-trust-material-replication",
});

export type NodePeerOperationClass =
  typeof NodePeerOperationClasses[keyof typeof NodePeerOperationClasses];

export const NodePeerCapabilities = Object.freeze({
  runtimeTrustMaterialRead: "runtime-trust-material:read",
});

export type NodePeerCapability =
  typeof NodePeerCapabilities[keyof typeof NodePeerCapabilities];

export interface ResolveNodePeerCommunicationPolicyRequest {
  readonly localNodeId: string;
  readonly remoteNodeId: string;
  readonly direction: "inbound" | "outbound";
  readonly operationClass: NodePeerOperationClass;
  readonly asOf?: string;
}

export interface ResolveNodePeerCommunicationPolicyResult {
  readonly policyId: string;
  readonly peerChannelsEnabled: boolean;
  readonly allowedOperationClasses: ReadonlyArray<NodePeerOperationClass>;
  readonly exposedCapabilities: ReadonlyArray<NodePeerCapability>;
  readonly allowedPeerNodeIds?: ReadonlyArray<string>;
  readonly source: "baseline" | "configured";
  readonly resolvedAt: string;
}

export interface ResolveNodePeerCertificateIdentityRequest {
  readonly nodeId: string;
  readonly certificateSerialNumber?: string;
  readonly certificateFingerprintSha256?: string;
  readonly asOf?: string;
}

export interface ResolveNodePeerCertificateIdentityResult {
  readonly nodeId: string;
  readonly approved: boolean;
  readonly trusted: boolean;
  readonly revoked: boolean;
  readonly certificateBound: boolean;
  readonly nodeTrustState: AuthenticatedTrustState;
  readonly resolution: "resolved" | "not-found" | "mismatch" | "error";
  readonly reasonCode?: string;
  readonly checkedAt: string;
}

export interface INodePeerCommunicationPolicyResolverPort {
  resolveNodePeerCommunicationPolicy(
    request: ResolveNodePeerCommunicationPolicyRequest,
  ): Promise<ResolveNodePeerCommunicationPolicyResult>;
}

export interface INodePeerCertificateIdentityResolverPort {
  resolveNodePeerCertificateIdentity(
    request: ResolveNodePeerCertificateIdentityRequest,
  ): Promise<ResolveNodePeerCertificateIdentityResult>;
}
