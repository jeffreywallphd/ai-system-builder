import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const DefaultAuthoritativeServerStartupBaselineFileName = "authoritative-server-startup-baseline.json";
const StartupBaselineSchemaVersion = 1;
const DefaultMaximumSamples = 50;

export interface AuthoritativeServerStartupBaselineMeasurement {
  readonly hostId: string;
  readonly startupReason: string;
  readonly outcome: "succeeded" | "failed";
  readonly durationMs: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly traceId?: string;
  readonly startupCorrelationId?: string;
  readonly pipelineStageDurations: Readonly<Record<string, number>>;
  readonly authoritativeStageDurations: Readonly<Record<string, number>>;
}

interface AuthoritativeServerStartupBaselineSample {
  readonly recordedAt: string;
  readonly startupReason: string;
  readonly durationMs: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly traceId?: string;
  readonly startupCorrelationId?: string;
  readonly pipelineStageDurations: Readonly<Record<string, number>>;
  readonly authoritativeStageDurations: Readonly<Record<string, number>>;
}

interface AuthoritativeServerStartupBaselineDocument {
  readonly schemaVersion: number;
  readonly hostId: string;
  readonly updatedAt: string;
  readonly sampleCount: number;
  readonly samples: ReadonlyArray<AuthoritativeServerStartupBaselineSample>;
}

export async function recordAuthoritativeServerStartupBaseline(input: {
  readonly databasePath: string;
  readonly measurement: AuthoritativeServerStartupBaselineMeasurement;
  readonly filePath?: string;
  readonly maximumSamples?: number;
  readonly now?: () => Date;
}): Promise<void> {
  if (input.measurement.outcome !== "succeeded") {
    return;
  }

  const baselinePath = input.filePath
    ? path.resolve(input.filePath)
    : path.resolve(path.dirname(path.resolve(input.databasePath)), DefaultAuthoritativeServerStartupBaselineFileName);
  const now = input.now ?? (() => new Date());
  const maximumSamples = resolveMaximumSamples(input.maximumSamples);
  const recordedAt = now().toISOString();
  const sample = Object.freeze({
    recordedAt,
    startupReason: input.measurement.startupReason,
    durationMs: sanitizeDuration(input.measurement.durationMs),
    startedAt: input.measurement.startedAt,
    completedAt: input.measurement.completedAt,
    traceId: input.measurement.traceId,
    startupCorrelationId: input.measurement.startupCorrelationId,
    pipelineStageDurations: Object.freeze({ ...input.measurement.pipelineStageDurations }),
    authoritativeStageDurations: Object.freeze({ ...input.measurement.authoritativeStageDurations }),
  } satisfies AuthoritativeServerStartupBaselineSample);

  const existingDocument = await loadBaselineDocument(baselinePath);
  const hostId = existingDocument?.hostId ?? input.measurement.hostId;
  const trimmedSamples = [
    ...(existingDocument?.samples ?? []),
    sample,
  ].slice(-maximumSamples);
  const nextDocument = Object.freeze({
    schemaVersion: StartupBaselineSchemaVersion,
    hostId,
    updatedAt: recordedAt,
    sampleCount: trimmedSamples.length,
    samples: Object.freeze(trimmedSamples),
  } satisfies AuthoritativeServerStartupBaselineDocument);

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(nextDocument, undefined, 2)}\n`, "utf8");
}

async function loadBaselineDocument(
  baselinePath: string,
): Promise<AuthoritativeServerStartupBaselineDocument | undefined> {
  try {
    const content = await readFile(baselinePath, "utf8");
    return parseBaselineDocument(content);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function parseBaselineDocument(content: string): AuthoritativeServerStartupBaselineDocument | undefined {
  try {
    const parsed = JSON.parse(content) as Partial<AuthoritativeServerStartupBaselineDocument> | undefined;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    if (parsed.schemaVersion !== StartupBaselineSchemaVersion) {
      return undefined;
    }
    if (typeof parsed.hostId !== "string" || parsed.hostId.trim().length === 0) {
      return undefined;
    }
    if (!Array.isArray(parsed.samples)) {
      return undefined;
    }
    const samples: AuthoritativeServerStartupBaselineSample[] = [];
    for (const rawSample of parsed.samples) {
      const normalized = normalizeSample(rawSample);
      if (normalized) {
        samples.push(normalized);
      }
    }
    return Object.freeze({
      schemaVersion: StartupBaselineSchemaVersion,
      hostId: parsed.hostId,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      sampleCount: samples.length,
      samples: Object.freeze(samples),
    });
  } catch {
    return undefined;
  }
}

function normalizeSample(rawSample: unknown): AuthoritativeServerStartupBaselineSample | undefined {
  if (!rawSample || typeof rawSample !== "object") {
    return undefined;
  }
  const parsed = rawSample as Record<string, unknown>;
  const recordedAt = typeof parsed.recordedAt === "string" ? parsed.recordedAt : undefined;
  const startupReason = typeof parsed.startupReason === "string" ? parsed.startupReason : undefined;
  const durationMs = typeof parsed.durationMs === "number" ? sanitizeDuration(parsed.durationMs) : undefined;
  const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : undefined;
  const completedAt = typeof parsed.completedAt === "string" ? parsed.completedAt : undefined;
  if (!recordedAt || !startupReason || durationMs === undefined || !startedAt || !completedAt) {
    return undefined;
  }
  return Object.freeze({
    recordedAt,
    startupReason,
    durationMs,
    startedAt,
    completedAt,
    traceId: typeof parsed.traceId === "string" ? parsed.traceId : undefined,
    startupCorrelationId: typeof parsed.startupCorrelationId === "string" ? parsed.startupCorrelationId : undefined,
    pipelineStageDurations: normalizeDurationMap(parsed.pipelineStageDurations),
    authoritativeStageDurations: normalizeDurationMap(parsed.authoritativeStageDurations),
  });
}

function normalizeDurationMap(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object") {
    return Object.freeze({});
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([stageId, duration]) => (
      typeof stageId === "string"
      && stageId.trim().length > 0
      && typeof duration === "number"
      && Number.isFinite(duration)
      && duration >= 0
    ))
    .map(([stageId, duration]) => [stageId, sanitizeDuration(duration as number)] as const);
  return Object.freeze(Object.fromEntries(entries));
}

function sanitizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }
  return Math.floor(durationMs);
}

function resolveMaximumSamples(maximumSamples: number | undefined): number {
  if (maximumSamples === undefined) {
    return DefaultMaximumSamples;
  }
  if (!Number.isInteger(maximumSamples) || maximumSamples <= 0) {
    return DefaultMaximumSamples;
  }
  return maximumSamples;
}

function isFileNotFoundError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT",
  );
}
