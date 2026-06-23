import path from 'path';

const FALLBACK_BASENAME = 'file';

function transliterateBasic(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };

  return value.replace(/[А-Яа-яЁё]/g, (char) => {
    const lower = char.toLowerCase();
    const mapped = map[lower] ?? '';
    return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });
}

export function normalizeUploadedFileName(originalName: string): string {
  const trimmed = path.basename((originalName || '').trim());
  const extension = path.extname(trimmed).toLowerCase();
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

export function normalizeUploadedFiles<T extends Pick<Express.Multer.File, 'originalname'>>(
  files: T | T[] | undefined
): void {
  if (!files) return;

  const items = Array.isArray(files) ? files : [files];
  for (const file of items) {
    file.originalname = normalizeUploadedFileName(file.originalname);
  }
}
