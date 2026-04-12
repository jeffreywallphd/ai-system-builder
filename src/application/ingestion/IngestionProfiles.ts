import type { FileIngestionProfile } from "@domain/ingestion/interfaces/IFileIngestion";

export function createFileIngestionProfile(profile: FileIngestionProfile): FileIngestionProfile {
  return Object.freeze({
    ...profile,
    policy: Object.freeze({
      ...profile.policy,
      acceptedExtensions: Object.freeze(profile.policy.acceptedExtensions.map((value) => value.toLowerCase())),
      acceptedMimeTypes: Object.freeze(profile.policy.acceptedMimeTypes.map((value) => value.toLowerCase())),
      conversion: Object.freeze({
        ...profile.policy.conversion,
        allowedOutputFormats: Object.freeze([...profile.policy.conversion.allowedOutputFormats]),
        passThroughExtensions: Object.freeze(profile.policy.conversion.passThroughExtensions.map((value) => value.toLowerCase())),
        passThroughMimeTypes: Object.freeze(profile.policy.conversion.passThroughMimeTypes.map((value) => value.toLowerCase())),
      }),
    }),
    metadata: profile.metadata ? Object.freeze({ ...profile.metadata }) : undefined,
  });
}

