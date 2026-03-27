import { ModelStudioIdentity } from "../../../domain/model-studio/ModelStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";

export const modelStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: ModelStudioIdentity.studioType,
  studioId: ModelStudioIdentity.defaultStudioId,
  displayName: ModelStudioIdentity.defaultStudioName,
  role: "model",
  defaults: {
    title: "Model Asset Draft",
    tags: Object.freeze(["model", "studio-shell"]),
    contentTemplate: JSON.stringify({ modelSpec: {} }, null, 2),
  },
  extensions: Object.freeze([]),
});
