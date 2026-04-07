import type {
  SystemAsset,
  SystemBinding,
  SystemBindingEndpoint,
} from "@domain/system-studio/SystemAssetDomain";
import type { RuntimeBehaviorProfile } from "./RuntimeBehaviorAlignment";
import type { RuntimeDependencyResolutionResult } from "./RuntimeDependencyResolution";
import type { RuntimeExecutionContract } from "./RuntimeExecutionContractMapping";
import type { RuntimeEnvironmentSelectionRequest } from "./RuntimeEnvironmentSelector";
import { RuntimeEnvironmentSelector, type IRuntimeEnvironmentSelector } from "./RuntimeEnvironmentSelector";
import type { RuntimeEnvironment, RuntimeEnvironmentKind } from "@domain/system-runtime/RuntimeEnvironmentDomain";
import { requiresPinnedRuntimeComponentVersion } from "./RuntimeComponentVersionPinningPolicy";

export interface ExecutionPlanNode {
  readonly nodeId: string;
  readonly parentNodeId?: string;
  readonly nodeType: "system-root" | "component";
  readonly componentKind?: SystemAsset["components"][number]["componentKind"];
  readonly alias?: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly taxonomy: SystemAsset["taxonomy"] | SystemAsset["components"][number]["taxonomy"];
  readonly behavior: RuntimeBehaviorProfile;
  readonly dependsOnNodeIds: ReadonlyArray<string>;
  readonly environmentId: string;
}

export interface ExecutionPlanEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly reason: "dependency" | "binding";
  readonly bindingId?: string;
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId?: string;
  readonly environment: RuntimeEnvironment;
  readonly nodes: ReadonlyArray<ExecutionPlanNode>;
  readonly edges: ReadonlyArray<ExecutionPlanEdge>;
  readonly orderedNodeIds: ReadonlyArray<string>;
  readonly interfaces: RuntimeExecutionContract;
  readonly dependencyResolution: RuntimeDependencyResolutionResult;
  readonly bindings: ReadonlyArray<SystemBinding>;
  readonly recursion: RuntimeDependencyResolutionResult["recursion"];
  readonly resolvedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
}

export interface ExecutionPlanBuildResult {
  readonly status: "built" | "invalid";
  readonly plan?: ExecutionPlan;
  readonly errors: ReadonlyArray<string>;
}

export interface ExecutionPlanBuilderInput {
  readonly root: SystemAsset;
  readonly runtimeContract: RuntimeExecutionContract;
  readonly dependencyResolution: RuntimeDependencyResolutionResult;
  readonly behavior: RuntimeBehaviorProfile;
  readonly requestedEnvironmentId?: string;
  readonly requestedEnvironmentKind?: RuntimeEnvironmentKind;
  readonly requireNestedSystems?: boolean;
  readonly requireMcpMediatedExecution?: boolean;
}

function makeNodeId(input: { readonly parentSystemAssetId: string; readonly alias?: string; readonly assetId: string; readonly versionId?: string }): string {
  return `component:${input.parentSystemAssetId}:${input.alias ?? input.assetId}:${input.versionId ?? ""}`;
}

function makeEdgeId(sourceNodeId: string, targetNodeId: string, suffix: string): string {
  return `${sourceNodeId}->${targetNodeId}:${suffix}`;
}

function collectTaxonomies(input: ExecutionPlanBuilderInput): ReadonlyArray<SystemAsset["taxonomy"]> {
  return Object.freeze([
    input.root.taxonomy,
    ...input.root.components.map((component) => component.taxonomy).filter((entry): entry is SystemAsset["taxonomy"] => !!entry),
  ]);
}

function resolveBindingNodeId(endpoint: SystemBindingEndpoint, aliasesToNodeIds: ReadonlyMap<string, string>, rootNodeId: string): string | undefined {
  if (endpoint.scope.startsWith("component-")) {
    if (!endpoint.componentAlias) {
      return undefined;
    }
    return aliasesToNodeIds.get(endpoint.componentAlias);
  }

  return rootNodeId;
}

