import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const PythonRuntimeProvisioningIssueSchema = z.object({
  code: nonEmptyStringSchema,
  severity: z.enum(["error", "warning"]).default("error"),
  message: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type PythonRuntimeProvisioningIssue = z.infer<typeof PythonRuntimeProvisioningIssueSchema>;

export const PythonRuntimeProvisioningErrorSchema = z.object({
  code: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  retryable: z.boolean().default(false),
  metadata: metadataSchema,
});

export type PythonRuntimeProvisioningError = z.infer<typeof PythonRuntimeProvisioningErrorSchema>;

export const PythonRuntimeRemediationHintSchema = z.object({
  code: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type PythonRuntimeRemediationHint = z.infer<typeof PythonRuntimeRemediationHintSchema>;

export const PythonRuntimeCommandDiagnosticSchema = z.object({
  command: nonEmptyStringSchema,
  args: z.array(z.string()).default([]),
  exitCode: z.number().int(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
});

export type PythonRuntimeCommandDiagnostic = z.infer<typeof PythonRuntimeCommandDiagnosticSchema>;

export const PythonRuntimeDetectionStates = Object.freeze({
  available: "available",
  missing: "missing",
  incompatible: "incompatible",
} as const);

export const PythonRuntimeDetectionResultSchema = z.object({
  state: z.enum([
    PythonRuntimeDetectionStates.available,
    PythonRuntimeDetectionStates.missing,
    PythonRuntimeDetectionStates.incompatible,
  ]),
  requirement: nonEmptyStringSchema.optional(),
  command: nonEmptyStringSchema.optional(),
  executablePath: nonEmptyStringSchema.optional(),
  version: nonEmptyStringSchema.optional(),
  issues: z.array(PythonRuntimeProvisioningIssueSchema).default([]),
  diagnostics: z.array(PythonRuntimeCommandDiagnosticSchema).default([]),
});

export type PythonRuntimeDetectionResult = z.infer<typeof PythonRuntimeDetectionResultSchema>;

export const PythonEnvironmentProvisioningStatuses = Object.freeze({
  created: "created",
  reused: "reused",
  recreated: "recreated",
  failed: "failed",
} as const);

export const PythonRuntimeEnvironmentRecordSchema = z.object({
  environmentDirectory: nonEmptyStringSchema,
  pythonExecutable: nonEmptyStringSchema,
  sourceInterpreter: nonEmptyStringSchema,
  metadataPath: nonEmptyStringSchema,
});

export type PythonRuntimeEnvironmentRecord = z.infer<typeof PythonRuntimeEnvironmentRecordSchema>;

export const PythonRuntimeEnvironmentProvisioningResultSchema = z.object({
  status: z.enum([
    PythonEnvironmentProvisioningStatuses.created,
    PythonEnvironmentProvisioningStatuses.reused,
    PythonEnvironmentProvisioningStatuses.recreated,
    PythonEnvironmentProvisioningStatuses.failed,
  ]),
  detection: PythonRuntimeDetectionResultSchema,
  environment: PythonRuntimeEnvironmentRecordSchema.optional(),
  issues: z.array(PythonRuntimeProvisioningIssueSchema).default([]),
  diagnostics: z.array(PythonRuntimeCommandDiagnosticSchema).default([]),
  remediation: z.array(PythonRuntimeRemediationHintSchema).default([]),
  error: PythonRuntimeProvisioningErrorSchema.optional(),
});

export type PythonRuntimeEnvironmentProvisioningResult = z.infer<typeof PythonRuntimeEnvironmentProvisioningResultSchema>;

export const PythonDependencyInstallStatuses = Object.freeze({
  started: "started",
  completed: "completed",
  failed: "failed",
  skipped: "skipped",
} as const);

export const PythonDependencyInstallStateSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum([
    PythonDependencyInstallStatuses.started,
    PythonDependencyInstallStatuses.completed,
    PythonDependencyInstallStatuses.failed,
    PythonDependencyInstallStatuses.skipped,
  ]),
  startedAt: nonEmptyStringSchema,
  completedAt: nonEmptyStringSchema.optional(),
  lastAttemptedStep: nonEmptyStringSchema,
  dependencySource: nonEmptyStringSchema,
  environmentDirectory: nonEmptyStringSchema,
  requirementsPath: nonEmptyStringSchema.optional(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  issueCodes: z.array(nonEmptyStringSchema).default([]),
  remediation: z.array(PythonRuntimeRemediationHintSchema).default([]),
  metadata: metadataSchema,
});

export type PythonDependencyInstallState = z.infer<typeof PythonDependencyInstallStateSchema>;

export const PythonDependencyInstallResultSchema = z.object({
  status: z.enum([
    PythonDependencyInstallStatuses.completed,
    PythonDependencyInstallStatuses.failed,
    PythonDependencyInstallStatuses.skipped,
  ]),
  state: PythonDependencyInstallStateSchema,
  issues: z.array(PythonRuntimeProvisioningIssueSchema).default([]),
  diagnostics: z.array(PythonRuntimeCommandDiagnosticSchema).default([]),
  error: PythonRuntimeProvisioningErrorSchema.optional(),
});

export type PythonDependencyInstallResult = z.infer<typeof PythonDependencyInstallResultSchema>;

export function createPythonRuntimeProvisioningIssue(input: PythonRuntimeProvisioningIssue): PythonRuntimeProvisioningIssue {
  const parsed = PythonRuntimeProvisioningIssueSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createPythonRuntimeProvisioningError(input: PythonRuntimeProvisioningError): PythonRuntimeProvisioningError {
  const parsed = PythonRuntimeProvisioningErrorSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createPythonRuntimeRemediationHint(input: PythonRuntimeRemediationHint): PythonRuntimeRemediationHint {
  const parsed = PythonRuntimeRemediationHintSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createPythonRuntimeCommandDiagnostic(input: PythonRuntimeCommandDiagnostic): PythonRuntimeCommandDiagnostic {
  const parsed = PythonRuntimeCommandDiagnosticSchema.parse(input);
  return Object.freeze({
    ...parsed,
    args: Object.freeze([...parsed.args]),
  });
}

export function createPythonRuntimeDetectionResult(input: PythonRuntimeDetectionResult): PythonRuntimeDetectionResult {
  const parsed = PythonRuntimeDetectionResultSchema.parse(input);
  return Object.freeze({
    ...parsed,
    issues: Object.freeze(parsed.issues.map((entry) => createPythonRuntimeProvisioningIssue(entry))),
    diagnostics: Object.freeze(parsed.diagnostics.map((entry) => createPythonRuntimeCommandDiagnostic(entry))),
  });
}

export function createPythonRuntimeEnvironmentProvisioningResult(
  input: PythonRuntimeEnvironmentProvisioningResult,
): PythonRuntimeEnvironmentProvisioningResult {
  const parsed = PythonRuntimeEnvironmentProvisioningResultSchema.parse(input);
  return Object.freeze({
    ...parsed,
    detection: createPythonRuntimeDetectionResult(parsed.detection),
    environment: parsed.environment ? Object.freeze({ ...parsed.environment }) : undefined,
    issues: Object.freeze(parsed.issues.map((entry) => createPythonRuntimeProvisioningIssue(entry))),
    diagnostics: Object.freeze(parsed.diagnostics.map((entry) => createPythonRuntimeCommandDiagnostic(entry))),
    remediation: Object.freeze(parsed.remediation.map((entry) => createPythonRuntimeRemediationHint(entry))),
    error: parsed.error ? createPythonRuntimeProvisioningError(parsed.error) : undefined,
  });
}

export function createPythonDependencyInstallState(input: PythonDependencyInstallState): PythonDependencyInstallState {
  const parsed = PythonDependencyInstallStateSchema.parse(input);
  return Object.freeze({
    ...parsed,
    remediation: Object.freeze(parsed.remediation.map((entry) => createPythonRuntimeRemediationHint(entry))),
    issueCodes: Object.freeze([...parsed.issueCodes]),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createPythonDependencyInstallResult(input: PythonDependencyInstallResult): PythonDependencyInstallResult {
  const parsed = PythonDependencyInstallResultSchema.parse(input);
  return Object.freeze({
    ...parsed,
    state: createPythonDependencyInstallState(parsed.state),
    issues: Object.freeze(parsed.issues.map((entry) => createPythonRuntimeProvisioningIssue(entry))),
    diagnostics: Object.freeze(parsed.diagnostics.map((entry) => createPythonRuntimeCommandDiagnostic(entry))),
    error: parsed.error ? createPythonRuntimeProvisioningError(parsed.error) : undefined,
  });
}
