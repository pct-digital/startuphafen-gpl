function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function isIdArray(array) {
  if (array == null) {
    return false;
  }
  if (!Array.isArray(array)) {
    return false;
  }

  const badObject = array.find((x) => !isObject(x) || !('id' in x));
  return badObject == null;
}

function mergeDeep(target, sources) {
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
          mergeDeep(target[key], [sval]);
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

  return mergeDeep(target, sources);
}

function idArrayToRecord(xs) {
  const result = {};

  for (const x of xs) {
    result[x.id] = x;
  }

  return result;
}

function mergeIdArrays(target, source) {
  const tObjects = idArrayToRecord(target);
  const sObjects = idArrayToRecord(source);

  const merged = mergeDeep({}, [tObjects, sObjects]);

  if (Object.keys(tObjects).length < target.length) {
    throw new Error(
      'Cannot merge files, objects in target with ids show up twice: ' + Object.keys(tObjects) + ' vs ' + target.map((t) => t.id)
    );
  }
  if (Object.keys(sObjects).length < source.length) {
    throw new Error(
      'Cannot merge files, objects in source with ids show up twice: ' + Object.keys(sObjects) + ' vs ' + source.map((t) => t.id)
    );
  }

  const resultWithoutAdds = target.map((t) => {
    const mObject = merged[t.id];
    if (mObject != null) {
      return Object.assign(t, mObject);
    } else {
      return t;
    }
  });

  const adds = source.filter((x) => tObjects[x.id] == null);
  return [...resultWithoutAdds, ...adds];
}

module.exports = function (...sources) {
  return mergeDeep({}, sources);
};