function topologicalSort(nodeIds: ReadonlyArray<string>, dependencyMap: ReadonlyMap<string, ReadonlyArray<string>>): { readonly ordered: ReadonlyArray<string>; readonly cycleDetected: boolean } {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: string[] = [];
  let cycleDetected = false;

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId) || cycleDetected) {
      return;
    }
    if (visiting.has(nodeId)) {
      cycleDetected = true;
      return;
    }

    visiting.add(nodeId);
    for (const dependency of dependencyMap.get(nodeId) ?? []) {
      visit(dependency);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    ordered.push(nodeId);
  };

  [...nodeIds].sort((left, right) => left.localeCompare(right)).forEach(visit);
  return Object.freeze({ ordered: Object.freeze(ordered), cycleDetected });
}

export class ExecutionPlanBuilder {
  public constructor(
    private readonly environmentSelector: IRuntimeEnvironmentSelector = new RuntimeEnvironmentSelector(),
  ) {}

  public build(input: ExecutionPlanBuilderInput): ExecutionPlanBuildResult {
    const environmentRequest: RuntimeEnvironmentSelectionRequest = {
      requestedEnvironmentId: input.requestedEnvironmentId,
      requestedKind: input.requestedEnvironmentKind,
      executableTaxonomies: collectTaxonomies(input),
      requiresNestedSystems: input.requireNestedSystems ?? (input.dependencyResolution.recursion.status !== "complete"
        ? true
        : input.root.components.some((component) => component.componentKind === "system")),
      requiresMcpMediatedExecution: input.requireMcpMediatedExecution
        ?? (input.root.executionMetadata?.runtime?.requirements?.includes("mcp") ?? false),
    };

    const environmentResolution = this.environmentSelector.selectEnvironment(environmentRequest);
    if (environmentResolution.status !== "resolved" || !environmentResolution.selectedEnvironment) {
      return Object.freeze({
        status: "invalid",
        errors: Object.freeze([environmentResolution.reason ?? "Execution environment resolution failed."]),
      });
    }

    const rootNodeId = `system:${input.root.assetId}:${input.root.versionId ?? ""}`;
    const nodeVersionIds: Record<string, string> = {};
    const baseNodes: ExecutionPlanNode[] = [Object.freeze({
      nodeId: rootNodeId,
      nodeType: "system-root",
      assetId: input.root.assetId,
      versionId: input.root.versionId,
      taxonomy: input.root.taxonomy,
      behavior: input.behavior,
      dependsOnNodeIds: Object.freeze([]),
      environmentId: environmentResolution.selectedEnvironment.environmentId,
    })];

    const aliasesToNodeIds = new Map<string, string>();
    const dependencyMap = new Map<string, string[]>();
    dependencyMap.set(rootNodeId, []);

    for (const component of [...input.root.components].sort((left, right) => (left.alias ?? left.assetId).localeCompare(right.alias ?? right.assetId))) {
      const nodeId = makeNodeId({
        parentSystemAssetId: input.root.assetId,
        alias: component.alias,
        assetId: component.assetId,
        versionId: component.versionId,
      });
      if (component.alias) {
        aliasesToNodeIds.set(component.alias, nodeId);
      }
      dependencyMap.set(nodeId, [rootNodeId]);

      baseNodes.push(Object.freeze({
        nodeId,
        parentNodeId: rootNodeId,
        nodeType: "component",
        componentKind: component.componentKind,
        alias: component.alias,
        assetId: component.assetId,
        versionId: component.versionId,
        taxonomy: component.taxonomy,
        behavior: input.behavior,
        dependsOnNodeIds: Object.freeze([rootNodeId]),
        environmentId: environmentResolution.selectedEnvironment.environmentId,
      }));
      if (component.versionId) {
        nodeVersionIds[nodeId] = component.versionId;
      }
    }

    if (input.root.versionId) {
      nodeVersionIds[rootNodeId] = input.root.versionId;
    }

    const runtimeContractByAlias = new Map<string, RuntimeExecutionContract["childInterfaces"][number]>();
    for (const childInterface of input.runtimeContract.childInterfaces) {
      if (childInterface.alias) {
        runtimeContractByAlias.set(childInterface.alias, childInterface);
      }
    }

    const unresolvedVersionNodes = input.root.components
      .filter((component) => {
        const componentRuntimeContract = component.alias
          ? runtimeContractByAlias.get(component.alias)
          : undefined;
        return requiresPinnedRuntimeComponentVersion({
          component,
          hasResolvedContract: Boolean(componentRuntimeContract?.contractVersion),
        });
      })
      .map((component) => component.alias ?? component.assetId);
    if (unresolvedVersionNodes.length > 0) {
      return Object.freeze({
        status: "invalid",
        errors: Object.freeze([`Execution plan requires version-pinned components. Missing versions for: ${unresolvedVersionNodes.join(", ")}.`]),
      });
    }

    const edges: ExecutionPlanEdge[] = baseNodes
      .filter((node) => node.nodeId !== rootNodeId)
      .map((node) => Object.freeze({
        edgeId: makeEdgeId(rootNodeId, node.nodeId, "dependency-root"),
        sourceNodeId: rootNodeId,
        targetNodeId: node.nodeId,
        reason: "dependency",
      }));

    for (const binding of [...input.root.bindings].sort((left, right) => left.bindingId.localeCompare(right.bindingId))) {
      const sourceNodeId = resolveBindingNodeId(binding.source, aliasesToNodeIds, rootNodeId);
      const targetNodeId = resolveBindingNodeId(binding.target, aliasesToNodeIds, rootNodeId);
      if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
        continue;
      }

      const current = dependencyMap.get(targetNodeId) ?? [];
      if (!current.includes(sourceNodeId)) {
        dependencyMap.set(targetNodeId, [...current, sourceNodeId].sort((left, right) => left.localeCompare(right)));
      }

      edges.push(Object.freeze({
        edgeId: makeEdgeId(sourceNodeId, targetNodeId, binding.bindingId),
        sourceNodeId,
        targetNodeId,
        reason: "binding",
        bindingId: binding.bindingId,
      }));
    }

