import { v4 as uuidv4 } from 'uuid';
import seedrandom from 'seedrandom';
import { Md5 } from 'ts-md5';

const myAr: number[] = [];
for (let i = 0 + 1; i < 16 + 1; i++) {
  myAr.push(i - 1);
}

/**
 * In the context of NgRx we are often faced with the problem of generating a UUID
 * in a place where we need to be deterministic. This makes the usage of v4 UUIDs hard,
 * but not impossible: Use a previously existing UUID as the seed for a random generator
 * that is then used to create more UUIDs.
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

/**
 * Take an md5 of the provided data and format it as a UUID.
 * Useful to create a UUID based on some data input that has no "nice" primary key, but needs
 * a predictable key.
 */
export function md5UUID(data: string) {
  const result = Md5.hashStr(data, true);
  const b4 = (n: number) => {
    const pn = 2147483648 + n;
    return [(pn >> 24) & 0xff, (pn >> 16) & 0xff, (pn >> 8) & 0xff, (pn >> 0) & 0xff];
  };
  const random = [...b4(result[0]), ...b4(result[1]), ...b4(result[2]), ...b4(result[3])];
  return uuidv4({ random });
}
