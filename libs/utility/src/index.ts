export * from './lib/superjson';
export * from './lib/uuid';

import _ from 'lodash';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function distinctGroupBy<T>(
  data: T[],
  idPick: (element: T) => string | number
): Record<string, T> {
  const gby = _.groupBy(data, idPick);
  const distinctBy: Record<string, T> = _.mapValues(gby, (xs) => {
    if (xs.length !== 1) {
      console.log(xs);
      throw new Error(
        'Cannot distinct group by over data, found non-distinct id: ' +
          idPick(xs[0])
      );
    }

    return xs[0];
  });

  return distinctBy;
}

export const printLog = console.log.bind(console);

export function resolvePathWithParameters(
  path: string[],
  params?: Record<string, string | number>
) {
  let r = '/' + path.join('/');

  if (params == null) {
    return r;
  }

  for (const [k, v] of Object.entries(params)) {
    r = r.replaceAll(':' + k, v + '');
  }
  return r;
}
