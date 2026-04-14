import type { InvariantFixtureBag } from "./contracts";

export type InvariantFixtureContribution =
  | InvariantFixtureBag
  | ((current: InvariantFixtureBag) => InvariantFixtureBag | Promise<InvariantFixtureBag>);

export async function composeInvariantFixtures(
  ...contributions: ReadonlyArray<InvariantFixtureContribution>
): Promise<InvariantFixtureBag> {
  let composed: InvariantFixtureBag = Object.freeze({});

  for (const contribution of contributions) {
    const next = typeof contribution === "function"
      ? await contribution(composed)
      : contribution;
    composed = Object.freeze({
      ...composed,
      ...next,
    });
  }

  return composed;
}
