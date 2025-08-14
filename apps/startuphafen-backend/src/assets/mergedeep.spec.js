const mergeDeep = require('./mergedeep');

// When running this you can ignore the jest warning about javascript imports, it is ok
// this is a bit of special case: tests for script used in the deploy process

describe('the mergeDeep function', () => {
  it('can be imported', () => {
    expect(typeof mergeDeep).toBe('function');
  });

  it('merges very simple objects', () => {
    const o1 = {
      a: 1,
      b: 2,
      c: 3,
    };
    const o2 = {
      a: 42,
      d: 17,
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: 42,
      b: 2,
      c: 3,
      d: 17,
    });
  });

  it('merges deep objects', () => {
    const o1 = {
      a: {
        x: 5,
        z: 42,
      },
    };
    const o2 = {
      a: {
        z: 7,
        q: 1,
      },
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: 5,
        z: 7,
        q: 1,
      },
    });
  });

  it('adds new object', () => {
    const o1 = {};
    const o2 = {
      a: {
        b: {},
      },
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        b: {},
      },
    });
  });

  it('does a more complex example with simple arrays (no objects with id properties)', () => {
    const o1 = {
      a: {
        x: 17,
        z: ['TEST', '1'],
        Q: {
          foo: 'barrs',
        },
      },
    };
    const o2 = {
      a: {
        x: 17,
        z: ['QQQ'],
        Q: {
          foo: 'bar',
          z: 'zzz',
        },
      },
      z: {
        z: {
          z: 'HI',
        },
      },
    };
    const o3 = {
      z: {
        z: {
          z2: 'HI2',
        },
      },
    };
    expect(mergeDeep(o1, o2, o3)).toEqual({
      a: {
        x: 17,
        z: ['QQQ'],
        Q: {
          foo: 'bar',
          z: 'zzz',
        },
      },
      z: {
        z: {
          z: 'HI',
          z2: 'HI2',
        },
      },
    });
  });

  it('handles arrays with id-objects by merging those objects', () => {
    const o1 = {
      a: [
        { id: 42, q: 2 },
        { id: 'a', x: 42, y: 5 },
      ],
    };
    const o2 = {
      a: [{ id: 'a', x: 21 }],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [
        {
          id: 42,
          q: 2,
        },
        {
          id: 'a',
          x: 21,
          y: 5,
        },
      ],
    });
  });

  it('handles merging objects with different value types', () => {
    const o1 = {
      a: {
        x: 5,
        z: 'hello',
      },
    };
    const o2 = {
      a: {
        z: 7,
        q: true,
      },
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: 5,
        z: 7,
        q: true,
      },
    });
  });

  it('handles merging objects with null and undefined values', () => {
    const o1 = {
      a: {
        x: null,
        z: undefined,
      },
    };
    const o2 = {
      a: {
        z: 7,
        q: 1,
      },
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: null,
        z: 7,
        q: 1,
      },
    });
  });

  it('handles merging empty objects', () => {
    const o1 = {};
    const o2 = {
      a: 5,
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: 5,
    });
  });

  it('handles merging when one object is empty', () => {
    const o1 = {
      a: {
        x: 5,
      },
    };
    const o2 = {};

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: 5,
      },
    });
  });

  it('handles merging when both objects are empty', () => {
    const o1 = {};
    const o2 = {};

    expect(mergeDeep(o1, o2)).toEqual({});
  });

  it('handles merging objects with null and undefined values in different positions', () => {
    const o1 = {
      a: {
        x: 5,
        z: null,
      },
      b: undefined,
    };
    const o2 = {
      a: {
        z: 7,
        q: 1,
      },
      b: {
        y: 3,
      },
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: 5,
        z: 7,
        q: 1,
      },
      b: {
        y: 3,
      },
    });
  });

  it('handles merging objects with null and undefined values deeply nested', () => {
    const o1 = {
      a: {
        x: null,
        y: {
          z: 42,
          w: undefined,
        },
      },
      b: null,
    };
    const o2 = {
      a: {
        y: {
          w: 'hello',
        },
      },
      c: {
        foo: null,
      },
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: null,
        y: {
          z: 42,
          w: 'hello',
        },
      },
      b: null,
      c: {
        foo: null,
      },
    });
  });

  it('handles merging objects with nested null and undefined values', () => {
    const o1 = {
      a: {
        x: null,
        y: {
          z: 42,
          w: undefined,
        },
      },
      b: {
        foo: null,
      },
    };
    const o2 = {
      a: {
        y: {
          w: 'hello',
        },
      },
      b: null,
    };

    expect(mergeDeep(o1, o2)).toEqual({
      a: {
        x: null,
        y: {
          z: 42,
          w: 'hello',
        },
      },
      b: null,
    });
  });

  it('handles empty arrays in source and target objects', () => {
    const o1 = {
      a: [],
    };
    const o2 = {
      a: [],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [],
    });
  });

  it('handles merging when source array is empty', () => {
    const o1 = {
      a: [
        { id: 42, q: 2 },
        { id: 'a', x: 42, y: 5 },
      ],
    };
    const o2 = {
      a: [],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [
        { id: 42, q: 2 },
        { id: 'a', x: 42, y: 5 },
      ],
    });
  });

  it('handles merging when target array is empty by adding new objects at the end', () => {
    const o1 = {
      a: [],
    };
    const o2 = {
      a: [{ id: 'a', x: 21 }],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [{ id: 'a', x: 21 }],
    });
  });

  it('merging when target array has duplicate ids throws an error', () => {
    const o1 = {
      a: [
        { id: 'a', x: 42 },
        { id: 'a', y: 5 },
      ],
    };
    const o2 = {
      a: [{ id: 'a', x: 21 }],
    };

    expect(() => mergeDeep(o1, o2)).toThrow(Error);
  });

  it('merging when source array has duplicate ids throws an error', () => {
    const o1 = {
      a: [{ id: 'a', x: 42 }],
    };
    const o2 = {
      a: [
        { id: 'a', x: 21 },
        { id: 'a', y: 5 },
      ],
    };

    expect(() => mergeDeep(o1, o2)).toThrow(Error);
  });

  it('handles merging when source array contains objects with id property but null value', () => {
    const o1 = {
      a: [{ id: null, x: 42 }],
    };
    const o2 = {
      a: [{ id: null, x: 21 }],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [{ id: null, x: 21 }],
    });
  });

  it('handles merging when source array contains objects with id property but undefined value', () => {
    const o1 = {
      a: [{ id: undefined, x: 42 }],
    };
    const o2 = {
      a: [{ id: undefined, x: 21 }],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [{ id: undefined, x: 21 }],
    });
  });

  it('handles merging when source and target arrays have different lengths', () => {
    const o1 = {
      a: [{ id: 'a', x: 42 }],
    };
    const o2 = {
      a: [
        { id: 'a', x: 21 },
        { id: 'b', y: 10 },
      ],
    };
    expect(mergeDeep(o1, o2)).toEqual({
      a: [
        { id: 'a', x: 21 },
        { id: 'b', y: 10 },
      ],
    });
  });
});
