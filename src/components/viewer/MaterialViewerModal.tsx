import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Music,
  WrapText,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ResourceBadge } from '@/components/ResourceBadge';
import { resolveEmbedUrl } from '@/lib/embedResolver';
import { getFile } from '@/lib/fileStore';
import { extractExtension, formatBytes } from '@/lib/materialValidation';
import type { LessonResource } from '@/types/course';

export interface MaterialViewerModalProps {
  isOpen: boolean;
  resource: LessonResource | null;
  onClose: () => void;
}

type FileCategory = 'pdf' | 'video' | 'audio' | 'image' | 'text' | 'unsupported';

type FileLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      category: FileCategory;
      blobUrl: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      textContent?: string;
    };

const BLOCKED_INLINE_EXTENSIONS = new Set(['.svg', '.svgz', '.html', '.htm', '.xhtml']);
const BLOCKED_INLINE_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
]);

const VIDEO_EXT_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
};

const AUDIO_EXT_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

const IMAGE_EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.jsonl',
  '.ipynb',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.java',
  '.c',
  '.cpp',
  '.cc',
  '.h',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.sql',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.css',
]);

const CATEGORY_LABELS: Record<FileCategory, string> = {
  pdf: 'PDF',
  video: 'Video',
  audio: 'Audio',
  image: 'Image',
  text: 'Text / Code',
  unsupported: 'File',
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

function isSafeHttpUrl(raw?: string): raw is string {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function classifyStoredFile(
  name: string,
  mimeType: string
): { category: FileCategory; effectiveMime: string } {
  const ext = extractExtension(name);
  const normalizedMime = (mimeType || '').split(';')[0].trim().toLowerCase();

  if (
    BLOCKED_INLINE_EXTENSIONS.has(ext) ||
    BLOCKED_INLINE_MIME_TYPES.has(normalizedMime)
  ) {
    return {
      category: 'unsupported',
      effectiveMime: normalizedMime || 'application/octet-stream',
    };
  }

  if (normalizedMime === 'application/pdf' || ext === '.pdf') {
    return { category: 'pdf', effectiveMime: 'application/pdf' };
  }

  if (normalizedMime.startsWith('video/') || ext in VIDEO_EXT_MIME) {
    return {
      category: 'video',
      effectiveMime:
        normalizedMime && normalizedMime !== 'application/octet-stream'
          ? normalizedMime
          : (VIDEO_EXT_MIME[ext] ?? 'video/mp4'),
    };
  }

  if (normalizedMime.startsWith('audio/') || ext in AUDIO_EXT_MIME) {
    return {
      category: 'audio',
      effectiveMime:
        normalizedMime && normalizedMime !== 'application/octet-stream'
          ? normalizedMime
          : (AUDIO_EXT_MIME[ext] ?? 'audio/mpeg'),
    };
  }

  if (normalizedMime.startsWith('image/') || ext in IMAGE_EXT_MIME) {
    return {
      category: 'image',
      effectiveMime:
        normalizedMime && normalizedMime !== 'application/octet-stream'
          ? normalizedMime
          : (IMAGE_EXT_MIME[ext] ?? 'image/png'),
    };
  }

  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/json' ||
    normalizedMime === 'application/csv' ||
    normalizedMime === 'application/x-ipynb+json' ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return {
      category: 'text',
      effectiveMime: 'text/plain;charset=utf-8',
    };
  }

  return {
    category: 'unsupported',
    effectiveMime: normalizedMime || 'application/octet-stream',
  };
}

async function readBlobAsUtf8(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file text.'));
      reader.readAsText(blob, 'utf-8');
    });
  }
  return new Response(blob).text();
}

