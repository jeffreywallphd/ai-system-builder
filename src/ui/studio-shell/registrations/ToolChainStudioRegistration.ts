import { createToolChainStudioTaxonomy, ToolChainStudioIdentity } from "@domain/tool-chain-studio/ToolChainStudioDomain";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const toolChainStudioRegistration: CompositeStudioRegistration = Object.freeze({
  studioType: ToolChainStudioIdentity.studioType,
  studioId: ToolChainStudioIdentity.defaultStudioId,
  kind: "composite",
  displayName: ToolChainStudioIdentity.defaultStudioName,
  role: "tool-chain",
  allowedBehaviorKinds: Object.freeze(["deterministic"]),
  shell: Object.freeze({
    title: ToolChainStudioIdentity.defaultStudioName,
    subtitle: "Shared composite shell for tool-chain authoring with backend-authoritative lifecycle, validation, and publish/version flows.",
  }),
  defaults: {
    title: "Tool Chain Asset Draft",
    tags: Object.freeze([
      "tool-chain",
      "studio-shell",
      "composite",
      "tool-orchestration",
      "tool-invocation",
      "mcp",
      "multi-step",
    ]),
    contentTemplate: JSON.stringify(
      {
        toolChainSpec: {
          tools: [
            {
              toolAssetRef: "tool:customer-lookup:v3",
              providerKind: "mcp",
            },
            {
              toolAssetRef: "tool:risk-score:v2",
              providerKind: "local",
            },
          ],
          invocationSteps: [
            {
              id: "lookup-customer",
              kind: "tool-invocation",
              toolAssetRef: "tool:customer-lookup:v3",
              arguments: {
                customerId: "${input.customerId}",
              },
            },
            {
              id: "score-customer-risk",
              kind: "tool-invocation",
              toolAssetRef: "tool:risk-score:v2",
              arguments: {
                customerProfile: "${steps.lookup-customer.output.profile}",
              },
            },
          ],
          outputPolicy: {
            strategy: "last-step",
          },
        },
      },
      null,
      2,
    ),
    metadataPatch: createCompositeStudioMetadataPatch({
      title: "Tool Chain Asset Draft",
      tags: ["tool-chain", "studio-shell", "composite", "tool-orchestration", "tool-invocation", "mcp", "multi-step"],
      summary: "Composite tool-chain asset drafted through Tool Chain Studio.",
      taxonomy: createToolChainStudioTaxonomy(),
      sourceLabel: ToolChainStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "tool-chain-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Tool chain draft guidance",
      subtitle: "Author ordered multi-step tool invocation chains as composite assets over reusable atomic tools.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Tool Chain assets are composite structures coordinating ordered tool invocations; atomic Tool assets remain the executable single-tool units.",
        "Reuse existing tool orchestration and MCP/local tool invocation vocabulary in chain steps and argument bindings.",
        "Pin composed tool dependencies by version for publish-ready lineage and stable execution replay.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});

