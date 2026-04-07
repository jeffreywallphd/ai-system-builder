import { describe, expect, it } from "bun:test";
import { ModelCompatibility } from "../ModelCompatibility";
import { ModelDependency } from "../ModelDependency";
import { Model, ModelArtifact, ModelIdentity, ModelResourceProfile, ModelSource } from "../Model";
import { ModelRequirement } from "../ModelRequirement";
import type { IModel, IModelArtifact, IModelIdentity, IModelResourceProfile, IModelSource } from "../interfaces/IModel";
import type { IModelCompatibility } from "../interfaces/IModelCompatibility";
import type { IModelDependency } from "../interfaces/IModelDependency";
import type { IModelRequirement } from "../interfaces/IModelRequirement";

describe("Domain model contracts", () => {
  it("concrete classes satisfy interface contracts", () => {
    const identity: IModelIdentity = new ModelIdentity({ id: "i", name: "name" });
    const source: IModelSource = new ModelSource({ type: "local" });
    const artifact: IModelArtifact = new ModelArtifact({ name: "a", accessMethod: "local-file" });
    const resource: IModelResourceProfile = new ModelResourceProfile({ parameterCount: 1 });
    const compatibility: IModelCompatibility = new ModelCompatibility();
    const dependency: IModelDependency = new ModelDependency({ id: "d", label: "D", dependencyType: "tokenizer" });
    const requirement: IModelRequirement = new ModelRequirement({ id: "r", label: "R", kind: "task" });
    const model: IModel = new Model({
      id: "m",
      name: "Model",
      kind: "generic",
      source,
      artifact,
      compatibility,
      dependencies: [dependency],
      requirements: [requirement],
      resourceProfile: resource,
    });

    expect(identity.name).toBe("name");
    expect(model.id).toBe("m");
    expect(model.compatibility).toBe(compatibility);
  });
});
