import { z } from "zod";
import { parseStorageLogicalReference, StorageBindingAreaSchema } from "./StorageInstanceProvisioningContract";

export const SystemRuntimeWindowLaunchContractVersion = "ai-loom.runtime-window-launch.v1";
export const SystemRuntimeWindowLaunchQueryParam = "runtimeWindowLaunch";

const identifierSchema = z.string().trim().min(1);
const nonEmptyRecordSchema = z.record(z.string(), z.unknown()).default({});

const targetKindSchema = z.enum(["standalone-system", "embedded-subsystem"]);
const launchModeSchema = z.enum(["interactive", "monitor", "readonly"]);
const windowIntentKindSchema = z.enum(["runtime-editor", "runtime-monitor"]);
const windowFocusSchema = z.enum(["foreground", "background"]);
const sharingScopeSchema = z.enum(["system-owned", "subsystem-owned", "shared"]);
const expectedResultKindSchema = z.enum(["none", "execution-summary", "session-reference"]);

export const SystemRuntimeWindowLaunchTargetSchema = z.object({
  targetKind: targetKindSchema,
  systemAssetId: identifierSchema,
  systemAssetVersionId: identifierSchema.optional(),
  subsystemId: identifierSchema.optional(),
  pageBindingId: identifierSchema,
  runtimeBindingId: identifierSchema.optional(),
}).superRefine((value, context) => {
  if (value.targetKind === "embedded-subsystem" && !value.subsystemId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subsystemId"],
      message: "subsystemId is required for embedded-subsystem runtime launch targets.",
    });
  }
});

export const SystemRuntimeWindowResolutionInputSchema = z.object({
  studioId: identifierSchema,
  draftId: identifierSchema.optional(),
  sessionId: identifierSchema.optional(),
  systemAssetId: identifierSchema,
  systemAssetVersionId: identifierSchema.optional(),
  template: z.object({
    templateAssetId: identifierSchema,
    templateVersionId: identifierSchema.optional(),
    workflowTemplateAssetId: identifierSchema.optional(),
    workflowTemplateVersionId: identifierSchema.optional(),
  }).optional(),
});

export const SystemRuntimeWindowDatasetBindingSchema = z.object({
  bindingId: identifierSchema,
  datasetBindingId: identifierSchema.optional(),
  datasetAssetId: identifierSchema.optional(),
  datasetAssetVersionId: identifierSchema.optional(),
  datasetInstanceId: identifierSchema.optional(),
  storageInstanceId: identifierSchema.optional(),
  storageInstanceRef: identifierSchema.optional(),
  storageBindingArea: StorageBindingAreaSchema.optional(),
  sharingScope: sharingScopeSchema.default("shared"),
  metadata: nonEmptyRecordSchema,
}).superRefine((value, context) => {
  if (!value.datasetBindingId && !value.datasetAssetId && !value.datasetInstanceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["datasetBindingId"],
      message: "Each dataset binding must include at least one dataset identity reference.",
    });
  }

  if (value.storageInstanceRef) {
    try {
      const parsed = parseStorageLogicalReference(value.storageInstanceRef);
      if (parsed.area) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["storageInstanceRef"],
          message: "storageInstanceRef must resolve to a storage-instance root reference.",
        });
      }
      if (value.storageInstanceId && parsed.instanceId !== value.storageInstanceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["storageInstanceRef"],
          message: "storageInstanceRef must resolve to the declared storageInstanceId.",
        });
      }
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceRef"],
        message: error instanceof Error ? error.message : "storageInstanceRef must be a valid storage-instance logical reference.",
      });
    }
  }
});

export const SystemRuntimeWindowInitialSelectionSchema = z.object({
  selectedDatasetBindingId: identifierSchema.optional(),
  activePreviewRole: identifierSchema.optional(),
  presetId: identifierSchema.optional(),
  selectedRecordIds: z.record(z.string().trim().min(1), z.string().trim().min(1)).default({}),
});

export const SystemRuntimeWindowIntentSchema = z.object({
  intent: windowIntentKindSchema.default("runtime-editor"),
  focus: windowFocusSchema.default("foreground"),
  reuseWindowKey: identifierSchema.optional(),
  titleHint: z.string().trim().min(1).optional(),
  dimensions: z.object({
    width: z.number().int().min(960).max(4096).optional(),
    height: z.number().int().min(640).max(4096).optional(),
  }).optional(),
});

