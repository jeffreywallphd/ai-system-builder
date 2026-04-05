import { describe, expect, it } from "bun:test";
import {
  NodePeerCapabilities,
  NodePeerOperationClasses,
} from "../../../application/security/ports/NodePeerCommunicationPolicyPorts";
import { StaticNodePeerCommunicationPolicyResolver } from "../StaticNodePeerCommunicationPolicyResolver";

describe("StaticNodePeerCommunicationPolicyResolver", () => {
  it("defaults to deny when no explicit peer rule exists", async () => {
    const resolver = new StaticNodePeerCommunicationPolicyResolver();

    const result = await resolver.resolveNodePeerCommunicationPolicy({
      localNodeId: "node:local:1",
      remoteNodeId: "node:remote:1",
      direction: "outbound",
      operationClass: NodePeerOperationClasses.runtimeTrustMaterialReplication,
    });

    expect(result.peerChannelsEnabled).toBeFalse();
    expect(result.allowedOperationClasses).toHaveLength(0);
  });

  it("allows only configured local-to-remote operation classes and capabilities", async () => {
    const resolver = new StaticNodePeerCommunicationPolicyResolver({
      rules: [{
        localNodeId: "node:local:1",
        remoteNodeId: "node:remote:1",
        allowedOperationClasses: [NodePeerOperationClasses.runtimeTrustMaterialReplication],
        exposedCapabilities: [NodePeerCapabilities.runtimeTrustMaterialRead],
        policyId: "node-peer-policy:local-1:remote-1:v1",
      }],
    });

    const allowed = await resolver.resolveNodePeerCommunicationPolicy({
      localNodeId: "node:local:1",
      remoteNodeId: "node:remote:1",
      direction: "outbound",
      operationClass: NodePeerOperationClasses.runtimeTrustMaterialReplication,
    });
    const denied = await resolver.resolveNodePeerCommunicationPolicy({
      localNodeId: "node:local:1",
      remoteNodeId: "node:remote:2",
      direction: "outbound",
      operationClass: NodePeerOperationClasses.runtimeTrustMaterialReplication,
    });

    expect(allowed.peerChannelsEnabled).toBeTrue();
    expect(allowed.allowedOperationClasses).toContain(NodePeerOperationClasses.runtimeTrustMaterialReplication);
    expect(allowed.exposedCapabilities).toContain(NodePeerCapabilities.runtimeTrustMaterialRead);
    expect(denied.peerChannelsEnabled).toBeFalse();
  });
});
