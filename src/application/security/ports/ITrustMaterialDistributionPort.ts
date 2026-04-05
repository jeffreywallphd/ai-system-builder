export interface PublishTrustBundleInput {
  readonly trustBundleRef: string;
  readonly certificateAuthorityId: string;
  readonly targetRef: string;
  readonly targetKind: "node" | "device" | "service";
  readonly distributionChannel: "pull" | "push" | "bootstrap";
  readonly materialRefs: ReadonlyArray<string>;
  readonly actorUserIdentityId: string;
}

export interface PublishTrustBundleResult {
  readonly trustBundleRef: string;
  readonly publishedAt: string;
  readonly versionTag?: string;
}

export interface ITrustMaterialDistributionPort {
  publishTrustBundle(input: PublishTrustBundleInput): Promise<PublishTrustBundleResult>;
}
