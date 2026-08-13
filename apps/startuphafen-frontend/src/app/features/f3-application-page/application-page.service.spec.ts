import { FormlyFieldConfig } from '@ngx-formly/core';
import { TrpcService } from '@startuphafen/angular-common';
import { ApplicationPageService } from './application-page.service';

describe('ApplicationPageService.getHiddenFieldKeys', () => {
  // getHiddenFieldKeys does not touch the injected trpc client.
  const service = new ApplicationPageService(undefined as unknown as TrpcService);

  it('returns only keys whose hide expression currently evaluates truthy', () => {
    const model = { Us4_0: 'us4_0Ans-1' };
    const fields: FormlyFieldConfig[] = [
      {
        key: 'St82a_0',
        expressions: { hide: (f: any) => f.model['Us4_0'] !== 'us4_0Ans-1' },
      },
      {
        key: 'St82o_0',
        expressions: { hide: (f: any) => f.model['Us4_0'] !== 'us4_0Ans-2' },
      },
      { key: 'Us4_0' },
    ];

    const hidden = service.getHiddenFieldKeys(model, fields);

    expect(hidden).toEqual(['St82o_0']);
  });

  it('ignores fields without a hide expression and without a string key, and dedupes', () => {
    const fields: FormlyFieldConfig[] = [
      { key: 'St84a_0' }, // no hide -> visible
      { key: 'St83n_0', expressions: { hide: () => true } },
      { key: 'St83n_0', expressions: { hide: () => true } }, // duplicate key
      { expressions: { hide: () => true } }, // no key
    ];

    const hidden = service.getHiddenFieldKeys({}, fields);

    expect(hidden).toEqual(['St83n_0']);
  });
});