export function MaterialViewerModal({
  isOpen,
  resource,
  onClose,
}: MaterialViewerModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const [fileState, setFileState] = useState<FileLoadState>({ status: 'idle' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [imageZoom, setImageZoom] = useState<{ mode: 'fit' | 'scale'; zoom: number }>({
    mode: 'fit',
    zoom: 1,
  });
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fileId = resource?.file?.id;
  const fileName = resource?.file?.name;
  const fileMime = resource?.file?.mimeType;
  const resourceUrl = resource?.url;

  const resolvedUrl = useMemo(() => {
    if (!resourceUrl || !isSafeHttpUrl(resourceUrl)) return null;
    return resolveEmbedUrl(resourceUrl);
  }, [resourceUrl]);

  // Reset per-resource view controls
  useEffect(() => {
    setPlaybackRate(1);
    setImageZoom({ mode: 'fit', zoom: 1 });
    setCopied(false);
    setIframeLoaded(false);
  }, [isOpen, fileId, resourceUrl]);

  // Load IndexedDB file + manage Blob object URL lifecycle safely
  useEffect(() => {
    if (!isOpen || !fileId) {
      setFileState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    let createdObjectUrl: string | null = null;
    setFileState({ status: 'loading' });

    getFile(fileId)
      .then(async (record) => {
        if (cancelled) return;
        if (!record) {
          setFileState({
            status: 'error',
            message: `"${fileName ?? fileId}" could not be found in local browser storage.`,
          });
          return;
        }

        const classified = classifyStoredFile(
          record.name || fileName || 'file',
          record.mimeType || fileMime || ''
        );

        let textContent: string | undefined;
        if (classified.category === 'text') {
          textContent = await readBlobAsUtf8(record.blob);
          if (cancelled) return;
        }

        const blobForUrl =
          classified.category === 'text'
            ? new Blob([record.blob], { type: 'text/plain;charset=utf-8' })
            : !record.blob.type || record.blob.type === 'application/octet-stream'
              ? new Blob([record.blob], { type: classified.effectiveMime })
              : record.blob;

        createdObjectUrl = URL.createObjectURL(blobForUrl);
        if (cancelled) {
          URL.revokeObjectURL(createdObjectUrl);
          createdObjectUrl = null;
          return;
        }

        setFileState({
          status: 'ready',
          category: classified.category,
          blobUrl: createdObjectUrl,
          fileName: record.name,
          mimeType: record.mimeType || classified.effectiveMime,
          sizeBytes: record.sizeBytes,
          textContent,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFileState({
            status: 'error',
            message: `"${fileName ?? fileId}" could not be loaded from local storage.`,
          });
        }
      });

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
        createdObjectUrl = null;
      }
    };
  }, [isOpen, fileId, fileName, fileMime]);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  // Sync fullscreen state with browser fullscreenchange event
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = dialogRef.current;
    if (document.fullscreenElement) {
      Promise.resolve(document.exitFullscreen?.()).catch(() => {});
      setIsFullscreen(false);
      return;
    }

    if (el && typeof el.requestFullscreen === 'function') {
      Promise.resolve(el.requestFullscreen())
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen((prev) => !prev));
      return;
    }

    setIsFullscreen((prev) => !prev);
  }, []);

  // Sync video playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const isVideoActive =
    (fileState.status === 'ready' && fileState.category === 'video') ||
    resolvedUrl?.kind === 'direct-video';

  // Keyboard shortcuts: Escape to close + video shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen && !document.fullscreenElement) {
          setIsFullscreen(false);
          return;
        }
        onClose();
        return;
      }

      if (!isVideoActive || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
        if (
          e.key === ' ' &&
          typeof (target as Partial<Element>).closest === 'function' &&
          (target as Element).closest('button, a, [role="button"]')
        ) {
          return;
        }
      }

      const video = videoRef.current;
      if (e.key === ' ') {
        if (!video) return;
        e.preventDefault();
        if (video.paused) {
          Promise.resolve(video.play()).catch(() => {});
        } else {
          video.pause();
        }
      } else if (e.key === 'ArrowLeft') {
        if (!video) return;
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        if (!video) return;
        e.preventDefault();
        const nextTime = video.currentTime + 5;
        video.currentTime = Number.isFinite(video.duration)
          ? Math.min(video.duration, nextTime)
          : nextTime;
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, isVideoActive, onClose, toggleFullscreen]);

  if (!isOpen || !resource) return null;

  const triggerDownload = () => {
    if (fileState.status !== 'ready') return;
    const anchor = document.createElement('a');
    anchor.href = fileState.blobUrl;
    anchor.download = fileState.fileName;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleCopyText = async () => {
    if (fileState.status !== 'ready' || fileState.textContent === undefined) return;
    try {
      await navigator.clipboard?.writeText(fileState.textContent);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const openInNewTabUrl = resource.file
    ? fileState.status === 'ready' && fileState.category !== 'unsupported'
      ? fileState.blobUrl
      : null
    : isSafeHttpUrl(resource.url)
      ? resource.url.trim()
      : null;

  const metadataLine = resource.file
    ? `${resource.file.name} · ${formatBytes(resource.file.sizeBytes)}${
        fileState.status === 'ready'
          ? ` · ${CATEGORY_LABELS[fileState.category]}`
          : ''
      }`
    : resolvedUrl
      ? `${resolvedUrl.providerLabel} · ${new URL(resolvedUrl.originalUrl).hostname}`
      : 'Blocked or invalid URL';

  const renderVideoPlayer = (srcUrl: string) => (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <video
        ref={videoRef}
        src={srcUrl}
        controls
        playsInline
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
          }
        }}
        className="max-h-[68vh] w-full rounded-lg bg-black"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 self-stretch rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#1b2436]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-600 dark:text-slate-300">Speed:</span>
          {SPEED_OPTIONS.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-pressed={playbackRate === rate}
              onClick={() => setPlaybackRate(rate)}
              className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
                playbackRate === rate
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Shortcuts: Space play/pause · ←/→ seek 5s · F fullscreen
        </span>
      </div>
    </div>
  );

  const renderAudioPlayer = (srcUrl: string, label: string) => (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-[#1b2436]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
        <Music className="h-7 w-7" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Audio Material
        </p>
      </div>
      <audio controls src={srcUrl} className="w-full" />
    </div>
  );

  const renderImageViewer = (srcUrl: string, altText: string) => (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#1b2436]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() =>
              setImageZoom((prev) => ({
                mode: 'scale',
                zoom: Math.max(0.25, Number((prev.zoom - 0.25).toFixed(2))),
              }))
            }
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200"
          >
            <ZoomOut className="h-3.5 w-3.5" />
            -
          </button>
          <button
            type="button"
            onClick={() => setImageZoom({ mode: 'scale', zoom: 1 })}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200"
          >
            100%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() =>
              setImageZoom((prev) => ({
                mode: 'scale',
                zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))),
              }))
            }
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            +
          </button>
          <button
            type="button"
            onClick={() => setImageZoom({ mode: 'fit', zoom: 1 })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200"
          >
            Fit
          </button>
        </div>
        <span
          data-testid="image-zoom-readout"
          className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          {imageZoom.mode === 'fit' ? 'Fit' : `${Math.round(imageZoom.zoom * 100)}%`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0d131f]">
        {imageZoom.mode === 'fit' ? (
          <img
            src={srcUrl}
            alt={altText}
            className="max-h-[68vh] max-w-full rounded-md object-contain"
          />
        ) : (
          <img
            src={srcUrl}
            alt={altText}
            style={{ width: `${Math.round(imageZoom.zoom * 100)}%` }}
            className="max-w-none rounded-md"
          />
        )}
      </div>
    </div>
  );

  const renderTextViewer = (text: string, name: string) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const ext = extractExtension(name) || '.txt';
    return (
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#1b2436]">
          <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-300">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-slate-800 dark:bg-slate-700 dark:text-slate-100">
              {ext}
            </span>
            <span>{lines.length} lines</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={wordWrap}
              onClick={() => setWordWrap((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${
                wordWrap
                  ? 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200'
              }`}
            >
              <WrapText className="h-3.5 w-3.5" />
              Wrap
            </button>
            <button
              type="button"
              onClick={() => void handleCopyText()}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="w-10 shrink-0 select-none text-right tabular-nums text-slate-400 dark:text-slate-500">
                {idx + 1}
              </span>
              <span
                className={
                  wordWrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-words' : 'whitespace-pre'
                }
              >
                {line.length > 0 ? line : ' '}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (resource.file) {
      if (fileState.status === 'loading' || fileState.status === 'idle') {
        return (
          <div
            role="status"
            className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300"
          >
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading file...
          </div>
        );
      }

      if (fileState.status === 'error') {
        return (
          <div className="flex h-full items-center justify-center">
            <div
              role="alert"
              className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              <p className="font-medium">{fileState.message}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        );
      }

      if (fileState.category === 'pdf') {
        return (
          <iframe
            src={fileState.blobUrl}
            title={resource.title}
            className="h-full min-h-[65vh] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
          />
        );
      }

      if (fileState.category === 'video') {
        return renderVideoPlayer(fileState.blobUrl);
      }

      if (fileState.category === 'audio') {
        return renderAudioPlayer(fileState.blobUrl, fileState.fileName);
      }

      if (fileState.category === 'image') {
        return renderImageViewer(fileState.blobUrl, resource.title);
      }

      if (fileState.category === 'text') {
        return renderTextViewer(fileState.textContent ?? '', fileState.fileName);
      }

      return (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-[#1b2436]">
            <FileIcon className="mx-auto mb-3 h-10 w-10 text-slate-500 dark:text-slate-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {fileState.fileName}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              {fileState.mimeType} · {formatBytes(fileState.sizeBytes)}
            </p>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              In-app preview is not available for this file format.
            </p>
            <button
              type="button"
              onClick={triggerDownload}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-4 py-2 text-xs font-semibold text-black hover:bg-yellow-500"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>
      );
    }

    // External URL
    if (!resolvedUrl) {
      return (
        <div className="flex h-full items-center justify-center">
          <div
            role="alert"
            className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
          >
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            <p className="font-semibold">Unsafe or unsupported URL</p>
            <p className="mt-1 text-xs">
              Only http:// and https:// URLs can be opened from the viewer.
            </p>
          </div>
        </div>
      );
    }

    if (resolvedUrl.embeddable && resolvedUrl.embedUrl) {
      if (resolvedUrl.kind === 'direct-pdf') {
        return (
          <iframe
            src={resolvedUrl.embedUrl}
            title={resource.title}
            className="h-full min-h-[65vh] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
          />
        );
      }
      if (resolvedUrl.kind === 'direct-video') {
        return renderVideoPlayer(resolvedUrl.embedUrl);
      }
      if (resolvedUrl.kind === 'direct-audio') {
        return renderAudioPlayer(resolvedUrl.embedUrl, resource.title);
      }
      if (resolvedUrl.kind === 'direct-image') {
        return renderImageViewer(resolvedUrl.embedUrl, resource.title);
      }

      const isVideoEmbed =
        resolvedUrl.kind === 'youtube' || resolvedUrl.kind === 'vimeo';

      return (
        <div className="relative flex h-full flex-col items-center justify-center">
          {!iframeLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-50/80 text-xs font-medium text-slate-600 dark:bg-[#0d131f]/80 dark:text-slate-300">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading preview...
            </div>
          )}
          <iframe
            src={resolvedUrl.embedUrl}
            title={resource.title}
            onLoad={() => setIframeLoaded(true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className={
              isVideoEmbed
                ? 'aspect-video max-h-[70vh] w-full rounded-lg border border-slate-200 bg-black dark:border-slate-700'
                : 'h-full min-h-[65vh] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700'
            }
          />
        </div>
      );
    }

    // Fallback card for non-embeddable links (OneDrive/SharePoint share links, GDrive folders, external/Notion)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-lg rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-[#1b2436]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {resolvedUrl.providerLabel}
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
            {resource.title}
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            This {resolvedUrl.providerLabel} link cannot be embedded directly inside the app.
          </p>
          <p className="mt-2 break-all rounded bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-500 dark:bg-[#0d131f] dark:text-slate-400">
            {resolvedUrl.originalUrl}
          </p>
          <a
            href={resolvedUrl.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-4 py-2 text-xs font-semibold text-black hover:bg-yellow-500"
          >
            Open in new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 dark:bg-black/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 flex h-screen w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-white text-slate-900 dark:bg-[#121926] dark:text-slate-100'
            : 'flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#121926] dark:text-slate-100'
        }
      >
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ResourceBadge kind={resource.kind} />
              <h2 id={titleId} className="truncate text-sm font-bold sm:text-base">
                {resource.title}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {metadataLine}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={toggleFullscreen}
              className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {openInNewTabUrl && (
              <a
                href={openInNewTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open in new tab</span>
              </a>
            )}

            {resource.file && fileState.status === 'ready' && (
              <button
                type="button"
                onClick={triggerDownload}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              aria-label="Close viewer"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">{renderContent()}</div>
      </div>
    </div>
  );
}
