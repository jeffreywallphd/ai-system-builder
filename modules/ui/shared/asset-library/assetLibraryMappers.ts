import type {
  AssetFamily,
  AssetJsonValue,
  AssetLifecycleStatus,
  AssetMetadata,
  AssetReference,
  AssetType,
} from "../../../contracts/asset";
import type {
  AssetLibraryClientError,
  AssetLibraryDefinitionCard,
  AssetLibraryDefinitionDetail,
  AssetLibraryListResult,
} from "./assetLibraryReadModels";

const UNSAFE_KEY_PATTERN =
  /(token|secret|password|credential|authorization|auth|storagerootdirectory|runtimerootdirectory|localpath|filesystempath|filepath|path|cache|bytes|blob|contentbase64|base64|raw|payload|command|stack|env|apikey|apiKey)/i;
const LOCAL_PATH_VALUE_PATTERN =
  /(^~\/|^\.\.?\/|^\/(?:tmp|var|home|users|etc|private|opt|usr|mnt|volumes)(?:\/|$)|^[a-z]:[\\/]|\\(?:Users|Temp)\\|\/(?:tmp|temp)\/)/i;
const SECRET_VALUE_PATTERN =
  /(bearer\s+[a-z0-9._~+/=-]+|\bapi[_-]?key\b|\bapikey\b|\btoken\b|\bpassword\b|\bsecret\b|authorization\s*:)/i;
const UNSAFE_DIAGNOSTIC_VALUE_PATTERN =
  /\b(stack|command|base64|blob|raw provider payload|provider payload|raw exception|exception message)\b/i;
const DATA_BASE64_VALUE_PATTERN = /^data:[^,;]+;base64,/i;
const LONG_BASE64_VALUE_PATTERN = /^[A-Za-z0-9+/]{80,}={0,2}$/;

interface EnvelopeLike {
  readonly ok?: boolean;
  readonly value?: unknown;
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly details?: unknown;
  };
  readonly requestId?: unknown;
  readonly correlationId?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    LOCAL_PATH_VALUE_PATTERN.test(trimmed) ||
    SECRET_VALUE_PATTERN.test(trimmed) ||
    UNSAFE_DIAGNOSTIC_VALUE_PATTERN.test(trimmed) ||
    DATA_BASE64_VALUE_PATTERN.test(trimmed) ||
    LONG_BASE64_VALUE_PATTERN.test(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

function safeJsonValue(value: unknown, seen = new WeakSet<object>()): AssetJsonValue | undefined {
  if (value === null || typeof value === "boolean") return value as AssetJsonValue;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return safeString(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) return undefined;
    seen.add(value);
    const entries = value
      .map((entry) => safeJsonValue(entry, seen))
      .filter((entry): entry is AssetJsonValue => entry !== undefined);
    seen.delete(value);
    return entries;
  }
  if (isRecord(value)) {
    if (seen.has(value)) return undefined;
    seen.add(value);
    const entries = Object.entries(value)
      .filter(([key]) => !UNSAFE_KEY_PATTERN.test(key))
      .map(([key, entry]) => [key, safeJsonValue(entry, seen)] as const)
      .filter((entry): entry is readonly [string, AssetJsonValue] => entry[1] !== undefined);
    seen.delete(value);
    return Object.fromEntries(entries) as Record<string, AssetJsonValue>;
  }
  return undefined;
}

export function sanitizeAssetLibraryMetadata(value: unknown): AssetMetadata | undefined {
  const sanitized = safeJsonValue(value);
  if (!isRecord(sanitized) || Object.keys(sanitized).length === 0) return undefined;
  return sanitized as AssetMetadata;
}

function safeArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function refFrom(value: unknown): AssetReference | undefined {
  if (!isRecord(value) || typeof value.kind !== "string" || typeof value.id !== "string") return undefined;
  return {
    kind: value.kind as AssetReference["kind"],
    id: value.id as AssetReference["id"],
    ...(typeof value.version === "string" ? { version: value.version } : {}),
  };
}

function stringArray(values: readonly unknown[]): readonly string[] {
  return Array.from(new Set(values.map((value) => safeString(value)).filter((value): value is string => Boolean(value))));
}

function countIssues(validationSummary: Record<string, unknown> | undefined) {
  const issues = safeArray(validationSummary?.issues);
  const severity = (issue: unknown) => isRecord(issue) && typeof issue.severity === "string" ? issue.severity : undefined;
  return {
    issueCount: issues.length,
    errorCount: issues.filter((issue) => severity(issue) === "error").length,
    warningCount: issues.filter((issue) => severity(issue) === "warning").length,
  };
}

