import type { ArtifactStorageBinding, ArtifactStorageBindingRole } from "../../contracts/storage";
import { ArtifactBacking } from "./ArtifactBacking";
import { ArtifactId } from "./ArtifactId";

export interface ArtifactProps {
  id: ArtifactId;
  artifactKind: "image" | "data";
  backings?: ArtifactBacking[];
}

export class Artifact {
  public readonly id: ArtifactId;
  public readonly artifactKind: "image" | "data";
  private readonly backings: ArtifactBacking[];

  private constructor(props: ArtifactProps) {
    this.id = props.id;
    this.artifactKind = props.artifactKind;
    this.backings = [...(props.backings ?? [])];
  }

  public static create(props: ArtifactProps): Artifact {
    const artifact = new Artifact({
      id: props.id,
      artifactKind: props.artifactKind,
      backings: [],
    });

    for (const backing of props.backings ?? []) {
      artifact.attachOrUpdateBacking(backing);
    }

    return artifact;
  }

  public static fromStorageBindings(input: {
    artifactId: string;
    artifactKind?: "image" | "data";
    bindings: ArtifactStorageBinding[];
  }): Artifact {
    return Artifact.create({
      id: ArtifactId.from(input.artifactId),
      artifactKind: input.artifactKind ?? "data",
      backings: input.bindings.map((binding) => ArtifactBacking.fromStorageBinding(binding)),
    });
  }

  public getBackings(): ArtifactBacking[] {
    return [...this.backings];
  }

  public latestBackingForRole(role: ArtifactStorageBindingRole): ArtifactBacking | undefined {
    return this.backings
      .filter((backing) => backing.role === role)
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0];
  }

  public attachOrUpdateBacking(backing: ArtifactBacking): void {
    const existingIndex = this.backings.findIndex((entry) => entry.sameRoleAndBackingAs(backing));
    if (existingIndex >= 0) {
      this.backings[existingIndex] = backing;
      return;
    }

    this.backings.push(backing);
  }

  public hasEquivalentBacking(backing: ArtifactBacking): boolean {
    return this.backings.some((entry) => entry.sameRoleAndBackingAs(backing));
  }

  public toStorageBindings(): ArtifactStorageBinding[] {
    return this.backings.map((backing) => backing.toStorageBinding(this.id.toString()));
  }
}
