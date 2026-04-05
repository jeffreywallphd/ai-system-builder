import { describe, expect, it } from "bun:test";
import {
  AuthenticatedTrustStates,
  TransportChannelTypes,
  TransportConnectionRejectionReasons,
  TransportSecurityScenarios,
  resolveBaselineTransportSecurityPolicy,
} from "../../../domain/security/TransportSecurityDomain";
import {
  NodePeerCapabilities,
  NodePeerOperationClasses,
  type ResolveNodePeerCertificateIdentityRequest,
  type ResolveNodePeerCommunicationPolicyRequest,
  type INodePeerCertificateIdentityResolverPort,
  type INodePeerCommunicationPolicyResolverPort,
} from "../ports/NodePeerCommunicationPolicyPorts";
import { AuthorizeNodePeerCommunicationUseCase } from "../use-cases/AuthorizeNodePeerCommunicationUseCase";
import type { ValidateTransportConnectionTrustOutcome } from "../use-cases/ValidateTransportConnectionTrustUseCase";

class InMemoryNodePeerPolicyResolver implements INodePeerCommunicationPolicyResolverPort {
  public async resolveNodePeerCommunicationPolicy(_request: ResolveNodePeerCommunicationPolicyRequest) {
    return Object.freeze({
      policyId: "node-peer-policy:test:v1",
      peerChannelsEnabled: true,
      allowedOperationClasses: Object.freeze([NodePeerOperationClasses.runtimeTrustMaterialReplication]),
      exposedCapabilities: Object.freeze([NodePeerCapabilities.runtimeTrustMaterialRead]),
      allowedPeerNodeIds: Object.freeze(["node:remote:1"]),
      source: "configured" as const,
      resolvedAt: "2026-04-05T12:00:00.000Z",
    });
  }
}

class InMemoryNodePeerIdentityResolver implements INodePeerCertificateIdentityResolverPort {
  public constructor(
    private readonly overrides?: Partial<{
      approved: boolean;
      trusted: boolean;
      revoked: boolean;
      certificateBound: boolean;
    }>,
  ) {}

  public async resolveNodePeerCertificateIdentity(
    request: ResolveNodePeerCertificateIdentityRequest,
  ) {
    return Object.freeze({
      nodeId: request.nodeId,
      approved: this.overrides?.approved ?? true,
      trusted: this.overrides?.trusted ?? true,
      revoked: this.overrides?.revoked ?? false,
      certificateBound: this.overrides?.certificateBound ?? true,
      nodeTrustState: this.overrides?.trusted ?? true
        ? AuthenticatedTrustStates.trusted
        : AuthenticatedTrustStates.pending,
      resolution: "resolved" as const,
      checkedAt: request.asOf ?? "2026-04-05T12:00:00.000Z",
    });
  }
}

