import {
  AuthProviderKinds,
  IdentityDomainError,
  IdentityLifecycleTransitionError,
  transitionUserIdentityStatus,
  validateCredentialCandidate,
  type AuthProviderKind,
  type CredentialPolicy,
  type UserIdentity,
  type UserIdentityStatus,
} from "./IdentityDomain";

export type IdentityPolicyIssueSeverity = "error";

export type IdentityPolicyIssueSection =
  | "principal"
  | "provider-reference"
  | "credential"
  | "status-transition";

export interface IdentityPolicyIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: IdentityPolicyIssueSeverity;
  readonly section: IdentityPolicyIssueSection;
}

export interface IdentityPolicyResult<TValue> {
  readonly valid: boolean;
  readonly value?: TValue;
  readonly issues: ReadonlyArray<IdentityPolicyIssue>;
}

export interface NormalizedIdentityProfileInput {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface NormalizedIdentityProfile {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface ProviderSubjectReferenceInput {
  readonly providerId: string;
  readonly providerSubject: string;
  readonly providerKind?: AuthProviderKind;
}

export interface ProviderSubjectReference {
  readonly providerId: string;
  readonly providerSubject: string;
}

function issue(
  code: string,
  path: string,
  message: string,
  section: IdentityPolicyIssueSection,
): IdentityPolicyIssue {
  return Object.freeze({
    code,
    path,
    message,
    severity: "error",
    section,
  });
}

function buildResult<TValue>(
  value: TValue | undefined,
  issues: ReadonlyArray<IdentityPolicyIssue>,
): IdentityPolicyResult<TValue> {
  return Object.freeze({
    valid: issues.length === 0,
    value,
    issues: Object.freeze(issues),
  });
}

function normalizeTrimmedRequired(
  value: string,
  path: string,
  label: string,
  section: IdentityPolicyIssueSection,
): IdentityPolicyResult<string> {
  const normalized = value.trim();
  if (!normalized) {
    return buildResult(undefined, [
      issue(`${path}-required`, path, `${label} is required.`, section),
    ]);
  }

  return buildResult(normalized, []);
}

export function normalizeIdentityUsername(username: string): IdentityPolicyResult<string> {
  const required = normalizeTrimmedRequired(username, "username", "Username", "principal");
  if (!required.valid || !required.value) {
    return required;
  }

  const normalized = required.value.toLowerCase();
  const issues: IdentityPolicyIssue[] = [];

  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    issues.push(
      issue(
        "username-invalid-format",
        "username",
        "Username may only include lowercase letters, numbers, period, underscore, and hyphen.",
        "principal",
      ),
    );
  }

  if (normalized.length > 64) {
    issues.push(
      issue(
        "username-too-long",
        "username",
        "Username cannot be longer than 64 characters.",
        "principal",
      ),
    );
  }

  return buildResult(issues.length === 0 ? normalized : undefined, issues);
}

export function normalizeIdentityEmail(email?: string): IdentityPolicyResult<string | undefined> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return buildResult(undefined, []);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return buildResult(undefined, [
      issue("email-invalid-format", "email", "Email must be a valid email address.", "principal"),
    ]);
  }

  return buildResult(normalized, []);
}

export function normalizeIdentityProfile(
  input: NormalizedIdentityProfileInput,
): IdentityPolicyResult<NormalizedIdentityProfile> {
  const username = normalizeIdentityUsername(input.username);
  const email = normalizeIdentityEmail(input.email);
  const displayName = input.displayName?.trim() ? input.displayName.trim() : undefined;
  const issues = [...username.issues, ...email.issues];

  if (issues.length > 0 || !username.value) {
    return buildResult(undefined, issues);
  }

  return buildResult(Object.freeze({
    username: username.value,
    email: email.value,
    displayName,
  }), issues);
}

export function normalizeProviderSubjectReference(
  input: ProviderSubjectReferenceInput,
): IdentityPolicyResult<ProviderSubjectReference> {
  const providerId = normalizeTrimmedRequired(input.providerId, "providerId", "Provider id", "provider-reference");
  const providerSubject = normalizeTrimmedRequired(
    input.providerSubject,
    "providerSubject",
    "Provider subject",
    "provider-reference",
  );

  const issues = [...providerId.issues, ...providerSubject.issues];
  if (issues.length > 0 || !providerId.value || !providerSubject.value) {
    return buildResult(undefined, issues);
  }

  return buildResult(
    Object.freeze({
      providerId: providerId.value,
      providerSubject: input.providerKind === AuthProviderKinds.localPassword
        ? providerSubject.value.toLowerCase()
        : providerSubject.value,
    }),
    [],
  );
}

export function evaluateCredentialPolicy(
  policy: CredentialPolicy,
  candidate: string,
): IdentityPolicyResult<{ readonly candidate: string; readonly policyId: string }> {
  const validation = validateCredentialCandidate(policy, candidate);
  const issues = validation.issues.map((entry) => issue(
    `credential-${entry.code}`,
    "credential",
    entry.message,
    "credential",
  ));

  return buildResult(
    issues.length === 0
      ? Object.freeze({
        candidate,
        policyId: policy.id,
      })
      : undefined,
    issues,
  );
}

export function evaluateIdentityStatusTransition(
  identity: UserIdentity,
  nextStatus: UserIdentityStatus,
  now: Date = new Date(),
): IdentityPolicyResult<UserIdentity> {
  try {
    const transitioned = transitionUserIdentityStatus(identity, nextStatus, now);
    return buildResult(transitioned, []);
  } catch (error) {
    if (error instanceof IdentityLifecycleTransitionError) {
      return buildResult(undefined, [
        issue(
          "status-transition-disallowed",
          "status",
          error.message,
          "status-transition",
        ),
      ]);
    }

    if (error instanceof IdentityDomainError) {
      return buildResult(undefined, [
        issue(
          "status-transition-invalid",
          "status",
          error.message,
          "status-transition",
        ),
      ]);
    }

    throw error;
  }
}

