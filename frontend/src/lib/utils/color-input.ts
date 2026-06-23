/**
 * `<input type="color">` requires a value in `#rrggbb` form. Empty or invalid strings
 * cause a browser console warning. Use this for the color picker's `value` only.
 */
export function hexForColorInput(stored: string | undefined | null, fallback: string): string {
  if (typeof stored === 'string' && /^#[0-9A-Fa-f]{6}$/.test(stored)) return stored;
  if (typeof stored === 'string' && /^#[0-9A-Fa-f]{3}$/.test(stored)) {
    const h = stored.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return fallback;
}
