export const SecretRotationInstructionModes = Object.freeze({
  manual: "manual",
  scheduled: "scheduled",
  onDemand: "on-demand",
});

export type SecretRotationInstructionMode =
  typeof SecretRotationInstructionModes[keyof typeof SecretRotationInstructionModes];

export interface SecretRotationInstructionContract {
  readonly mode: SecretRotationInstructionMode;
  readonly rotateEveryDays?: number;
  readonly nextRotationDueAt?: string;
  readonly note?: string;
}

export const SecretTransportFieldLimits = Object.freeze({
  secretIdMaxLength: 255,
  secretNameMaxLength: 127,
  displayNameMaxLength: 255,
  descriptionMaxLength: 4000,
  tagMaxLength: 255,
  maxTags: 64,
  labelKeyMaxLength: 128,
  labelValueMaxLength: 255,
  operationKeyMaxLength: 255,
  rotationNoteMaxLength: 1024,
});

export const SecretTransportPatterns = Object.freeze({
  scopeIdentifier: /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,254}$/,
  secretKey: /^[a-z][a-z0-9._-]{1,126}$/,
  metadataLabelKey: /^[a-z][a-z0-9._-]{0,127}$/,
});
