import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const ComfyRuntimeLifecycleStates = Object.freeze({
  starting: "starting",
  healthy: "healthy",
  unhealthy: "unhealthy",
  stopped: "stopped",
  unknown: "unknown",
  timedOut: "timed-out",
} as const);

export type ComfyRuntimeLifecycleState =
  (typeof ComfyRuntimeLifecycleStates)[keyof typeof ComfyRuntimeLifecycleStates];

export const ComfyRuntimeLifecycleOperations = Object.freeze({
  start: "start",
  stop: "stop",
  restart: "restart",
  inspect: "inspect",
  validate: "validate",
} as const);

export type ComfyRuntimeLifecycleOperation =
  (typeof ComfyRuntimeLifecycleOperations)[keyof typeof ComfyRuntimeLifecycleOperations];

export const ComfyRuntimeLifecycleDiagnosticSchema = z.object({
  code: nonEmptyStringSchema,
  severity: z.enum(["error", "warning", "info"]).default("info"),
  message: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type ComfyRuntimeLifecycleDiagnostic = z.infer<typeof ComfyRuntimeLifecycleDiagnosticSchema>;

export const ComfyRuntimeEndpointValidationSchema = z.object({
  endpoint: nonEmptyStringSchema,
  readinessUrl: nonEmptyStringSchema,
  livenessUrl: nonEmptyStringSchema,
  valid: z.boolean(),
  diagnostics: z.array(ComfyRuntimeLifecycleDiagnosticSchema).default([]),
});

export type ComfyRuntimeEndpointValidation = z.infer<typeof ComfyRuntimeEndpointValidationSchema>;

export const ComfyRuntimeHealthProbeSchema = z.object({
  endpoint: nonEmptyStringSchema,
  readinessUrl: nonEmptyStringSchema,
  livenessUrl: nonEmptyStringSchema,
  readinessStatusCode: z.number().int().optional(),
  livenessStatusCode: z.number().int().optional(),
  healthy: z.boolean(),
  checkedAt: nonEmptyStringSchema,
  durationMs: z.number().int().nonnegative(),
});

export type ComfyRuntimeHealthProbe = z.infer<typeof ComfyRuntimeHealthProbeSchema>;

export const ComfyRuntimeLifecycleResultSchema = z.object({
  operation: z.enum([
    ComfyRuntimeLifecycleOperations.start,
    ComfyRuntimeLifecycleOperations.stop,
    ComfyRuntimeLifecycleOperations.restart,
    ComfyRuntimeLifecycleOperations.inspect,
    ComfyRuntimeLifecycleOperations.validate,
  ]),
  state: z.enum([
    ComfyRuntimeLifecycleStates.starting,
    ComfyRuntimeLifecycleStates.healthy,
    ComfyRuntimeLifecycleStates.unhealthy,
    ComfyRuntimeLifecycleStates.stopped,
    ComfyRuntimeLifecycleStates.unknown,
    ComfyRuntimeLifecycleStates.timedOut,
  ]),
  endpointValidation: ComfyRuntimeEndpointValidationSchema,
  health: ComfyRuntimeHealthProbeSchema.optional(),
  process: z.object({
    started: z.boolean().default(false),
    alreadyRunning: z.boolean().default(false),
    stopped: z.boolean().default(false),
    gracefulStop: z.boolean().default(false),
    forcedStop: z.boolean().default(false),
    pid: z.number().int().positive().optional(),
  }),
  startedAt: nonEmptyStringSchema,
  finishedAt: nonEmptyStringSchema,
  durationMs: z.number().int().nonnegative(),
  diagnostics: z.array(ComfyRuntimeLifecycleDiagnosticSchema).default([]),
  metadata: metadataSchema,
});

export type ComfyRuntimeLifecycleResult = z.infer<typeof ComfyRuntimeLifecycleResultSchema>;

export function createComfyRuntimeLifecycleDiagnostic(
  input: ComfyRuntimeLifecycleDiagnostic,
): ComfyRuntimeLifecycleDiagnostic {
  const parsed = ComfyRuntimeLifecycleDiagnosticSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createComfyRuntimeEndpointValidation(input: ComfyRuntimeEndpointValidation): ComfyRuntimeEndpointValidation {
  const parsed = ComfyRuntimeEndpointValidationSchema.parse(input);
  return Object.freeze({
    ...parsed,
    diagnostics: Object.freeze(parsed.diagnostics.map((entry) => createComfyRuntimeLifecycleDiagnostic(entry))),
  });
}

export function createComfyRuntimeHealthProbe(input: ComfyRuntimeHealthProbe): ComfyRuntimeHealthProbe {
  const parsed = ComfyRuntimeHealthProbeSchema.parse(input);
  return Object.freeze({ ...parsed });
}

export function createComfyRuntimeLifecycleResult(input: ComfyRuntimeLifecycleResult): ComfyRuntimeLifecycleResult {
  const parsed = ComfyRuntimeLifecycleResultSchema.parse(input);
  return Object.freeze({
    ...parsed,
    endpointValidation: createComfyRuntimeEndpointValidation(parsed.endpointValidation),
    health: parsed.health ? createComfyRuntimeHealthProbe(parsed.health) : undefined,
    process: Object.freeze({ ...parsed.process }),
    diagnostics: Object.freeze(parsed.diagnostics.map((entry) => createComfyRuntimeLifecycleDiagnostic(entry))),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}
