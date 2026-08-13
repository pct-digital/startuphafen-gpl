import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { AddressValidationService } from './address-validation.service';

describe('AddressValidationService', () => {
  let spectator: SpectatorService<AddressValidationService>;
  const createService = createServiceFactory({
    service: AddressValidationService,
  });

  const normalFetch = global.fetch;

  beforeEach(() => {
    spectator = createService();
  });

  afterEach(() => {
    global.fetch = normalFetch;
  });

  it('should handle pagination and cache localities', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve([{ name: 'Kiel' }, { name: 'Hamburg' }]),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve([{ name: 'Flensburg' }]),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve([]),
        })
      ) as jest.Mock;

    expect(await spectator.service.getLocalities('12345')).toEqual([
      { name: 'Kiel' },
      { name: 'Hamburg' },
      { name: 'Flensburg' },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    expect(await spectator.service.getLocalities('12345')).toEqual([
      { name: 'Kiel' },
      { name: 'Hamburg' },
      { name: 'Flensburg' },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should cache streets', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(['Teststraße 1']),
      })
    ) as jest.Mock;

    expect(
      await spectator.service.getStreets('Teststraße', '12345', 'Teststadt')
    ).toEqual(['Teststraße 1']);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    expect(
      await spectator.service.getStreets('Teststraße', '12345', 'Teststadt')
    ).toEqual(['Teststraße 1']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle street names with different endings', async () => {
    let getStreetsMock = jest
      .fn()
      .mockResolvedValue(['Teststraße 1', 'Teststraße 2']);
    jest
      .spyOn(spectator.service, 'getStreets')
      .mockImplementation(getStreetsMock);

    expect(
      await spectator.service.streetExistsInPostalCode(
        '12345',
        'Teststraße',
        'Teststadt'
      )
    ).toBe(true);
    expect(getStreetsMock).toHaveBeenCalledWith(
      'Teststr.',
      '12345',
      'Teststadt'
    );

    getStreetsMock = jest.fn().mockResolvedValue([]);
    jest
      .spyOn(spectator.service, 'getStreets')
      .mockImplementation(getStreetsMock);

    expect(
      await spectator.service.streetExistsInPostalCode(
        '12345',
        'Teststr',
        'Teststadt'
      )
    ).toBe(false);
    expect(getStreetsMock).toHaveBeenCalledWith(
      'Teststr.',
      '12345',
      'Teststadt'
    );
  });
});
