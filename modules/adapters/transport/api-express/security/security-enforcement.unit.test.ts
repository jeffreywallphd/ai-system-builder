import { describe, expect, it } from "vitest";
import { API_ROUTE_POLICIES, resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";
import { createExpressSecurityMiddleware } from "./createExpressSecurityMiddleware";
import { createSecurityApplicationError } from "../../../../contracts/security";
import { createInMemoryDevSecurityEnforcementStore } from "./devSecurityEnforcement";

describe("api route security policy coverage", () => {
  it("has explicit policy entries for registered API routes", () => {
    expect(API_ROUTE_POLICIES.size).toBeGreaterThan(20);
    const publicRoutes = [...API_ROUTE_POLICIES.entries()].filter(([, p]) => p.public).map(([route]) => route).sort();
    expect(publicRoutes).toContain("GET /api/security/status");
    expect(API_ROUTE_POLICIES.get("POST /api/security/token/revoke")?.public).toBe(false);
  });

  it("denies unknown api routes", () => {
    expect(resolveApiRoutePolicy("GET", "/api/unknown")).toMatchObject({ deny: true, securityCode: "security.route-policy-missing" });
  });
});

describe("security middleware", () => {
  it("disabled-dev allows missing token", async () => {
    const middleware = createExpressSecurityMiddleware({ httpsRequired: false, authRequired: false, mode: "disabled-dev", verifyToken: async () => ({ principal: { id: "p", scopes: ["model:read"] }, auth: { method: "bearer-token" } } as any) });
    const req:any = { method: "POST", path: "/api/model/browse", protocol: "http", headers: {} };
    const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
    let nextCalled=false; await middleware(req,res,()=>{nextCalled=true;}); expect(nextCalled).toBe(true);
  });

  it("enforces token when dev mode is lan-token-enforced", async () => {
    const store = createInMemoryDevSecurityEnforcementStore("disabled-dev");
    store.setMode("lan-token-enforced");
    const middleware = createExpressSecurityMiddleware({ httpsRequired: false, authRequired: false, mode: "disabled-dev", devSecurityEnforcement: store, verifyToken: async () => ({ principal: { id: "p", scopes: ["model:read"] }, auth: { method: "bearer-token" } } as any) });
    const req:any = { method: "POST", path: "/api/model/browse", protocol: "http", headers: {} };
    const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
    await middleware(req,res,()=>{});
    expect(res.statusCode).toBe(401);
  });

  it("maps auth failures", async () => {
    const middleware = createExpressSecurityMiddleware({ httpsRequired: true, authRequired: true, mode: "lan-https-token", verifyToken: async () => { throw createSecurityApplicationError("security.invalid-token", "x"); } });
    const req:any = { method: "POST", path: "/api/model/browse", protocol: "https", headers: { authorization: "Bearer bad" } };
    const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
    await middleware(req,res,()=>{});
    expect(res.body.error.code).toBe("unauthorized");
  });
});
