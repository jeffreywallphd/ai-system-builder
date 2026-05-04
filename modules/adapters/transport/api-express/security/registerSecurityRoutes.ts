import type { Express } from "express";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";

interface PairingRequest { pairingCode: string }
interface RevokeRequest { deviceId: string }

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) throw new Error("Request body must be an object.");
  return value as Record<string, unknown>;
};

export function registerSecurityRoutes(app: Express, deps: { getStatus: () => Promise<unknown>; completePairing: (body: PairingRequest) => Promise<unknown>; revokeToken: (body: RevokeRequest) => Promise<unknown> }) {
  app.get('/api/security/status', async (_req, res) => {
    try {
      res.status(200).json(createApiSuccessResponse("security.status", await deps.getStatus()));
    } catch (error) {
      res.status(500).json(createApiFailureResponse(createApiError("security.status", "internal", error instanceof Error ? error.message : "Security status failed.")));
    }
  });

  app.post('/api/security/pairing/complete', async (req, res) => {
    try {
      const body = asRecord(req.body);
      if (typeof body.pairingCode !== "string" || body.pairingCode.trim().length < 1) throw new Error("pairingCode is required.");
      res.status(200).json(createApiSuccessResponse("security.pairing.complete", await deps.completePairing({ pairingCode: body.pairingCode })));
    } catch (error) {
      res.status(400).json(createApiFailureResponse(createApiError("security.pairing.complete", "validation", error instanceof Error ? error.message : "Invalid pairing request.")));
    }
  });

  app.post('/api/security/token/revoke', async (req, res) => {
    try {
      const body = asRecord(req.body);
      if (typeof body.deviceId !== "string" || body.deviceId.trim().length < 1) throw new Error("deviceId is required.");
      res.status(200).json(createApiSuccessResponse("security.token.revoke", await deps.revokeToken({ deviceId: body.deviceId })));
    } catch (error) {
      res.status(400).json(createApiFailureResponse(createApiError("security.token.revoke", "validation", error instanceof Error ? error.message : "Invalid revoke request.")));
    }
  });
}
