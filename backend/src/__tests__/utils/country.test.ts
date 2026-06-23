import { resolveTaxRate } from '../../utils/country';

describe('resolveTaxRate', () => {
  it('returns 0 when country tax rate is explicitly zero', () => {
    expect(resolveTaxRate({ taxRate: 0 }, 0.1)).toBe(0);
  });

  it('returns configured rate when set', () => {
    expect(resolveTaxRate({ taxRate: 0.2 }, 0.1)).toBe(0.2);
  });

  it('returns default when settings are missing', () => {
    expect(resolveTaxRate(null, 0.1)).toBe(0.1);
    expect(resolveTaxRate(undefined, 0)).toBe(0);
  });
});
