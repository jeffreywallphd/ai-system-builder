import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";

export const ClassificationSemanticTypeGuesses = Object.freeze({
  email: "email",
  phone: "phone",
  nameLike: "name-like",
  addressLike: "address-like",
  dateLike: "date-like",
  identifierLike: "identifier-like",
  numericMeasure: "numeric-measure",
  category: "category",
  freeText: "free-text",
  unknown: "unknown",
} as const);

export type ClassificationSemanticTypeGuess =
  typeof ClassificationSemanticTypeGuesses[keyof typeof ClassificationSemanticTypeGuesses];

export const ClassificationPiiLikelihoods = Object.freeze({
  none: "none",
  low: "low",
  medium: "medium",
  high: "high",
} as const);

export type ClassificationPiiLikelihood =
  typeof ClassificationPiiLikelihoods[keyof typeof ClassificationPiiLikelihoods];

export const ClassificationSensitivityTags = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high",
} as const);

export type ClassificationSensitivityTag =
  typeof ClassificationSensitivityTags[keyof typeof ClassificationSensitivityTags];

export interface ClassificationHeuristicFieldInput {
  readonly fieldName: string;
  readonly values: ReadonlyArray<CanonicalRecordValue | undefined>;
  readonly useFieldNames: boolean;
  readonly inferredFieldType?: string;
  readonly maxSampleValuesPerField: number;
}

export interface ClassificationFieldMetrics {
  readonly nonNullCount: number;
  readonly distinctCount: number;
  readonly distinctRatio: number;
  readonly averageStringLength?: number;
  readonly emailMatchRatio: number;
  readonly phoneMatchRatio: number;
  readonly dateLikeRatio: number;
  readonly numericLikeRatio: number;
}

export interface ClassificationHeuristicFieldResult {
  readonly fieldName: string;
  readonly semanticTypeGuess: ClassificationSemanticTypeGuess;
  readonly piiLikelihood: ClassificationPiiLikelihood;
  readonly sensitivity: ClassificationSensitivityTag;
  readonly confidence: number;
  readonly tags: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<string>;
  readonly metrics: ClassificationFieldMetrics;
  readonly sampleValues: ReadonlyArray<CanonicalRecordValue>;
}

interface SemanticCandidate {
  readonly type: ClassificationSemanticTypeGuess;
  readonly score: number;
  readonly reason: string;
}

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PhonePattern = /^(?:\+?\d{1,3}[\s\-().]*)?(?:\d[\s\-().]*){7,15}$/;
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{4,}$/;
const DatePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s].*)?$/;

const FieldNameKeywordMap: ReadonlyArray<Readonly<{
  readonly type: ClassificationSemanticTypeGuess;
  readonly keywords: ReadonlyArray<string>;
  readonly score: number;
}>> = Object.freeze([
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.email,
    keywords: Object.freeze(["email", "e-mail", "mail"]),
    score: 3,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.phone,
    keywords: Object.freeze(["phone", "mobile", "tel", "telephone", "contact_number", "contactnumber"]),
    score: 3,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.nameLike,
    keywords: Object.freeze(["name", "first_name", "last_name", "fullname", "full_name", "given_name", "surname"]),
    score: 2.5,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.addressLike,
    keywords: Object.freeze(["address", "street", "city", "state", "province", "postal", "zip", "country"]),
    score: 2.5,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.dateLike,
    keywords: Object.freeze(["date", "time", "timestamp", "created", "updated", "dob", "birth"]),
    score: 2.25,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.identifierLike,
    keywords: Object.freeze(["id", "_id", "identifier", "uuid", "ssn", "tax", "passport", "license", "account"]),
    score: 2.25,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.numericMeasure,
    keywords: Object.freeze(["amount", "price", "cost", "revenue", "count", "total", "score", "qty", "quantity", "rate", "percent"]),
    score: 2,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.category,
    keywords: Object.freeze(["status", "type", "category", "segment", "class", "group", "level", "tier"]),
    score: 1.75,
  }),
  Object.freeze({
    type: ClassificationSemanticTypeGuesses.freeText,
    keywords: Object.freeze(["description", "comment", "note", "message", "text", "body", "content", "summary"]),
    score: 1.5,
  }),
]);

function normalizeFieldName(fieldName: string): string {
  return fieldName.trim().toLocaleLowerCase().replace(/[\s.-]/g, "_");
}

function normalizeString(value: string): string {
  return value.trim();
}

function isDateLikeString(value: string): boolean {
  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }
  if (DatePattern.test(normalized)) {
    return Number.isFinite(Date.parse(normalized));
  }
  return false;
}

function isPhoneLikeString(value: string): boolean {
  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }
  return PhonePattern.test(normalized);
}

function isNumericLikeString(value: string): boolean {
  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed);
}

