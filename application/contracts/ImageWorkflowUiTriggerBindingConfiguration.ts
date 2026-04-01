import { z } from "zod";
import { UiTriggerEventKinds, type UiTriggerEventKind } from "../workflow-studio/UiTriggerEventContract";

export const ImageWorkflowUiTriggerBindingContractVersion = "1.0.0";

export const ImageWorkflowUiTriggerBindingEventSchema = z.object({
  kind: z.enum([
    UiTriggerEventKinds.click,
    UiTriggerEventKinds.submit,
    UiTriggerEventKinds.selection,
  ]),
  sourceComponentId: z.string().trim().min(1),
  actionId: z.string().trim().min(1).optional(),
  eventName: z.string().trim().min(1).optional(),
});

export const ImageWorkflowUiTriggerBindingTargetSchema = z.object({
  triggerId: z.string().trim().min(1).optional(),
  triggerType: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  if (!value.triggerId && !value.triggerType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "UI trigger binding target requires triggerId or triggerType.",
      path: ["triggerId"],
    });
  }
});

export const ImageWorkflowUiTriggerBindingDeclarationSchema = z.object({
  bindingId: z.string().trim().min(1),
  event: ImageWorkflowUiTriggerBindingEventSchema,
  target: ImageWorkflowUiTriggerBindingTargetSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ImageWorkflowUiTriggerBindingDeclaration = z.infer<typeof ImageWorkflowUiTriggerBindingDeclarationSchema>;

export const ImageWorkflowUiTriggerBindingConfigurationSchema = z.object({
  contractVersion: z.string().trim().min(1).default(ImageWorkflowUiTriggerBindingContractVersion),
  bindings: z.array(ImageWorkflowUiTriggerBindingDeclarationSchema).default([]),
});

export interface ImageWorkflowUiTriggerBindingConfiguration {
  readonly contractVersion: string;
  readonly bindings: ReadonlyArray<ImageWorkflowUiTriggerBindingDeclaration>;
}

function freezeBinding(binding: ImageWorkflowUiTriggerBindingDeclaration): ImageWorkflowUiTriggerBindingDeclaration {
  return Object.freeze({
    ...binding,
    event: Object.freeze({ ...binding.event }),
    target: Object.freeze({ ...binding.target }),
    metadata: binding.metadata ? Object.freeze({ ...binding.metadata }) : undefined,
  });
}

export function createImageWorkflowUiTriggerBindingConfiguration(input: unknown): ImageWorkflowUiTriggerBindingConfiguration {
  const parsed = ImageWorkflowUiTriggerBindingConfigurationSchema.parse(input);
  const dedupe = new Set<string>();
  const bindings: ImageWorkflowUiTriggerBindingDeclaration[] = [];

  for (const binding of parsed.bindings) {
    const normalizedBinding = freezeBinding(binding);
    if (dedupe.has(normalizedBinding.bindingId)) {
      throw new Error(`Invalid image workflow UI trigger binding configuration: duplicate bindingId '${normalizedBinding.bindingId}'.`);
    }
    dedupe.add(normalizedBinding.bindingId);
    bindings.push(normalizedBinding);
  }

  return Object.freeze({
    contractVersion: parsed.contractVersion,
    bindings: Object.freeze(bindings),
  });
}

export function serializeImageWorkflowUiTriggerBindingConfiguration(
  input: ImageWorkflowUiTriggerBindingConfiguration,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contractVersion: input.contractVersion,
    bindings: Object.freeze(input.bindings.map((binding) => ImageWorkflowUiTriggerBindingDeclarationSchema.parse(binding))),
  });
}

export function duplicateImageWorkflowUiTriggerBindingConfiguration(
  input: ImageWorkflowUiTriggerBindingConfiguration,
): ImageWorkflowUiTriggerBindingConfiguration {
  return createImageWorkflowUiTriggerBindingConfiguration({
    contractVersion: input.contractVersion,
    bindings: input.bindings,
  });
}

export function matchesUiTriggerBindingEvent(input: {
  readonly binding: ImageWorkflowUiTriggerBindingDeclaration;
  readonly event: Readonly<{
    readonly kind: UiTriggerEventKind;
    readonly name: string;
    readonly source: Readonly<{
      readonly componentId: string;
      readonly actionId?: string;
    }>;
  }>;
}): boolean {
  if (input.binding.event.kind !== input.event.kind) {
    return false;
  }
  if (input.binding.event.sourceComponentId !== input.event.source.componentId) {
    return false;
  }
  if (input.binding.event.actionId && input.binding.event.actionId !== input.event.source.actionId) {
    return false;
  }
  if (input.binding.event.eventName && input.binding.event.eventName !== input.event.name) {
    return false;
  }
  return true;
}