function buildCardId(definitionId: string, version: string): string {
  return `${definitionId}@${version}`;
}

export function mapAssetDefinitionCard(payload: unknown): AssetLibraryDefinitionCard {
  const card = isRecord(payload) ? payload : {};
  const definitionId = safeString(card.definitionId) ?? "unknown-definition";
  const version = safeString(card.version) ?? "unknown-version";
  const displayName = safeString(card.displayName) ?? definitionId;
  const assetType = safeString(card.assetType) as AssetType | undefined;
  const assetFamily = safeString(card.assetFamily) as AssetFamily | undefined;
  const lifecycleStatus = safeString(card.lifecycleStatus) as AssetLifecycleStatus | undefined;
  const updatedAt = safeString(card.updatedAt) ?? (isRecord(card.provenance) ? safeString(card.provenance.updatedAt) : undefined);
  const badges = [
    card.builtIn === true ? "Built-in" : undefined,
    lifecycleStatus,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    id: buildCardId(definitionId, version),
    definitionId,
    definitionRef: refFrom(card.definitionRef),
    version,
    displayName,
    summary: safeString(card.summary),
    assetType: assetType ?? "tool",
    assetFamily: assetFamily ?? "behavioral",
    lifecycleStatus: lifecycleStatus ?? "draft",
    builtIn: card.builtIn === true,
    updatedAt,
    ...(badges.length > 0 ? { badges } : {}),
  };
}

export function mapAssetDefinitionListResult(payload: unknown): AssetLibraryListResult<AssetLibraryDefinitionCard> {
  const result = isRecord(payload) ? payload : {};
  return {
    items: safeArray(result.items).map(mapAssetDefinitionCard),
    ...(safeString(result.nextCursor) ? { nextCursor: safeString(result.nextCursor) } : {}),
    diagnostics: safeArray(result.diagnostics)
      .map((diagnostic) => {
        if (!isRecord(diagnostic)) return undefined;
        const severity = safeString(diagnostic.severity);
        const code = safeString(diagnostic.code);
        const message = safeString(diagnostic.message);
        if (!severity || !code || !message) return undefined;
        if (severity !== "info" && severity !== "warning" && severity !== "error") return undefined;
        return { severity, code, message };
      })
      .filter((diagnostic): diagnostic is { severity: "info" | "warning" | "error"; code: string; message: string } => Boolean(diagnostic)),
  };
}

