import { getCsrfToken } from '../../middleware/csrf.middleware';
import { config } from '../../config/env';

describe('csrf.middleware', () => {
  it('reuses the existing csrf cookie instead of rotating it', () => {
    const existingToken = 'existing-csrf-token';
    const cookie = jest.fn();
    const json = jest.fn();

    getCsrfToken(
      {
        cookies: {
          [config.csrf.cookieName]: existingToken,
        },
      } as any,
      {
        cookie,
        json,
      } as any
    );

    expect(cookie).toHaveBeenCalledWith(
      config.csrf.cookieName,
      existingToken,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );
    expect(json).toHaveBeenCalledWith({ csrfToken: existingToken });
  });
});
