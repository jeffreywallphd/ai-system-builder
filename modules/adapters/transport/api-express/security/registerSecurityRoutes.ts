import type { Express } from "express";

export function registerSecurityRoutes(app: Express, deps: { getStatus: () => Promise<any>; completePairing: (body: any) => Promise<any>; revokeToken: (body: any) => Promise<any> }) {
  app.get('/api/security/status', async (_req, res) => res.json({ ok: true, value: await deps.getStatus() }));
  app.post('/api/security/pairing/complete', async (req, res) => res.json({ ok: true, value: await deps.completePairing(req.body) }));
  app.post('/api/security/token/revoke', async (req, res) => res.json({ ok: true, value: await deps.revokeToken(req.body) }));
}
