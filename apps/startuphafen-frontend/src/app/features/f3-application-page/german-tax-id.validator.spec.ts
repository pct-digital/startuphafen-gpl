import { isValidGermanTaxId } from './german-tax-id.validator';

describe('isValidGermanTaxId', () => {
  it('accepts a syntactically valid German tax ID with matching check digit', () => {
    expect(isValidGermanTaxId('10020345677')).toBe(true);
  });

  it('rejects a German tax ID with an invalid check digit', () => {
    expect(isValidGermanTaxId('10020345676')).toBe(false);
  });

  it('rejects values without a valid German tax ID digit distribution', () => {
    expect(isValidGermanTaxId('12345678903')).toBe(false);
  });

  it('leaves empty values to required validation', () => {
    expect(isValidGermanTaxId('')).toBe(true);
  });
});