function maskSampleValue(value: CanonicalRecordValue, tags: ReadonlyArray<string>): CanonicalRecordValue {
  if (typeof value !== "string") {
    return value;
  }

  if (tags.includes("pii.email")) {
    const [localPart, domain] = value.split("@");
    if (!localPart || !domain) {
      return "[REDACTED_EMAIL]";
    }
    return `${localPart.slice(0, 1)}***@${domain}`;
  }
  if (tags.includes("pii.phone")) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 4) {
      return "***";
    }
    return `***${digits.slice(-4)}`;
  }
  if (tags.some((tag) => tag === "pii.name" || tag === "pii.address" || tag === "pii.identifier")) {
    return "[REDACTED]";
  }

  return value;
}

function collectSampleValues(
  values: ReadonlyArray<CanonicalRecordValue | undefined>,
  maxSampleValuesPerField: number,
  tags: ReadonlyArray<string>,
): ReadonlyArray<CanonicalRecordValue> {
  const seen = new Set<string>();
  const samples: CanonicalRecordValue[] = [];
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    samples.push(maskSampleValue(value, tags));
    if (samples.length >= maxSampleValuesPerField) {
      break;
    }
  }
  return Object.freeze(samples);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function dedupeTags(tags: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(tags)].sort((left, right) => left.localeCompare(right)));
}

function addCandidate(
  candidates: SemanticCandidate[],
  type: ClassificationSemanticTypeGuess,
  score: number,
  reason: string,
): void {
  if (score <= 0) {
    return;
  }
  candidates.push(Object.freeze({ type, score, reason }));
}

function pickSemanticCandidate(
  candidates: ReadonlyArray<SemanticCandidate>,
): SemanticCandidate | undefined {
  if (candidates.length === 0) {
    return undefined;
  }
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.type.localeCompare(right.type);
  })[0];
}

