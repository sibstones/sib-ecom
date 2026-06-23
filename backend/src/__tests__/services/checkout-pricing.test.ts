import { resolveTaxRate } from '../../utils/country';

describe('checkout pricing tax rate', () => {
  it('treats explicit zero tax rate as zero (not default)', () => {
    expect(resolveTaxRate({ taxRate: 0 }, 0.1)).toBe(0);
  });
});
