/**
 * Deep merge utility for combining objects.
 *
 * Key behaviors:
 * - Objects are merged recursively
 * - Arrays of objects with 'id' properties are merged by matching ids
 * - Simple arrays (no id properties) are replaced, not merged
 * - Primitive values from later sources override earlier ones
 */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function isObject(item: unknown): item is JsonObject {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

function isIdArray(
  array: unknown
): array is Array<JsonObject & { id: unknown }> {
  if (array == null) {
    return false;
  }
  if (!Array.isArray(array)) {
    return false;
  }

  const badObject = array.find((x) => !isObject(x) || !('id' in x));
  return badObject == null;
}

function idArrayToRecord(
  xs: Array<JsonObject & { id: unknown }>
): Record<string, JsonObject> {
  const result: Record<string, JsonObject> = {};

  for (const x of xs) {
    result[String(x.id)] = x;
  }

  return result;
}

function mergeIdArrays(
  target: Array<JsonObject & { id: unknown }>,
  source: Array<JsonObject & { id: unknown }>
): Array<JsonObject & { id: unknown }> {
  const tObjects = idArrayToRecord(target);
  const sObjects = idArrayToRecord(source);

  const merged = mergeDeepInternal({}, [tObjects, sObjects]);

  if (Object.keys(tObjects).length < target.length) {
    throw new Error(
      'Cannot merge files, objects in target with ids show up twice: ' +
        Object.keys(tObjects) +
        ' vs ' +
        target.map((t) => t.id)
    );
  }
  if (Object.keys(sObjects).length < source.length) {
    throw new Error(
      'Cannot merge files, objects in source with ids show up twice: ' +
        Object.keys(sObjects) +
        ' vs ' +
        source.map((t) => t.id)
    );
  }

  const resultWithoutAdds = target.map((t) => {
    const mObject = merged[String(t.id)];
    if (mObject != null) {
      return Object.assign(t, mObject);
    } else {
      return t;
    }
  });

  const adds = source.filter((x) => tObjects[String(x.id)] == null);
  return [...resultWithoutAdds, ...adds];
}

function mergeDeepInternal(
  target: JsonObject,
  sources: JsonValue[]
): JsonObject {
  if (sources.length === 0) return target;
  const source = sources.shift();

  const targetIsObject = isObject(target);
  const targetIsArray = Array.isArray(target);
  const sourceIsObject = isObject(source);
  const sourceIsArray = Array.isArray(source);

  if ((targetIsArray && sourceIsObject) || (targetIsObject && sourceIsArray)) {
    const tInfo = JSON.stringify(target).slice(0, 50);
    const sInfo = JSON.stringify(source).slice(0, 50);
    throw new Error(
      `Cannot merge target and source, they are not compatible: targetIsObject=${targetIsObject}, targetIsArray=${targetIsArray}, sourceIsObject=${sourceIsObject}, sourceIsArray=${sourceIsArray}, first 50 chars of target: ${tInfo}, first 50 chars of source: ${sInfo}`
    );
  }

  if (targetIsObject && sourceIsObject) {
    for (const key in source) {
      const sval = source[key];
      const valIsObject = isObject(sval);
      const valIsArray = Array.isArray(sval);

      if (!valIsObject && !valIsArray) {
        target[key] = sval;
      } else if (valIsObject) {
        const tval = target[key];
        if (isObject(tval)) {
          mergeDeepInternal(tval, [sval]);
        } else {
          target[key] = sval;
        }
      } else if (valIsArray) {
        const tval = target[key];
        if (isIdArray(tval) && isIdArray(sval)) {
          target[key] = mergeIdArrays(tval, sval);
        } else {
          target[key] = sval;
        }
      } else {
        target[key] = sval;
      }
    }
  }

  return mergeDeepInternal(target, sources);
}

/**
 * Helper class for deep merging objects.
 * Provided to hooks via context.helpers.mergeDeep
 */
export class MergeDeepHelper {
  /**
   * Deep merge multiple objects into a new object.
   * Later sources override earlier ones for primitive values.
   * Objects are merged recursively.
   * Arrays with objects containing 'id' properties are merged by id.
   *
   * @param sources - Objects to merge (in order, later overrides earlier)
   * @returns A new merged object
   */
  merge<T extends JsonObject>(...sources: JsonObject[]): T {
    return mergeDeepInternal({}, sources) as T;
  }
}
