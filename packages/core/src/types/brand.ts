declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

export function createBrand<T, TBrand extends string>(
  value: T,
  validator: (v: T) => boolean,
  brandName: TBrand
): Brand<T, TBrand> {
  if (!validator(value)) {
    throw new Error(`Invalid ${brandName}: ${value}`);
  }
  return value as Brand<T, TBrand>;
}
