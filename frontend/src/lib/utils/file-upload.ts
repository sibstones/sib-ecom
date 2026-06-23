const FALLBACK_BASENAME = 'file';

function transliterateBasic(value: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return value.replace(/[А-Яа-яЁё]/g, (char) => {
    const lower = char.toLowerCase();
    const mapped = map[lower] ?? '';
    return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });
}

export function normalizeUploadFileName(originalName: string): string {
  const trimmed = (originalName || '').split(/[/\\]/).pop()?.trim() || '';
  const extensionMatch = trimmed.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase() || '';
  const rawBaseName = trimmed.slice(0, trimmed.length - extension.length) || FALLBACK_BASENAME;

  const normalizedBaseName = transliterateBasic(rawBaseName)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const safeBaseName = normalizedBaseName || FALLBACK_BASENAME;
  const safeExtension = extension.replace(/[^a-z0-9.]/g, '');

  return `${safeBaseName}${safeExtension}`;
}

export function normalizeUploadFile(file: File): File {
  const normalizedName = normalizeUploadFileName(file.name);
  if (normalizedName === file.name) {
    return file;
  }

  return new File([file], normalizedName, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export function normalizeUploadFiles(files: File[]): File[] {
  return files.map(normalizeUploadFile);
}
