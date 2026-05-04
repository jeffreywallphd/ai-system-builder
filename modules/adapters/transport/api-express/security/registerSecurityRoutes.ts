import type { Express } from "express";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";
import { SECURITY_SCOPES, type CompleteLanPairingRequest, type SecurityScope } from "../../../../contracts/security";
import { getExpressAuthContext } from "./expressAuthContext";

interface RevokeRequest { deviceId: string }
const KNOWN_SCOPES = new Set<SecurityScope>(SECURITY_SCOPES);
const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) throw new Error("Request body must be an object.");
  return value as Record<string, unknown>;
};

function normalizePairingRequest(value: unknown): CompleteLanPairingRequest {
  const body = asRecord(value);
  if (typeof body.pairingCode !== "string" || body.pairingCode.trim().length < 1) throw new Error("pairingCode is required.");
  const normalized: CompleteLanPairingRequest = { pairingCode: body.pairingCode.trim() };
  if (body.deviceName !== undefined) {
    if (typeof body.deviceName !== "string" || body.deviceName.trim().length < 1) throw new Error("deviceName must be a non-empty string.");
    normalized.deviceName = body.deviceName.trim();
  }
  if (body.requestedScopes !== undefined) {
    if (!Array.isArray(body.requestedScopes)) throw new Error("requestedScopes must be an array.");
    const requestedScopes = body.requestedScopes.map((scope) => {
      if (typeof scope !== "string" || !KNOWN_SCOPES.has(scope as SecurityScope)) throw new Error("requestedScopes contains unknown scope.");
      return scope as SecurityScope;
    });
    normalized.requestedScopes = requestedScopes;
  }
  return normalized;
}

export function registerSecurityRoutes(app: Express, deps: { getStatus: (authContext?: unknown) => Promise<unknown>; completePairing: (body: CompleteLanPairingRequest) => Promise<unknown>; revokeToken: (body: RevokeRequest) => Promise<unknown> }) {
  app.get('/api/security/status', async (req, res) => {
    try {
      res.status(200).json(createApiSuccessResponse("security.status", await deps.getStatus(getExpressAuthContext(req))));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Security status failed.";
      res.status(500).json(createApiFailureResponse(createApiError("security.status", "internal", message)));
    }
  });

  app.post('/api/security/pairing/complete', async (req, res) => {
    try {
      res.status(200).json(createApiSuccessResponse("security.pairing.complete", await deps.completePairing(normalizePairingRequest(req.body))));
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
