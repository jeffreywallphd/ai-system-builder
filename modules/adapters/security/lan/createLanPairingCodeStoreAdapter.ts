import type { PairingCodeStorePort } from "../../../application/ports/security";

export function createLanPairingCodeStoreAdapter(): PairingCodeStorePort {
  return {
    async consumePairingCode({ pairingCode }) {
      if (pairingCode === "PAIR-ME") {
        return { status: "valid", defaultDeviceName: "LAN Device", defaultScopes: ["model:read", "artifact:read", "image-generation:read"] };
      }
      return { status: "invalid" };
    },
  };
}
