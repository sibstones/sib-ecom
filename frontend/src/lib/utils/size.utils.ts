export type CustomSizeEntry = {
  value: string;
  label?: string;
  widthCm?: number | string;
  heightCm?: number | string;
};

/** Wrap container for size option buttons — flex only (never grid columns). */
export const sizeButtonsWrapClass = 'product-size-options flex flex-wrap gap-2 min-w-0';

/**
 * Size option button — grows with label; normal-case overrides global button uppercase.
 * No max-w-full / nowrap: those caused cm labels (e.g. 3×15) to spill past the border.
 */
export const productSizeButtonClass =
  'product-size-option inline-flex items-center justify-center box-border w-fit min-w-min max-w-none shrink-0 tabular-nums normal-case leading-snug text-center whitespace-nowrap';

/** @deprecated use productSizeButtonClass */
export const customSizeButtonClass = productSizeButtonClass;

function formatDimensionCm(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n.replace(',', '.')) : n;
  if (Number.isNaN(num)) return String(n).trim();
  return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(2)));
}

function formatDimensionPair(widthCm: number | string, heightCm: number | string): string {
  return `${formatDimensionCm(widthCm)}\u00a0×\u00a0${formatDimensionCm(heightCm)}`;
}

function isNumericDimension(s: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(s.trim());
}

const DIMENSION_PAIR_RE =
  /^(\d+(?:[.,]\d+)?)\s*(?:[x×*хХ]\s*|\s+by\s+|\s+на\s+|\s+)\s*(\d+(?:[.,]\d+)?)$/i;

const COMPACT_DIMENSION_RE = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm$/i;

const GLUED_DIMENSION_CM_RE = /^(\d+(?:[.,]\d+)?)[x×](\d+(?:[.,]\d+)?)cm$/i;

const GLUED_DIMENSION_RE = /^(\d+(?:[.,]\d+)?)[x×](\d+(?:[.,]\d+)?)$/i;

/** Parse display strings like `3X15CM`, `70 x 100`, `70×100`. */
function formatDimensionDisplayString(raw: string, withCmSuffix = false): string | null {
  const s = raw.trim();
  if (!s) return null;

  const parsed = parseCustomSizeDimensions(s);
  if (parsed) {
    const pair = formatDimensionPair(parsed.widthCm, parsed.heightCm);
    return withCmSuffix ? `${pair} cm` : pair;
  }

  const compact = s.match(COMPACT_DIMENSION_RE) ?? s.match(GLUED_DIMENSION_CM_RE);
  if (compact) {
    const pair = formatDimensionPair(compact[1], compact[2]);
    return withCmSuffix || /cm\s*$/i.test(s) ? `${pair} cm` : pair;
  }

  const glued = s.match(GLUED_DIMENSION_RE);
  if (glued) {
    return formatDimensionPair(glued[1], glued[2]);
  }

  const loose = s.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i);
  if (loose) {
    return formatDimensionPair(loose[1], loose[2]);
  }

  return null;
}

/** Parse "70 x 100", "70×100", "70x100", etc. */
export function parseCustomSizeDimensions(
  input: string
): { widthCm: number; heightCm: number } | null {
  const s = input.trim();
  if (!s) return null;

  const match = s.match(DIMENSION_PAIR_RE);
  if (!match) return null;

  const widthCm = parseFloat(match[1].replace(',', '.'));
  const heightCm = parseFloat(match[2].replace(',', '.'));
  if (!widthCm || !heightCm || widthCm <= 0 || heightCm <= 0) return null;

  return { widthCm, heightCm };
}

export function buildCustomSizeValue(widthCm: number | string, heightCm: number | string): string {
  return `${formatDimensionCm(widthCm)}x${formatDimensionCm(heightCm)}`;
}

export function createCustomSizeEntry(opts: {
  line?: string;
  widthCm?: number | string;
  heightCm?: number | string;
}): CustomSizeEntry | null {
  const line = (opts.line ?? '').trim();
  let widthCm: number | undefined;
  let heightCm: number | undefined;

  if (line) {
    const parsed = parseCustomSizeDimensions(line);
    if (parsed) {
      widthCm = parsed.widthCm;
      heightCm = parsed.heightCm;
    } else if (isNumericDimension(line)) {
      const single = parseFloat(line.replace(',', '.'));
      if (single > 0) {
        const v = formatDimensionCm(single);
        return { value: v, label: v };
      }
      return null;
    } else {
      return null;
    }
  } else {
    widthCm = parseFloat(String(opts.widthCm ?? '').replace(',', '.'));
    heightCm = parseFloat(String(opts.heightCm ?? '').replace(',', '.'));
  }

  if (!widthCm || !heightCm || widthCm <= 0 || heightCm <= 0) return null;

  const value = buildCustomSizeValue(widthCm, heightCm);
  return {
    value,
    label: formatDimensionPair(widthCm, heightCm),
    widthCm,
    heightCm,
  };
}

/** Display label for CUSTOM cm sizes (width × height). */
export function getCustomSizeDisplayLabel(
  size: CustomSizeEntry | string | null | undefined
): string {
  if (!size) return '';
  if (typeof size === 'string') {
    return formatDimensionDisplayString(size) ?? size.trim();
  }

  const w = size.widthCm;
  const h = size.heightCm;
  if (w != null && w !== '' && h != null && h !== '') {
    return formatDimensionPair(w, h);
  }

  const value = String(size.value ?? '').trim();
  const label = String(size.label ?? '').trim();

  for (const raw of [label, value]) {
    const formatted = formatDimensionDisplayString(raw, true);
    if (formatted) return formatted;
  }

  if (value && label && value !== label && isNumericDimension(value) && isNumericDimension(label)) {
    return formatDimensionPair(value, label);
  }

  return label || value;
}

/** Button label for any size value (CUSTOM object, legacy object, or plain string). */
export function getSizeButtonLabel(size: CustomSizeEntry | string | null | undefined): string {
  if (size == null) return '';
  if (typeof size === 'object' && 'value' in size) {
    return getCustomSizeDisplayLabel(size);
  }
  const raw = String(size).trim();
  if (!raw) return '';
  const formatted = getCustomSizeDisplayLabel(raw);
  return formatted || raw;
}

/**
 * Formats a size value for display by removing the type prefix (CLOTHING:, SHOES:, CUSTOM:, VOLUME:, WEIGHT:)
 * @param size - Size value in format "TYPE:SIZE" or just "SIZE"
 * @returns Formatted size without type prefix
 */
export function formatSizeForDisplay(size: string | null | undefined): string {
  if (!size) return '';

  const sizeStr = String(size).trim();
  if (!sizeStr) return '';

  const parts = sizeStr.split(':');
  if (parts.length === 2) {
    const [, raw] = parts;
    return formatDimensionDisplayString(raw) ?? raw;
  }

  return formatDimensionDisplayString(sizeStr) ?? sizeStr;
}
