import { resolveOzgDomain } from './plz-lookup-service';

describe('resolveOzgDomain', () => {
  test('returns the original domain outside staging', () => {
    expect(
      resolveOzgDomain(
        'https://example-amt.kop.example.invalid/',
        false
      )
    ).toBe('https://example-amt.kop.example.invalid/');
  });

  test('rewrites kop domains to kop-stage on staging', () => {
    expect(
      resolveOzgDomain(
        'https://example-amt.kop.example.invalid/',
        true
      )
    ).toBe('https://example-amt.kop-stage.example.invalid/');
  });

  test('keeps already rewritten staging domains unchanged', () => {
    expect(
      resolveOzgDomain(
        'https://example-amt.kop-stage.example.invalid/',
        true
      )
    ).toBe('https://example-amt.kop-stage.example.invalid/');
  });

  test('keeps null domains unchanged', () => {
    expect(resolveOzgDomain(null, true)).toBeNull();
  });
});
