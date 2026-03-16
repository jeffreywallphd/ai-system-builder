export interface ModelResponse {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly variant?: string;
  readonly publisher?: string;

  readonly kind: string;
  readonly isRunnable: boolean;
  readonly status: string;

  readonly source: {
    readonly type: string;
    readonly sourceId?: string;
    readonly repository?: string;
    readonly revision?: string;
    readonly url?: string;
    readonly providerMetadata?: Readonly<Record<string, string>>;
  };

  readonly artifact: {
    readonly name: string;
    readonly accessMethod: string;
    readonly location?: string;
    readonly format: string;
    readonly sizeBytes?: number;
    readonly sha256?: string;
    readonly contentType?: string;
  };

  readonly additionalArtifacts: ReadonlyArray<{
    readonly name: string;
    readonly accessMethod: string;
    readonly location?: string;
    readonly format: string;
    readonly sizeBytes?: number;
    readonly sha256?: string;
    readonly contentType?: string;
  }>;

  readonly dependencies: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly dependencyType: string;
    readonly severity: string;
    readonly description?: string;
    readonly acceptedModelIds?: ReadonlyArray<string>;
    readonly acceptedNames?: ReadonlyArray<string>;
    readonly acceptedKinds?: ReadonlyArray<string>;
    readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
    readonly acceptedTasks?: ReadonlyArray<string>;
    readonly acceptedFormats?: ReadonlyArray<string>;
    readonly acceptedPrecisions?: ReadonlyArray<string>;
  }>;

  readonly precision?: string;
  readonly architectureFamily?: string;
  readonly architecture?: string;

  readonly compatibility: {
    readonly inputModalities: ReadonlyArray<string>;
    readonly outputModalities: ReadonlyArray<string>;
    readonly supportedTasks: ReadonlyArray<string>;
    readonly supportedRuntimes: ReadonlyArray<string>;
    readonly allowsAnyRuntime: boolean;
    readonly architectureFamilies: ReadonlyArray<string>;
    readonly allowsAnyArchitectureFamily: boolean;
    readonly compatibleAssetTypes: ReadonlyArray<string>;
  };

  readonly requirements: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly kind: string;
    readonly severity: string;
    readonly description?: string;
    readonly acceptedInputModalities?: ReadonlyArray<string>;
    readonly acceptedOutputModalities?: ReadonlyArray<string>;
    readonly requiredTasks?: ReadonlyArray<string>;
    readonly acceptedRuntimes?: ReadonlyArray<string>;
    readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
    readonly acceptedFormats?: ReadonlyArray<string>;
    readonly requiredDependencies?: ReadonlyArray<string>;
    readonly acceptedQuantizations?: ReadonlyArray<string>;
    readonly acceptedLicenses?: ReadonlyArray<string>;
    readonly minimumMemoryBytes?: number;
    readonly maximumMemoryBytes?: number;
  }>;

  readonly resourceProfile?: {
    readonly parameterCount?: number;
    readonly contextWindowTokens?: number;
    readonly maxOutputTokens?: number;
    readonly estimatedMinMemoryBytes?: number;
    readonly estimatedRecommendedMemoryBytes?: number;
    readonly maxBatchSize?: number;
    readonly recommendedConcurrency?: number;
  };

  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly license?: string;
  readonly languageCodes: ReadonlyArray<string>;
  readonly requiresAuth: boolean;

  readonly isAvailable: boolean;
  readonly isSupportingAsset: boolean;
  readonly satisfiesRequirements: boolean;
  readonly reference: string;
}
