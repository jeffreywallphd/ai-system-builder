import {
  createEmptySchemaAssetDocument,
  createSchemaAssetMetadata,
  createSchemaStudioTaxonomy,
  serializeSchemaAssetDocument,
  SchemaStudioIdentity,
} from "../../../domain/schema-studio/SchemaStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const schemaStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: SchemaStudioIdentity.studioType,
  studioId: SchemaStudioIdentity.defaultStudioId,
  kind: "atomic",
  displayName: SchemaStudioIdentity.defaultStudioName,
  role: "schema",
  allowedBehaviorKinds: Object.freeze(["none"]),
  shell: Object.freeze({
    title: "Schema Studio",
    subtitle: "Design table structures and relationships. Keep data movement and transformations in Pipeline Studio.",
    toolbar: Object.freeze({
      actions: Object.freeze([
        {
          id: "schema-studio-toolbar-save",
          kind: "save-draft",
          label: "Save",
          tone: "primary",
          order: 10,
        },
        {
          id: "schema-studio-toolbar-validate",
          kind: "run-validation",
          label: "Run Validation",
          tone: "default",
          order: 20,
        },
        {
          id: "schema-studio-toolbar-refresh",
          kind: "refresh-snapshot",
          label: "Refresh Snapshot",
          tone: "ghost",
          order: 30,
        },
      ]),
    }),
  }),
  defaults: {
    title: "Schema Asset Draft",
    tags: Object.freeze(["schema", "studio-shell"]),
    contentTemplate: serializeSchemaAssetDocument(createEmptySchemaAssetDocument()),
    metadataPatch: createAtomicStudioMetadataPatch(createSchemaAssetMetadata({
      title: "Schema Asset Draft",
      summary: "Atomic schema asset drafted through Schema Studio.",
      tags: ["studio-shell"],
      sourceLabel: SchemaStudioIdentity.studioType,
    })),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "schema-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Schema draft guidance",
      subtitle: "Schema assets define structure only; workflows and pipelines execute behavior.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Use this studio for data structure design. Keep execution logic in workflow or pipeline assets.",
        "Asset role: schema (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
  ]),
});

export const schemaStudioTaxonomy = createSchemaStudioTaxonomy();
