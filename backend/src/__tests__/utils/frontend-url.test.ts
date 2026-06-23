import { isLocalDevUrl } from '../../utils/frontend-url';

describe('isLocalDevUrl', () => {
  it('treats localhost and 127.0.0.1 as local', () => {
    expect(isLocalDevUrl('http://localhost:5173')).toBe(true);
    expect(isLocalDevUrl('http://127.0.0.1:8080')).toBe(true);
    expect(isLocalDevUrl('')).toBe(true);
  });

  it('treats production domains as non-local', () => {
    expect(isLocalDevUrl('https://example.com')).toBe(false);
    expect(isLocalDevUrl('https://shop.example.com')).toBe(false);
  });
});
