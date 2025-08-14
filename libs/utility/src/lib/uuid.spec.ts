import { v4 as uuidv4 } from 'uuid';
import { generateUUID, generateUUIDs, md5UUID } from './uuid';

// These tests are not deterministic.
// the bigger the more test runs are done to detect errors that happen randomly, but the longer the tests will take
const N = 15000;

function checkPredictableAndNoCollisions(seq1: string[], seq2: string[]) {
  expect(seq1).toEqual(seq2);

  const gset = new Set<string>();
  for (const x of seq1) {
    gset.add(x);
  }

  expect(gset.size).toEqual(seq1.length);
}

describe('UUID helper code', function () {
  describe('The seeded UUID generator', function () {
    it('should generate distinct random UUIDs by default', function () {
      const generatedSet = new Set<string>();
      const ln = N * 10;

      for (let i = 0; i < ln; i++) {
        generatedSet.add(generateUUID());
      }

      expect(generatedSet.size).toEqual(ln);
    });

    it('should be predictable if given a seed value, but still not produce collisions', function () {
      for (let i = 0; i < 10; i++) {
        const seed = uuidv4();
        const seq1 = generateUUIDs(N, seed);
        const seq2 = generateUUIDs(N, seed);

        checkPredictableAndNoCollisions(seq1, seq2);
      }
    });

    it('should also allow for one-by-one calling with predictability and no collisions', function () {
      const chainUsage = (n: number, seed: string) => {
        const result: string[] = [];
        let lastSeed = seed;
        for (let i = 0; i < n; i++) {
          lastSeed = generateUUID(lastSeed);
          result.push(lastSeed);
        }
        return result;
      };

      for (let i = 0; i < 3; i++) {
        const seed = uuidv4();

        const seq1 = chainUsage(N, seed);
        const seq2 = chainUsage(N, seed);

        checkPredictableAndNoCollisions(seq1, seq2);
      }
    });

    it('should use reasonably long string input as seed', function () {
      for (let i = 0; i < 100; i++) {
        let s = '';
        const testSet = new Set<string>();
        const ln = 20;

        for (let i = 0; i < ln; i++) {
          s += uuidv4();
          testSet.add(generateUUID(s));
        }

        expect(testSet.size).toEqual(ln);
      }
    });
  });

  describe('the md5 hash based UUID generator function', function () {
    it('should produce distinct, but predictable, UUIDs for distinct input data', function () {
      for (let i = 0; i < 10; i++) {
        const seed = uuidv4();
        const prevMap1 = generateUUIDs(N, seed);
        const seq1 = prevMap1.map(md5UUID);
        expect(prevMap1).not.toEqual(seq1);
        const seq2 = prevMap1.map(md5UUID);

        checkPredictableAndNoCollisions(seq1, seq2);
      }
    });
  });
});
