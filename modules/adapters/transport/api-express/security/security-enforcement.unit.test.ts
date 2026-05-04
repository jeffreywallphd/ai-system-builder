import { describe, expect, it } from "vitest";
import { API_ROUTE_POLICIES, resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";
import { createExpressSecurityMiddleware } from "./createExpressSecurityMiddleware";
import { createSecurityApplicationError } from "../../../../contracts/security";


describe("api route security policy coverage", () => {
  it("has explicit policy entries for registered API routes", () => {
    expect(API_ROUTE_POLICIES.size).toBeGreaterThan(20);
    for (const key of API_ROUTE_POLICIES.keys()) expect(key.startsWith("GET /api/") || key.startsWith("POST /api/") || key.startsWith("DELETE /api/")).toBe(true);
    const publicRoutes = [...API_ROUTE_POLICIES.entries()].filter(([, p]) => p.public).map(([route]) => route).sort();
    expect(publicRoutes).toEqual(["GET /api/security/status", "POST /api/security/pairing/complete"]);
    expect(API_ROUTE_POLICIES.get("POST /api/security/token/revoke")?.public).toBe(false);
  });

  it("denies unknown api routes", () => {
    expect(resolveApiRoutePolicy("GET", "/api/unknown")).toMatchObject({ deny: true, securityCode: "security.route-policy-missing" });
  });
});

function makeRes(){ const state:any={statusCode:200, body:undefined}; return {state, status:(c:number)=>{state.statusCode=c; return res;}, json:(b:unknown)=>{state.body=b; return res;}} as any; var res:any; }

describe("security middleware", () => {
  it("disabled-dev allows missing token", async () => {
    const middleware = createExpressSecurityMiddleware({ httpsRequired: false, authRequired: false, verifyToken: async () => ({ principal: { id: "p", scopes: ["model:read"] }, auth: { method: "bearer-token" } } as any) });
    const req:any = { method: "POST", path: "/api/model/browse", protocol: "http", headers: {} };
    const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
    let nextCalled=false; await middleware(req,res,()=>{nextCalled=true;}); expect(nextCalled).toBe(true);
  });

  it("maps auth failures", async () => {
    const check = async (errorCode: string, expected: string) => {
      const middleware = createExpressSecurityMiddleware({ httpsRequired: true, authRequired: true, verifyToken: async () => { throw createSecurityApplicationError(errorCode as any, "x"); } });
      const req:any = { method: "POST", path: "/api/model/browse", protocol: "https", headers: { authorization: "Bearer bad" } };
      const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
      await middleware(req,res,()=>{});
      expect(res.body.error.code).toBe(expected);
    };
    await check("security.invalid-token","unauthorized");
    await check("security.expired-token","unauthorized");
    await check("security.revoked-token","unauthorized");
  });
});