describe("AuthorizeNodePeerCommunicationUseCase", () => {
  it("accepts explicitly allowed node peer operation with trusted identity evidence", async () => {
    const useCase = new AuthorizeNodePeerCommunicationUseCase({
      nodePeerPolicyResolverPort: new InMemoryNodePeerPolicyResolver(),
      nodePeerCertificateIdentityResolverPort: new InMemoryNodePeerIdentityResolver(),
      validateTransportConnectionTrustUseCase: {
        async execute() {
          return acceptedTransportOutcome();
        },
      },
    });

    const outcome = await useCase.execute(createRequest());
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.accepted).toBeTrue();
    expect(outcome.value.exposedCapabilities).toContain(NodePeerCapabilities.runtimeTrustMaterialRead);
  });

  it("rejects when peer channels are not enabled by policy", async () => {
    const useCase = new AuthorizeNodePeerCommunicationUseCase({
      nodePeerPolicyResolverPort: {
        async resolveNodePeerCommunicationPolicy() {
          return Object.freeze({
            policyId: "node-peer-policy:disabled:v1",
            peerChannelsEnabled: false,
            allowedOperationClasses: Object.freeze([]),
            exposedCapabilities: Object.freeze([]),
            allowedPeerNodeIds: Object.freeze([]),
            source: "baseline" as const,
            resolvedAt: "2026-04-05T12:00:00.000Z",
          });
        },
      },
      nodePeerCertificateIdentityResolverPort: new InMemoryNodePeerIdentityResolver(),
      validateTransportConnectionTrustUseCase: {
        async execute() {
          return acceptedTransportOutcome();
        },
      },
    });

    const outcome = await useCase.execute(createRequest());
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.accepted).toBeFalse();
    expect(outcome.value.rejectionReasons).toContain("peer-channels-disabled-by-policy");
    expect(outcome.value.rejectionReasons).toContain("operation-class-not-allowed");
  });

  it("rejects when transport trust gate denies node-to-node connection", async () => {
    const useCase = new AuthorizeNodePeerCommunicationUseCase({
      nodePeerPolicyResolverPort: new InMemoryNodePeerPolicyResolver(),
      nodePeerCertificateIdentityResolverPort: new InMemoryNodePeerIdentityResolver(),
      validateTransportConnectionTrustUseCase: {
        async execute() {
          return rejectedTransportOutcome([
            TransportConnectionRejectionReasons.mutualTlsRequired,
          ]);
        },
      },
    });

    const outcome = await useCase.execute({
      ...createRequest(),
      mutualTlsEstablished: false,
    });
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.accepted).toBeFalse();
    expect(outcome.value.rejectionReasons).toContain("transport-trust-rejected");
    expect(outcome.value.transport?.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.mutualTlsRequired,
    );
  });

  it("rejects when peer identity is not approved/trusted", async () => {
    const useCase = new AuthorizeNodePeerCommunicationUseCase({
      nodePeerPolicyResolverPort: new InMemoryNodePeerPolicyResolver(),
      nodePeerCertificateIdentityResolverPort: new InMemoryNodePeerIdentityResolver({
        approved: false,
        trusted: false,
      }),
      validateTransportConnectionTrustUseCase: {
        async execute() {
          return acceptedTransportOutcome();
        },
      },
    });

    const outcome = await useCase.execute(createRequest());
    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.accepted).toBeFalse();
    expect(outcome.value.rejectionReasons).toContain("peer-approval-required");
    expect(outcome.value.rejectionReasons).toContain("peer-trust-required");
  });
});

function createRequest() {
  return Object.freeze({
    connectionId: "conn:node-peer:1",
    direction: "outbound" as const,
    localNodeId: "node:local:1",
    remoteNodeId: "node:remote:1",
    operationClass: NodePeerOperationClasses.runtimeTrustMaterialReplication,
    channelType: TransportChannelTypes.tls,
    encryptedTransportEstablished: true,
    mutualTlsEstablished: true,
    lanTrustAssumed: false,
    certificateSerialNumber: "AB12",
    certificateFingerprintSha256: "AA:BB:CC",
    evaluatedAt: "2026-04-05T12:00:00.000Z",
  });
}

function acceptedTransportOutcome(): ValidateTransportConnectionTrustOutcome {
  const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToNode);
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      direction: "outbound" as const,
      policy,
      source: "baseline" as const,
      trustValidation: Object.freeze({
        accepted: true,
        rejectionReasons: Object.freeze([]),
        evaluatedAt: "2026-04-05T12:00:00.000Z",
        policyId: policy.policyId,
        scenario: policy.scenario,
      }),
      failureReasons: Object.freeze([]),
      resolvedTrustState: Object.freeze({
        userSessionAuthenticated: false,
      }),
    }),
  });
}

function rejectedTransportOutcome(
  reasons: ReadonlyArray<string>,
): ValidateTransportConnectionTrustOutcome {
  const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToNode);
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      direction: "outbound" as const,
      policy,
      source: "baseline" as const,
      trustValidation: Object.freeze({
        accepted: false,
        rejectionReasons: Object.freeze([...reasons]),
        evaluatedAt: "2026-04-05T12:00:00.000Z",
        policyId: policy.policyId,
        scenario: policy.scenario,
      }),
      failureReasons: Object.freeze([]),
      resolvedTrustState: Object.freeze({
        userSessionAuthenticated: false,
      }),
    }),
  });
}
