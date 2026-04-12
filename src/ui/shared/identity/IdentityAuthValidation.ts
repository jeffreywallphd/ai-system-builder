export interface LoginFormValidationInput {
  readonly providerSubject: string;
  readonly password: string;
}

export interface RegisterFormValidationInput {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface IdentityValidationIssue {
  readonly field: string;
  readonly message: string;
}

export function validateLoginForm(
  input: LoginFormValidationInput,
): ReadonlyArray<IdentityValidationIssue> {
  const issues: IdentityValidationIssue[] = [];

  if (!input.providerSubject.trim()) {
    issues.push({ field: "providerSubject", message: "Username is required." });
  }
  if (!input.password) {
    issues.push({ field: "password", message: "Password is required." });
  }

  return Object.freeze(issues);
}

export function validateRegisterForm(
  input: RegisterFormValidationInput,
): ReadonlyArray<IdentityValidationIssue> {
  const issues: IdentityValidationIssue[] = [];

  if (!input.username.trim()) {
    issues.push({ field: "username", message: "Username is required." });
  }
  if (input.email.trim() && !isEmailFormat(input.email)) {
    issues.push({ field: "email", message: "Email must be a valid address." });
  }
  if (!input.password) {
    issues.push({ field: "password", message: "Password is required." });
  }
  if (!input.confirmPassword) {
    issues.push({ field: "confirmPassword", message: "Confirm password is required." });
  }
  if (input.password && input.confirmPassword && input.password !== input.confirmPassword) {
    issues.push({ field: "confirmPassword", message: "Passwords do not match." });
  }

  return Object.freeze(issues);
}

function isEmailFormat(candidate: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.trim());
}