export function classifyFieldByHeuristics(input: ClassificationHeuristicFieldInput): ClassificationHeuristicFieldResult {
  const nonNullValues = input.values.filter((value): value is CanonicalRecordValue => value !== undefined && value !== null);
  const nonEmptyStrings = nonNullValues
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalizeString(value))
    .filter((value) => value.length > 0);
  const normalizedFieldName = normalizeFieldName(input.fieldName);
  const distinctCount = new Set(nonNullValues.map((value) => JSON.stringify(value))).size;
  const distinctRatio = nonNullValues.length === 0 ? 0 : distinctCount / nonNullValues.length;

  const emailMatchCount = nonEmptyStrings.filter((value) => EmailPattern.test(value)).length;
  const phoneMatchCount = nonEmptyStrings.filter((value) => isPhoneLikeString(value)).length;
  const dateLikeCount = nonEmptyStrings.filter((value) => isDateLikeString(value)).length;
  const numericLikeCount = nonNullValues.filter((value) => (typeof value === "number")
    || (typeof value === "string" && isNumericLikeString(value))).length;
  const averageStringLength = nonEmptyStrings.length === 0
    ? undefined
    : nonEmptyStrings.reduce((total, value) => total + value.length, 0) / nonEmptyStrings.length;

  const metrics = Object.freeze({
    nonNullCount: nonNullValues.length,
    distinctCount,
    distinctRatio: Math.round(distinctRatio * 1000) / 1000,
    averageStringLength: averageStringLength === undefined ? undefined : Math.round(averageStringLength * 100) / 100,
    emailMatchRatio: nonEmptyStrings.length === 0 ? 0 : emailMatchCount / nonEmptyStrings.length,
    phoneMatchRatio: nonEmptyStrings.length === 0 ? 0 : phoneMatchCount / nonEmptyStrings.length,
    dateLikeRatio: nonEmptyStrings.length === 0 ? 0 : dateLikeCount / nonEmptyStrings.length,
    numericLikeRatio: nonNullValues.length === 0 ? 0 : numericLikeCount / nonNullValues.length,
  } satisfies ClassificationFieldMetrics);

  const candidates: SemanticCandidate[] = [];
  if (input.useFieldNames) {
    for (const mapping of FieldNameKeywordMap) {
      const matched = mapping.keywords.some((keyword) => normalizedFieldName.includes(keyword));
      if (matched) {
        addCandidate(candidates, mapping.type, mapping.score, `field-name:${mapping.keywords.find((keyword) => normalizedFieldName.includes(keyword))}`);
      }
    }
  }

  if (metrics.emailMatchRatio >= 0.6) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.email, 4.25, `value-pattern:email(${metrics.emailMatchRatio.toFixed(2)})`);
  }
  if (metrics.phoneMatchRatio >= 0.6) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.phone, 4, `value-pattern:phone(${metrics.phoneMatchRatio.toFixed(2)})`);
  }
  if (metrics.dateLikeRatio >= 0.6) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.dateLike, 3.25, `value-pattern:date(${metrics.dateLikeRatio.toFixed(2)})`);
  }
  if (metrics.numericLikeRatio >= 0.75) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.numericMeasure, 2.75, `value-pattern:numeric(${metrics.numericLikeRatio.toFixed(2)})`);
  }
  if (metrics.distinctRatio <= 0.3 && (averageStringLength ?? 0) <= 24 && nonNullValues.length > 2) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.category, 2.5, `profile:category(distinct=${metrics.distinctRatio.toFixed(2)})`);
  }
  if ((averageStringLength ?? 0) >= 40 || metrics.distinctRatio >= 0.8) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.freeText, 2.25, `profile:free-text(avgLen=${(averageStringLength ?? 0).toFixed(1)})`);
  }

  if (input.inferredFieldType === "date") {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.dateLike, 2.8, "hint:inferred-type=date");
  }
  if (input.inferredFieldType === "number") {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.numericMeasure, 2.4, "hint:inferred-type=number");
  }
  if (input.inferredFieldType === "string" && metrics.distinctRatio <= 0.2 && nonNullValues.length >= 3) {
    addCandidate(candidates, ClassificationSemanticTypeGuesses.category, 2.1, "hint:inferred-type=string");
  }

  const semanticCandidate = pickSemanticCandidate(candidates);
  const semanticTypeGuess = semanticCandidate?.type ?? ClassificationSemanticTypeGuesses.unknown;
  const reasons = Object.freeze([
    ...(semanticCandidate ? [semanticCandidate.reason] : ["no-strong-signal"]),
    ...Object.freeze(candidates
      .filter((candidate) => candidate !== semanticCandidate)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
      .map((candidate) => candidate.reason)),
  ]);
  const confidence = clampConfidence((semanticCandidate?.score ?? 0) / 4.5);

  const piiLikelihood = semanticTypeGuess === ClassificationSemanticTypeGuesses.email
    || semanticTypeGuess === ClassificationSemanticTypeGuesses.phone
    || semanticTypeGuess === ClassificationSemanticTypeGuesses.nameLike
    || semanticTypeGuess === ClassificationSemanticTypeGuesses.addressLike
    || semanticTypeGuess === ClassificationSemanticTypeGuesses.identifierLike
    ? ClassificationPiiLikelihoods.high
    : semanticTypeGuess === ClassificationSemanticTypeGuesses.freeText
      ? ClassificationPiiLikelihoods.medium
      : metrics.emailMatchRatio >= 0.4 || metrics.phoneMatchRatio >= 0.4
        ? ClassificationPiiLikelihoods.medium
        : ClassificationPiiLikelihoods.low;

  const sensitivity = piiLikelihood === ClassificationPiiLikelihoods.high
    ? ClassificationSensitivityTags.high
    : piiLikelihood === ClassificationPiiLikelihoods.medium
      ? ClassificationSensitivityTags.medium
      : ClassificationSensitivityTags.low;

  const tags: string[] = [];
  if (semanticTypeGuess === ClassificationSemanticTypeGuesses.email) {
    tags.push("pii.email", "semantic.email", "sensitivity.high");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.phone) {
    tags.push("pii.phone", "semantic.phone", "sensitivity.high");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.nameLike) {
    tags.push("pii.name", "semantic.name_like", "sensitivity.high");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.addressLike) {
    tags.push("pii.address", "semantic.address_like", "sensitivity.high");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.identifierLike) {
    tags.push("pii.identifier", "semantic.identifier_like", "sensitivity.high");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.dateLike) {
    tags.push("semantic.date");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.numericMeasure) {
    tags.push("semantic.numeric_measure");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.category) {
    tags.push("semantic.category");
  } else if (semanticTypeGuess === ClassificationSemanticTypeGuesses.freeText) {
    tags.push("semantic.free_text");
  }

  tags.push(`sensitivity.${sensitivity}`);
  if (metrics.numericLikeRatio >= 0.8) {
    tags.push("content.mostly_numeric");
  }
  if ((averageStringLength ?? 0) >= 30) {
    tags.push("content.long_text");
  }
  if (metrics.distinctRatio <= 0.15 && nonNullValues.length >= 5) {
    tags.push("content.low_cardinality");
  }

  const normalizedTags = dedupeTags(tags);
  return Object.freeze({
    fieldName: input.fieldName,
    semanticTypeGuess,
    piiLikelihood,
    sensitivity,
    confidence,
    tags: normalizedTags,
    reasons,
    metrics,
    sampleValues: collectSampleValues(input.values, input.maxSampleValuesPerField, normalizedTags),
  } satisfies ClassificationHeuristicFieldResult);
}

