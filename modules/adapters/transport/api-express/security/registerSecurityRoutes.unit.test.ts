import { describe, expect, it } from "vitest";
import { createSecurityApplicationError } from "../../../../contracts/security";
import { registerSecurityRoutes } from "./registerSecurityRoutes";

type Handler = (req: any, res: any) => Promise<void> | void;
function makeApp() {
  const routes = new Map<string, Handler>();
  return {
    routes,
    get(path: string, handler: Handler) { routes.set(`GET ${path}`, handler); },
    post(path: string, handler: Handler) { routes.set(`POST ${path}`, handler); },
  } as any;
}
function makeRes() {
  const out: any = { statusCode: 200, body: undefined };
  out.status = (code: number) => { out.statusCode = code; return out; };
  out.json = (body: unknown) => { out.body = body; return out; };
  return out;
}

describe("registerSecurityRoutes", () => {
  it("maps pairing security application errors to canonical codes", async () => {
    const app = makeApp();
    registerSecurityRoutes(app, {
      getStatus: async () => ({}),
      completePairing: async () => { throw createSecurityApplicationError("security.pairing-code-invalid", "Invalid pairing code."); },
      revokeToken: async () => ({}),
    });
    const handler = app.routes.get("POST /api/security/pairing/complete");
    const res = makeRes();
    await handler({ body: { pairingCode: "ABC" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain("ABC");
  });

  it("returns stable validation error for malformed request", async () => {
    const app = makeApp();
    registerSecurityRoutes(app, { getStatus: async () => ({}), completePairing: async () => ({}), revokeToken: async () => ({}) });
    const handler = app.routes.get("POST /api/security/pairing/complete");
    const res = makeRes();
    await handler({ body: { pairingCode: "" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation");
    expect(res.body.error.kind).toBe("client");
  });
});
