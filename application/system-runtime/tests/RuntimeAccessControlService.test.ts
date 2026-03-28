import { describe, expect, it } from "bun:test";
import {
  RuntimeAccessControlService,
  type ExecutionAccessDecision,
  type ExecutionAccessPolicy,
  type ExecutionAccessRequest,
} from "../RuntimeAccessControlService";

class SelectivePolicy implements ExecutionAccessPolicy {
  public readonly policyId = "selective";

  public evaluate(request: ExecutionAccessRequest): ExecutionAccessDecision {
    if (request.context?.callerId === "blocked") {
      return Object.freeze({ allowed: false, reasonCode: "blocked-caller", message: "Caller is blocked." });
    }
    return Object.freeze({ allowed: true });
  }
}

describe("RuntimeAccessControlService", () => {
  it("normalizes context and allows by default", () => {
    const service = new RuntimeAccessControlService();
    const decision = service.evaluate({
      context: {
        callerKind: "system",
        callerId: "  runtime-client  ",
        roles: ["external", "external", ""],
      },
      systemId: "  system:demo  ",
      versionId: "  system:demo:v1  ",
    });

    expect(decision.allowed).toBeTrue();
    expect(decision.policyId).toBe("allow-all");
  });

  it("returns structured deny decisions for custom policies", () => {
    const service = new RuntimeAccessControlService(new SelectivePolicy());
    const denied = service.evaluate({
      context: { callerKind: "user", callerId: "blocked" },
      systemId: "system:demo",
      versionId: "system:demo:v1",
    });

    expect(denied.allowed).toBeFalse();
    expect(denied.reasonCode).toBe("blocked-caller");
    expect(denied.message).toContain("blocked");
    expect(denied.policyId).toBe("selective");
  });
});
