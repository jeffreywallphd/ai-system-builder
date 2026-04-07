import { describe, expect, it } from "bun:test";
import {
  FeatureEngineeringOperationKinds,
  FeatureEngineeringStrategyKinds,
  createFeatureEngineeringStageConfig,
  parseFeatureEngineeringStageConfigFromStageOptions,
  toFeatureEngineeringStageOptions,
} from "../FeatureEngineeringStageDomain";

describe("FeatureEngineeringStageDomain", () => {
  it("creates a valid feature engineering config with mixed operations", () => {
    const config = createFeatureEngineeringStageConfig({
      strategy: FeatureEngineeringStrategyKinds.structured,
      operations: Object.freeze([
        Object.freeze({
          kind: FeatureEngineeringOperationKinds.derivedNumeric,
          operationId: "op-ratio",
          targetField: "feature.price_per_unit",
          method: "ratio",
          sourceFields: Object.freeze(["price", "quantity"]),
        }),
        Object.freeze({
          kind: FeatureEngineeringOperationKinds.bucketization,
          operationId: "op-bucket",
          targetField: "feature.amount_bin",
          sourceField: "amount",
          buckets: Object.freeze([
            Object.freeze({ bucketId: "low", max: 10 }),
            Object.freeze({ bucketId: "high", min: 10 }),
          ]),
        }),
      ]),
    });

    expect(config.operations).toHaveLength(2);
    expect(config.operations[0]?.kind).toBe("derived-numeric");
  });

  it("maps stage options to config and back", () => {
    const parsed = parseFeatureEngineeringStageConfigFromStageOptions(Object.freeze({
      featureStrategy: "text-derived",
      featureOutputFieldPrefix: "fx",
      featurePreserveSourceFields: false,
      featureEnforceTypeValidation: true,
      featureOperations: Object.freeze([
        Object.freeze({
          kind: "text-summary",
          operationId: "op-text",
          targetField: "fx.token_count",
          sourceField: "text",
          metric: "token-count",
          tokenCountField: "tokenCount",
        }),
      ]),
    }));

    const options = toFeatureEngineeringStageOptions(parsed);
    expect(parsed.strategy).toBe("text-derived");
    expect(options.featureOutputFieldPrefix).toBe("fx");
    expect(Array.isArray(options.featureOperations)).toBeTrue();
  });
});