export function mapAssetDefinitionDetail(payload: unknown): AssetLibraryDefinitionDetail {
  const detail = isRecord(payload) ? payload : {};
  const definition = isRecord(detail.definition) ? detail.definition : detail;
  const card = mapAssetDefinitionCard({
    definitionRef: detail.definitionRef ?? { kind: "asset-definition", id: definition.definitionId, version: definition.version },
    definitionId: definition.definitionId,
    version: definition.version,
    displayName: definition.displayName,
    summary: definition.summary ?? definition.description,
    assetType: definition.assetType,
    assetFamily: definition.assetFamily,
    lifecycleStatus: definition.lifecycleStatus,
    builtIn: detail.builtIn,
    provenance: definition.provenance,
  });
  const aiContext = isRecord(definition.aiContext) ? definition.aiContext : undefined;
  const configurationSchema = isRecord(definition.configurationSchema) ? definition.configurationSchema : undefined;
  const ports = safeArray(definition.ports);
  const requirements = safeArray(definition.requirements);
  const provenance = isRecord(definition.provenance) ? definition.provenance : undefined;
  const validationSummary = isRecord(detail.validationSummary) ? detail.validationSummary : undefined;
  const issueCounts = countIssues(validationSummary);
  const metadata = sanitizeAssetLibraryMetadata(definition.metadata ?? detail.metadata);

  return {
    ...card,
    overview: {
      description: safeString(definition.description),
      reviewStatus: safeString(definition.reviewStatus),
    },
    ...(aiContext ? {
      aiContextSummary: {
        purpose: safeString(aiContext.purpose),
        userFacingSummary: safeString(aiContext.userFacingSummary),
        developerFacingSummary: safeString(aiContext.developerFacingSummary),
        capabilityCount: safeArray(aiContext.capabilities).length,
        limitationCount: safeArray(aiContext.limitations).length,
        safetyNoteCount: safeArray(aiContext.safetyNotes).length,
      },
    } : {}),
    ...(configurationSchema ? {
      configurationSummary: {
        schemaId: safeString(configurationSchema.schemaId),
        schemaVersion: safeString(configurationSchema.schemaVersion),
        fieldCount: safeArray(configurationSchema.fields).length,
        requiredFieldCount: safeArray(configurationSchema.requiredFieldIds).length,
        strict: typeof configurationSchema.strict === "boolean" ? configurationSchema.strict : undefined,
        description: safeString(configurationSchema.description),
      },
    } : {}),
    ...(ports.length > 0 ? {
      portsSummary: {
        totalCount: ports.length,
        inputCount: ports.filter((port) => isRecord(port) && port.direction === "input").length,
        outputCount: ports.filter((port) => isRecord(port) && port.direction === "output").length,
        eventCount: ports.filter((port) => isRecord(port) && port.direction === "event").length,
        controlCount: ports.filter((port) => isRecord(port) && port.direction === "control").length,
      },
    } : {}),
    ...(requirements.length > 0 ? {
      requirementsSummary: {
        totalCount: requirements.length,
        requiredCount: requirements.filter((requirement) => isRecord(requirement) && requirement.required === true).length,
        runtimeCapabilityIds: stringArray(requirements.map((requirement) => isRecord(requirement) ? requirement.runtimeCapabilityId : undefined)),
        hostKinds: stringArray(requirements.map((requirement) => isRecord(requirement) ? requirement.hostKind : undefined)),
        safetyStatuses: stringArray(requirements.map((requirement) => isRecord(requirement) ? requirement.safetyStatus : undefined)),
      },
    } : {}),
    ...(provenance ? {
      provenanceSummary: {
        sourceKind: safeString(provenance.sourceKind),
        authorship: safeString(provenance.authorship),
        createdAt: safeString(provenance.createdAt),
        updatedAt: safeString(provenance.updatedAt),
        redactedGenerationSummary: safeString(provenance.redactedGenerationSummary),
      },
    } : {}),
    ...(validationSummary ? {
      validationSummary: {
        status: safeString(validationSummary.status),
        ...issueCounts,
        validatedAt: safeString(validationSummary.validatedAt),
      },
    } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function mapTransportEnvelopeSuccess<T>(
  response: unknown,
  mapper: (payload: unknown) => T,
): { ok: true; value: T } | undefined {
  const envelope = response as EnvelopeLike;
  if (!isRecord(envelope) || envelope.ok !== true) return undefined;
  return { ok: true, value: mapper(envelope.value) };
}

export function mapTransportEnvelopeError(
  response: unknown,
  options: { status?: number; fallbackMessage?: string } = {},
): AssetLibraryClientError {
  const envelope = isRecord(response) ? response as EnvelopeLike : {};
  const rawCode = isRecord(envelope.error) ? envelope.error.code : undefined;
  const code = safeString(rawCode) ?? "internal";
  const status = options.status;
  const normalizedCode = status === 404 && code === "internal" ? "not-found" : code;
  const fieldIssues = fieldIssuesFrom(isRecord(envelope.error) ? envelope.error.details : undefined);

  return {
    code: normalizedCode,
    message: safeErrorMessage(normalizedCode, isRecord(envelope.error) ? envelope.error.message : undefined, options.fallbackMessage),
    ...(fieldIssues.length > 0 ? { fieldIssues } : {}),
    ...(safeString(envelope.requestId) ? { requestId: safeString(envelope.requestId) } : {}),
    ...(safeString(envelope.correlationId) ? { correlationId: safeString(envelope.correlationId) } : {}),
    ...(status ? { status } : {}),
  };
}

function safeErrorMessage(code: string, rawMessage: unknown, fallbackMessage?: string): string {
  const safeRawMessage = safeString(rawMessage);
  if (code === "validation") return safeRawMessage ?? "Invalid asset library request.";
  if (code === "not-found") return "Asset definition was not found.";
  if (code === "unavailable") return "Asset Library is unavailable.";
  if (code.startsWith("security.")) return safeRawMessage ?? "Asset Library request is not authorized.";
  return "Unable to read Asset Library data.";
}

function fieldIssuesFrom(value: unknown): readonly { field?: string; message: string }[] {
  const record = isRecord(value) ? value : {};
  const issues = safeArray(record.fieldIssues ?? record.issues);
  return issues
    .map((issue) => {
      if (!isRecord(issue)) return undefined;
      const message = safeString(issue.message);
      if (!message) return undefined;
      return {
        ...(safeString(issue.field ?? issue.path) ? { field: safeString(issue.field ?? issue.path) } : {}),
        message,
      };
    })
    .filter((issue): issue is { field?: string; message: string } => Boolean(issue));
}
