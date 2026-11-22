import type { ResourceKind } from '@/types/course';

export const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.sh',
  '.msi',
  '.dll',
  '.cmd',
  '.ps1',
  '.com',
  '.scr',
  '.pif',
  '.hta',
  '.cpl',
  '.jar',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.html',
  '.htm',
  '.xhtml',
  '.svg',
  '.svgz',
] as const;

export const DANGEROUS_MIME_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-msi',
  'application/java-archive',
] as const;

const DANGEROUS_EXTENSIONS_SET = new Set<string>(DANGEROUS_EXTENSIONS);
const DANGEROUS_MIME_TYPES_SET = new Set<string>(DANGEROUS_MIME_TYPES);

export const EXPECTED_EXTENSIONS_BY_KIND: Record<ResourceKind, readonly string[]> = {
  slides: ['.pdf', '.ppt', '.pptx', '.key', '.odp'],
  video: ['.mp4', '.webm', '.mov', '.mkv', '.m4v'],
  lab: ['.pdf', '.zip', '.ipynb', '.py', '.js', '.ts', '.java', '.c', '.cpp', '.mp4', '.webm'],
  document: ['.pdf', '.doc', '.docx', '.txt', '.md', '.epub'],
  textbook: ['.pdf', '.epub', '.djvu', '.doc', '.docx'],
  course: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip', '.txt', '.md'],
  official: ['.pdf', '.doc', '.docx', '.txt', '.md'],
  exam: ['.pdf', '.doc', '.docx', '.txt', '.md', '.zip'],
  assignment: ['.pdf', '.doc', '.docx', '.txt', '.md', '.zip', '.ipynb'],
};

const SLIDES_SUGGEST_EXTENSIONS = new Set(['.ppt', '.pptx', '.key', '.odp']);
const VIDEO_SUGGEST_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.m4v',
  '.avi',
  '.mp3',
  '.wav',
  '.m4a',
]);
const LAB_SUGGEST_EXTENSIONS = new Set([
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.ipynb',
  '.py',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.sql',
  '.csv',
  '.json',
]);
const TEXTBOOK_SUGGEST_EXTENSIONS = new Set(['.epub', '.djvu']);

export function extractExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot).toLowerCase() : '';
}

export function getExpectedExtensionsHint(kind: ResourceKind): string {
  return EXPECTED_EXTENSIONS_BY_KIND[kind].join(', ');
}

export function suggestResourceKind(fileName: string): ResourceKind {
  const ext = extractExtension(fileName);
  if (SLIDES_SUGGEST_EXTENSIONS.has(ext)) return 'slides';
  if (VIDEO_SUGGEST_EXTENSIONS.has(ext)) return 'video';
  if (LAB_SUGGEST_EXTENSIONS.has(ext)) return 'lab';
  if (TEXTBOOK_SUGGEST_EXTENSIONS.has(ext)) return 'textbook';
  return 'document';
}

export type MaterialValidationResult =
  | { ok: true; suggestedKind: ResourceKind; warning?: string }
  | { ok: false; error: string };

export function validateMaterialFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  selectedKind?: ResourceKind
): MaterialValidationResult {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: 'Empty files (0 bytes) cannot be uploaded.',
    };
  }

  const ext = extractExtension(file.name);
  if (ext && DANGEROUS_EXTENSIONS_SET.has(ext)) {
    return {
      ok: false,
      error: `File type "${ext}" is blocked because executable and scriptable files are not permitted.`,
    };
  }

  const normalizedMime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (normalizedMime && DANGEROUS_MIME_TYPES_SET.has(normalizedMime)) {
    return {
      ok: false,
      error: `MIME type "${normalizedMime}" is blocked because executable and scriptable files are not permitted.`,
    };
  }

  const suggestedKind = suggestResourceKind(file.name);

  if (selectedKind) {
    const expected = EXPECTED_EXTENSIONS_BY_KIND[selectedKind];
    if (!ext || !expected.includes(ext)) {
      const extDisplay = ext || 'no extension';
      return {
        ok: true,
        suggestedKind,
        warning: `File (${extDisplay}) doesn't match typical ${selectedKind} extensions (${getExpectedExtensionsHint(selectedKind)}).`,
      };
    }
  }

  return {
    ok: true,
    suggestedKind,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${units[unitIndex]}`;
}
