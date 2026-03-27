import { createToolStudioTaxonomy, ToolStudioIdentity } from "../../../domain/tool-studio/ToolStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const toolStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: ToolStudioIdentity.studioType,
  studioId: ToolStudioIdentity.defaultStudioId,
  displayName: ToolStudioIdentity.defaultStudioName,
  role: "tool",
  defaults: {
    title: "Tool Asset Draft",
    tags: Object.freeze(["tool", "studio-shell", "mcp"]),
    contentTemplate: JSON.stringify(
      {
        toolSpec: {
          providerKind: "mcp",
          serverId: "",
          operationId: "",
          endpoint: "",
          requestSchema: {},
          responseSchema: {},
        },
      },
      null,
      2,
    ),
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Tool Asset Draft",
      tags: ["tool", "studio-shell", "mcp"],
      summary: "Atomic MCP/API tool asset drafted through Tool Studio.",
      taxonomy: createToolStudioTaxonomy("conditional"),
      sourceLabel: ToolStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "tool-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Tool draft guidance",
      subtitle: "Author atomic MCP/API endpoint tools through shared shell draft/session flows.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Keep tool authoring atomic: callable identity/version in assets, execution style in taxonomy behavior.",
        "Asset role: tool (atomic)",
        "Default behavior: conditional for MCP/API endpoint semantics.",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "tool-studio-capability-summary",
      slot: "metadata",
      title: "Tool capability metadata status",
      subtitle: "Read-only taxonomy/contract/provenance projection from backend-authoritative draft metadata.",
      order: 20,
      render: ({ snapshot }) => {
        const taxonomy = snapshot?.draft?.metadata.taxonomy;
        return Object.freeze([
          `Taxonomy: ${taxonomy
            ? `${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}`
            : "missing"}`,
          `Contract: ${snapshot?.draft?.metadata.contract ? "present" : "missing"}`,
          `Provenance source: ${snapshot?.draft?.metadata.provenance?.sourceLabel ?? "-"}`,
        ]);
      },
    },
  ]),
});
