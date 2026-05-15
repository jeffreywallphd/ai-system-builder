export type AsyncFeatureProvider<TFeature extends object> = () => Promise<TFeature>;

type AsyncLazyObject<TObject extends object> = {
  [K in keyof TObject]: TObject[K] extends (...args: infer Args) => infer Return
    ? (...args: Args) => Promise<Awaited<Return>>
    : TObject[K];
};

export function lazyProvidedObject<TFeature extends object>(provider: AsyncFeatureProvider<TFeature>): AsyncLazyObject<TFeature>;
export function lazyProvidedObject<TFeature extends object, TObject extends object>(provider: AsyncFeatureProvider<TFeature>, select: (feature: TFeature) => TObject): AsyncLazyObject<TObject>;
export function lazyProvidedObject<TFeature extends object, TObject extends object = TFeature>(provider: AsyncFeatureProvider<TFeature>, select?: (feature: TFeature) => TObject): AsyncLazyObject<TObject> {
  return new Proxy({}, {
    get(_target, property) {
      if (property === "then") return undefined;
      return async (...args: unknown[]) => {
        const feature = await provider();
        const object = select ? select(feature) : feature as unknown as TObject;
        const value = (object as Record<PropertyKey, unknown>)[property];
        if (typeof value !== "function") return value;
        return value.apply(object, args);
      };
    },
  }) as AsyncLazyObject<TObject>;
}
