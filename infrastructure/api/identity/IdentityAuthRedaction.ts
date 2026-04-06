const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_FIELD_KEYS = new Set([
  "artifact",
  "authorization",
  "assertion",
  "bearertoken",
  "candidate",
  "codeverifier",
  "credential",
  "certpem",
  "certificatechainmaterialref",
  "certificatechainmaterialsecretref",
  "certificatechainpem",
  "certificatematerialref",
  "certificatematerialsecretref",
  "certificatepem",
  "currentcredential",
  "email",
  "fingerprint",
  "hash",
  "hashvalue",
  "filename",
  "filepath",
  "objectkey",
  "objectversionid",
  "path",
  "otp",
  "password",
  "newcredential",
  "pepperversion",
  "providersubject",
  "publickeypem",
  "presentedtoken",
  "privatekey",
  "privatekeypem",
  "pinreference",
  "recoverycode",
  "recoverytoken",
  "salt",
  "secret",
  "sessiontoken",
  "sizebytes",
  "storageinstanceid",
  "trusteddeviceid",
  "token",
  "trustmaterialref",
  "trustbundlepem",
  "trustmarker",
  "truststatesnapshot",
  "devicetrustcontext",
  "trusteddevicebindingid",
  "username",
]);

const SENSITIVE_TEXT_PATTERNS = Object.freeze([
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /\bloom_sess_[A-Za-z0-9._~+/-]+\b/gi,
  /\bsession-token-[A-Za-z0-9._~+/-]+\b/gi,
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/gi,
  /\bsecret-store:[^\s"'`]+/gi,
]);

export function redactSensitiveAuthPayload(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

export function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED_VALUE);
  }
  return redacted;
}

function redactValue(value: unknown, visited: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => redactValue(entry, visited)));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (visited.has(value)) {
    return Object.freeze({ circularReference: true });
  }
  visited.add(value);

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_FIELD_KEYS.has(key.toLowerCase())) {
      output[key] = REDACTED_VALUE;
      continue;
    }
    output[key] = redactValue(nestedValue, visited);
  }

  return Object.freeze(output);
}