    const sortedNodes = Object.freeze(baseNodes
      .map((node) => Object.freeze({
        ...node,
        dependsOnNodeIds: Object.freeze((dependencyMap.get(node.nodeId) ?? []).sort((left, right) => left.localeCompare(right))),
      }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)));

    const topo = topologicalSort(sortedNodes.map((node) => node.nodeId), dependencyMap);
    if (topo.cycleDetected) {
      return Object.freeze({
        status: "invalid",
        errors: Object.freeze(["Execution plan builder detected a cycle in system binding/dependency relationships."]),
      });
    }

    const plan: ExecutionPlan = Object.freeze({
      planId: `system-plan:${input.root.assetId}:${input.root.versionId ?? ""}`,
      rootSystemAssetId: input.root.assetId,
      rootSystemVersionId: input.root.versionId,
      environment: environmentResolution.selectedEnvironment,
      nodes: sortedNodes,
      edges: Object.freeze(edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId))),
      orderedNodeIds: topo.ordered,
      interfaces: input.runtimeContract,
      dependencyResolution: input.dependencyResolution,
      bindings: Object.freeze([...input.root.bindings].sort((left, right) => left.bindingId.localeCompare(right.bindingId))),
      recursion: input.dependencyResolution.recursion,
      resolvedVersionMap: Object.freeze({
        rootVersionId: input.root.versionId,
        nodeVersionIds: Object.freeze(Object.fromEntries(Object.entries(nodeVersionIds).sort(([left], [right]) => left.localeCompare(right)))),
      }),
    });

    return Object.freeze({
      status: "built",
      plan,
      errors: Object.freeze([]),
    });
  }
}

