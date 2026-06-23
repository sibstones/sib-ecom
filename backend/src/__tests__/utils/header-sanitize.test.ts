import {
  sanitizeHeaderSettingsInput,
  sanitizeHeaderSettingsOutput,
} from '../../utils/header-sanitize';

describe('header sanitization', () => {
  it('removes script payloads from SVG markup', () => {
    const sanitized = sanitizeHeaderSettingsInput({
      logoSvg:
        '<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M0 0h24v24z" onclick="alert(1)" /></svg>',
    });

    expect(sanitized.logoSvg).toContain('<svg');
    expect(sanitized.logoSvg).toContain('<path');
    expect(sanitized.logoSvg).not.toContain('<script');
    expect(sanitized.logoSvg).not.toContain('onclick');
  });

  it('rejects javascript links and keeps safe local links', () => {
    const sanitized = sanitizeHeaderSettingsInput({
      logoLink: 'javascript:alert(1)',
      quickLinks: [
        { label: 'Safe', link: '/account/profile', visible: true },
        { label: 'Unsafe', link: 'javascript:alert(2)', visible: true },
      ],
    });

    expect(sanitized.logoLink).toBe('/');
    expect(sanitized.quickLinks).toEqual([
      { label: 'Safe', link: '/account/profile', visible: true },
    ]);
  });

  it('sanitizes legacy stored custom icons and navigation blocks on read', () => {
    const sanitized = sanitizeHeaderSettingsOutput({
      logoSvg: '<svg><foreignObject><script>alert(1)</script></foreignObject><path d="M1 1" /></svg>',
      customIcons: [
        {
          name: 'Bad',
          svg: '<svg><path d="M1 1" /><script>alert(1)</script></svg>',
          link: 'https://example.com',
          visible: true,
        },
      ],
      navigationBlocks: [
        {
          id: 'x',
          type: 'custom',
          enabled: true,
          icon: '<svg><path d="M2 2" onload="alert(1)" /></svg>',
          link: 'javascript:alert(1)',
          label: 'Injected',
          order: 1,
        },
      ],
    });

    expect(String(sanitized.logoSvg)).not.toContain('<script');
    expect(Array.isArray(sanitized.customIcons)).toBe(true);
    expect(String((sanitized.customIcons as Array<{ svg: string }>)[0].svg)).not.toContain('<script');
    expect((sanitized.navigationBlocks as Array<{ link?: string; icon?: string }>)[0].link).toBeUndefined();
    expect(String((sanitized.navigationBlocks as Array<{ icon?: string }>)[0].icon)).not.toContain('onload');
  });
});
