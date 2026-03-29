export interface WizardPageRouteDefinition<PageId extends string = string> {
  readonly id: PageId;
  readonly title: string;
  readonly routeSegment: string;
}

export interface WizardPageRouteContract<PageId extends string = string> {
  readonly wizardId: string;
  readonly defaultPageId: PageId;
  readonly queryParam: string;
  readonly pages: ReadonlyArray<WizardPageRouteDefinition<PageId>>;
}

export interface WizardPageRouteResolution<PageId extends string = string> {
  readonly resolvedPageId: PageId;
  readonly requestedPageId?: PageId;
  readonly invalidPageId?: string;
  readonly source: "route-param" | "query-param" | "none";
}

function normalizePageInput(pageInput?: string | null): string | undefined {
  const normalized = pageInput?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isWizardPageRouteId<PageId extends string>(
  value: string,
  contract: WizardPageRouteContract<PageId>,
): value is PageId {
  return contract.pages.some((page) => page.id === value);
}

export function resolveWizardPageRoute<PageId extends string>(input: {
  readonly contract: WizardPageRouteContract<PageId>;
  readonly routePageId?: string;
  readonly search?: string;
}): WizardPageRouteResolution<PageId> {
  const routePageId = normalizePageInput(input.routePageId);
  if (routePageId) {
    if (isWizardPageRouteId(routePageId, input.contract)) {
      return Object.freeze({
        resolvedPageId: routePageId,
        requestedPageId: routePageId,
        source: "route-param",
      });
    }

    return Object.freeze({
      resolvedPageId: input.contract.defaultPageId,
      invalidPageId: routePageId,
      source: "route-param",
    });
  }

  const queryPageId = normalizePageInput(new URLSearchParams(input.search).get(input.contract.queryParam));
  if (!queryPageId) {
    return Object.freeze({
      resolvedPageId: input.contract.defaultPageId,
      source: "none",
    });
  }

  if (isWizardPageRouteId(queryPageId, input.contract)) {
    return Object.freeze({
      resolvedPageId: queryPageId,
      requestedPageId: queryPageId,
      source: "query-param",
    });
  }

  return Object.freeze({
    resolvedPageId: input.contract.defaultPageId,
    invalidPageId: queryPageId,
    source: "query-param",
  });
}
