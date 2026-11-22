import { describe, expect, it } from 'vitest';
import {
  DANGEROUS_EXTENSIONS,
  DANGEROUS_MIME_TYPES,
  EXPECTED_EXTENSIONS_BY_KIND,
  formatBytes,
  getExpectedExtensionsHint,
  suggestResourceKind,
  validateMaterialFile,
} from '@/lib/materialValidation';
import { ResourceKindSchema } from '@/types/course';

describe('materialValidation', () => {
  it('enforces NO file size cap and accepts very large files (e.g. 150 MB)', () => {
    const hugeVideo = {
      name: 'lecture-recording.mp4',
      size: 150 * 1024 * 1024,
      type: 'video/mp4',
    };
    const result = validateMaterialFile(hugeVideo, 'video');
    expect(result).toEqual({
      ok: true,
      suggestedKind: 'video',
    });
  });

  it('accepts arbitrary non-dangerous extensions without an allowlist block', () => {
    const blendFile = {
      name: 'scene.blend',
      size: 4096,
      type: 'application/octet-stream',
    };
    expect(validateMaterialFile(blendFile)).toEqual({
      ok: true,
      suggestedKind: 'document',
    });
  });

  it('rejects 0-byte empty files', () => {
    const result = validateMaterialFile({
      name: 'empty.pdf',
      size: 0,
      type: 'application/pdf',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain('empty');
    }
  });

  it('rejects dangerous executable and scriptable extensions case-insensitively', () => {
    const blocked = ['.exe', '.bat', '.sh', '.msi', '.dll', '.cmd', '.ps1', '.html', '.svg'];
    for (const ext of blocked) {
      expect(DANGEROUS_EXTENSIONS).toContain(ext);
      const lower = validateMaterialFile({
        name: `payload${ext}`,
        size: 1024,
        type: 'application/octet-stream',
      });
      const upper = validateMaterialFile({
        name: `PAYLOAD${ext.toUpperCase()}`,
        size: 1024,
        type: 'application/octet-stream',
      });
      expect(lower.ok).toBe(false);
      expect(upper.ok).toBe(false);
    }
  });

  it('rejects dangerous MIME types even when extension looks innocuous', () => {
    expect(DANGEROUS_MIME_TYPES).toContain('text/html');
    expect(DANGEROUS_MIME_TYPES).toContain('image/svg+xml');

    const htmlSpoof = validateMaterialFile({
      name: 'notes.txt',
      size: 512,
      type: 'text/html; charset=utf-8',
    });
    expect(htmlSpoof.ok).toBe(false);

    const svgSpoof = validateMaterialFile({
      name: 'diagram.png',
      size: 512,
      type: 'image/svg+xml',
    });
    expect(svgSpoof.ok).toBe(false);
  });

  it('accurately suggests ResourceKind from file extension', () => {
    expect(suggestResourceKind('week1.pptx')).toBe('slides');
    expect(suggestResourceKind('deck.PPT')).toBe('slides');
    expect(suggestResourceKind('lecture.mp4')).toBe('video');
    expect(suggestResourceKind('recording.webm')).toBe('video');
    expect(suggestResourceKind('podcast.mp3')).toBe('audio');
    expect(suggestResourceKind('voice-note.wav')).toBe('audio');
    expect(suggestResourceKind('lecture-audio.m4a')).toBe('audio');
    expect(suggestResourceKind('starter.zip')).toBe('lab');
    expect(suggestResourceKind('analysis.ipynb')).toBe('lab');
    expect(suggestResourceKind('solution.py')).toBe('lab');
    expect(suggestResourceKind('manual.epub')).toBe('textbook');
    expect(suggestResourceKind('chapter1.pdf')).toBe('document');
    expect(suggestResourceKind('notes.md')).toBe('document');
    expect(suggestResourceKind('unknown.xyz')).toBe('document');
  });

  it('provides expected extensions and hints for every ResourceKind', () => {
    for (const kind of ResourceKindSchema.options) {
      expect(EXPECTED_EXTENSIONS_BY_KIND[kind].length).toBeGreaterThan(0);
      expect(getExpectedExtensionsHint(kind)).toContain(EXPECTED_EXTENSIONS_BY_KIND[kind][0]);
    }
  });

  it('returns a non-blocking warning when extension mismatches selectedKind while still succeeding', () => {
    const mismatch = validateMaterialFile(
      {
        name: 'lecture.mp4',
        size: 2048,
        type: 'video/mp4',
      },
      'slides'
    );
    expect(mismatch.ok).toBe(true);
    if (mismatch.ok) {
      expect(mismatch.suggestedKind).toBe('video');
      expect(mismatch.warning).toBeTruthy();
      expect(mismatch.warning).toContain('slides');
    }

    const match = validateMaterialFile(
      {
        name: 'deck.pptx',
        size: 2048,
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
      'slides'
    );
    expect(match).toEqual({
      ok: true,
      suggestedKind: 'slides',
    });
  });

  it('formats byte sizes cleanly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});
