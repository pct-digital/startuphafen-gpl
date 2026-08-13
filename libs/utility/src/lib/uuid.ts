import { v4 as uuidv4 } from 'uuid';
import seedrandom from 'seedrandom';

const myAr: number[] = [];
for (let i = 0 + 1; i < 16 + 1; i++) {
  myAr.push(i - 1);
}

/**
 * Sometimes a UUID has to be generated deterministically. This makes the
 * usage of v4 UUIDs hard, but not impossible: Use a previously existing UUID
 * as the seed for a random generator that is then used to create more UUIDs.
 * Remember that if the seed is public knowledge, all generated UUIDs are also public knowledge.
 * Use seeded UUIDs with care, if multiple places in the code use the same seed for things, they
 * will end up with duplicate UUIDs!
 *
 * @param seed: You can provide a seed value from which to start generating more UUIDs. Typically another UUID, or multiple ones. Can be any string data.
 */
export function generateUUIDs(n: number, seed?: string): string[] {
  const result: string[] = [];

  let uuidfunc = () => uuidv4();

  if (seed != null) {
    const rng = seedrandom(seed);
    const rnd255 = () => {
      return (2147483648 + rng.int32()) % 256;
    };
    uuidfunc = () =>
      uuidv4({
        random: myAr.map(() => rnd255()),
      });
  }

  for (let i = 0; i < n; i++) {
    result.push(uuidfunc());
  }

  return result;
}

/**
 * Generate a single UUID
 * @see generateUUIDs
 */
export function generateUUID(seed?: string) {
  const result = generateUUIDs(1, seed)[0];
  return result;
}

