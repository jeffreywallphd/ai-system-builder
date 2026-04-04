import { describe, expect, it } from "bun:test";
import { validateLoginForm, validateRegisterForm } from "../IdentityAuthValidation";

describe("IdentityAuthValidation", () => {
  it("validates required login fields", () => {
    const issues = validateLoginForm({ providerSubject: "", password: "" });
    expect(issues.length).toBe(2);
  });

  it("validates register form email and password confirmation", () => {
    const issues = validateRegisterForm({
      username: "alice",
      email: "invalid-email",
      password: "secret-1",
      confirmPassword: "secret-2",
    });

    expect(issues.map((issue) => issue.field)).toContain("email");
    expect(issues.map((issue) => issue.field)).toContain("confirmPassword");
  });
});