export const SystemRuntimeWindowExpectedResultSchema = z.object({
  expectedResult: expectedResultKindSchema.default("execution-summary"),
  correlationId: identifierSchema.optional(),
  callbackChannel: identifierSchema.optional(),
  metadata: nonEmptyRecordSchema,
});

export const SystemRuntimeWindowLaunchContractSchema = z.object({
  contractVersion: z.literal(SystemRuntimeWindowLaunchContractVersion).default(SystemRuntimeWindowLaunchContractVersion),
  launchId: identifierSchema,
  createdAt: z.string().datetime(),
  launchTarget: SystemRuntimeWindowLaunchTargetSchema,
  resolution: SystemRuntimeWindowResolutionInputSchema,
  runtimeContextPayload: nonEmptyRecordSchema,
  datasetBindings: z.array(SystemRuntimeWindowDatasetBindingSchema).default([]),
  initialSelection: SystemRuntimeWindowInitialSelectionSchema.default({}),
  launchMode: launchModeSchema.default("interactive"),
  windowIntent: SystemRuntimeWindowIntentSchema.default({}),
  expectedResult: SystemRuntimeWindowExpectedResultSchema.default({}),
}).superRefine((value, context) => {
  if (value.launchTarget.systemAssetId !== value.resolution.systemAssetId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolution", "systemAssetId"],
      message: "resolution.systemAssetId must match launchTarget.systemAssetId.",
    });
  }
});

export type SystemRuntimeWindowLaunchContract = z.infer<typeof SystemRuntimeWindowLaunchContractSchema>;

export interface LaunchSystemRuntimeWindowRequest {
  readonly launchContract: SystemRuntimeWindowLaunchContract;
}

export interface LaunchSystemRuntimeWindowReadModel {
  readonly launchId: string;
  readonly launchedAt: string;
  readonly targetKind: SystemRuntimeWindowLaunchContract["launchTarget"]["targetKind"];
  readonly systemAssetId: string;
  readonly pageBindingId: string;
  readonly routePath: string;
}

export function validateSystemRuntimeWindowLaunchContract(input: unknown): SystemRuntimeWindowLaunchContract {
  return SystemRuntimeWindowLaunchContractSchema.parse(input);
}

export function createSystemRuntimeWindowLaunchContract(input: SystemRuntimeWindowLaunchContract): SystemRuntimeWindowLaunchContract {
  const parsed = validateSystemRuntimeWindowLaunchContract(input);
  return Object.freeze({
    ...parsed,
    launchTarget: Object.freeze({ ...parsed.launchTarget }),
    resolution: Object.freeze({
      ...parsed.resolution,
      template: parsed.resolution.template
        ? Object.freeze({ ...parsed.resolution.template })
        : undefined,
    }),
    runtimeContextPayload: Object.freeze({ ...parsed.runtimeContextPayload }),
    datasetBindings: Object.freeze(parsed.datasetBindings.map((binding) => Object.freeze({
      ...binding,
      metadata: Object.freeze({ ...binding.metadata }),
    }))),
    initialSelection: Object.freeze({
      ...parsed.initialSelection,
      selectedRecordIds: Object.freeze({ ...parsed.initialSelection.selectedRecordIds }),
    }),
    windowIntent: Object.freeze({
      ...parsed.windowIntent,
      dimensions: parsed.windowIntent.dimensions
        ? Object.freeze({ ...parsed.windowIntent.dimensions })
        : undefined,
    }),
    expectedResult: Object.freeze({
      ...parsed.expectedResult,
      metadata: Object.freeze({ ...parsed.expectedResult.metadata }),
    }),
  });
}

export function serializeSystemRuntimeWindowLaunchContract(contract: SystemRuntimeWindowLaunchContract): string {
  return JSON.stringify(contract);
}

export function parseSystemRuntimeWindowLaunchContract(serialized: string): SystemRuntimeWindowLaunchContract | undefined {
  const normalized = serialized.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    return createSystemRuntimeWindowLaunchContract(parsed as SystemRuntimeWindowLaunchContract);
  } catch {
    try {
      const decoded = decodeURIComponent(normalized);
      const parsed = JSON.parse(decoded) as unknown;
      return createSystemRuntimeWindowLaunchContract(parsed as SystemRuntimeWindowLaunchContract);
    } catch {
      return undefined;
    }
  }
}
