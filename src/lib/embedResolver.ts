export type EmbedKind =
  | 'google-drive'
  | 'onedrive'
  | 'youtube'
  | 'vimeo'
  | 'direct-video'
  | 'direct-audio'
  | 'direct-pdf'
  | 'direct-image'
  | 'external';

export interface ResolvedEmbed {
  kind: EmbedKind;
  embedUrl: string | null;
  originalUrl: string;
  providerLabel: string;
  embeddable: boolean;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'] as const;
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'] as const;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'] as const;

function parseStartSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const val = Number(trimmed);
    return val > 0 ? val : null;
  }
  if (/^\d+s$/.test(trimmed)) {
    const val = Number(trimmed.slice(0, -1));
    return val > 0 ? val : null;
  }

  const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!hmsMatch) return null;
  const hours = hmsMatch[1] ? Number(hmsMatch[1]) : 0;
  const minutes = hmsMatch[2] ? Number(hmsMatch[2]) : 0;
  const seconds = hmsMatch[3] ? Number(hmsMatch[3]) : 0;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function buildGoogleDrivePreviewUrl(id: string, resourceKey: string | null): string {
  const base = `https://drive.google.com/file/d/${id}/preview`;
  if (!resourceKey) return base;
  return `${base}?resourcekey=${encodeURIComponent(resourceKey)}`;
}

function resolveGoogleUrl(parsed: URL, originalUrl: string): ResolvedEmbed | null {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host === 'drive.google.com') {
    const normalizedPath = path.replace(/^\/u\/\d+(?=\/)/, '');
    const resourceKey = parsed.searchParams.get('resourcekey');
    const fileMatch = normalizedPath.match(/^\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      return {
        kind: 'google-drive',
        embedUrl: buildGoogleDrivePreviewUrl(fileMatch[1], resourceKey),
        originalUrl,
        providerLabel: 'Google Drive',
        embeddable: true,
      };
    }

    if (normalizedPath === '/open' || normalizedPath === '/uc') {
      const id = parsed.searchParams.get('id');
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
        return {
          kind: 'google-drive',
          embedUrl: buildGoogleDrivePreviewUrl(id, resourceKey),
          originalUrl,
          providerLabel: 'Google Drive',
          embeddable: true,
        };
      }
    }

    return {
      kind: 'google-drive',
      embedUrl: null,
      originalUrl,
      providerLabel: 'Google Drive',
      embeddable: false,
    };
  }

  if (host === 'docs.google.com') {
    const pubDocMatch = path.match(
      /^\/document(?:\/u\/\d+)?\/d\/e\/([a-zA-Z0-9_-]+)\/pub(?:\/|$)/
    );
    if (pubDocMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/document/d/e/${pubDocMatch[1]}/pub?embedded=true`,
        originalUrl,
        providerLabel: 'Google Docs',
        embeddable: true,
      };
    }

    const docMatch = path.match(
      /^\/document(?:\/u\/\d+)?\/d\/(?!e(?:\/|$))([a-zA-Z0-9_-]+)/
    );
    if (docMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/document/d/${docMatch[1]}/preview`,
        originalUrl,
        providerLabel: 'Google Docs',
        embeddable: true,
      };
    }

    const pubSlidesMatch = path.match(
      /^\/presentation(?:\/u\/\d+)?\/d\/e\/([a-zA-Z0-9_-]+)\/(?:pub|embed)(?:\/|$)/
    );
    if (pubSlidesMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/presentation/d/e/${pubSlidesMatch[1]}/embed`,
        originalUrl,
        providerLabel: 'Google Slides',
        embeddable: true,
      };
    }

    const slidesMatch = path.match(
      /^\/presentation(?:\/u\/\d+)?\/d\/(?!e(?:\/|$))([a-zA-Z0-9_-]+)/
    );
    if (slidesMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed`,
        originalUrl,
        providerLabel: 'Google Slides',
        embeddable: true,
      };
    }

    const pubSheetsMatch = path.match(
      /^\/spreadsheets(?:\/u\/\d+)?\/d\/e\/([a-zA-Z0-9_-]+)\/pubhtml(?:\/|$)/
    );
    if (pubSheetsMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/spreadsheets/d/e/${pubSheetsMatch[1]}/pubhtml?widget=true&headers=false`,
        originalUrl,
        providerLabel: 'Google Sheets',
        embeddable: true,
      };
    }

    const sheetsMatch = path.match(
      /^\/spreadsheets(?:\/u\/\d+)?\/d\/(?!e(?:\/|$))([a-zA-Z0-9_-]+)/
    );
    if (sheetsMatch) {
      return {
        kind: 'google-drive',
        embedUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview`,
        originalUrl,
        providerLabel: 'Google Sheets',
        embeddable: true,
      };
    }

    const fallbackLabel = path.startsWith('/presentation')
      ? 'Google Slides'
      : path.startsWith('/spreadsheets')
        ? 'Google Sheets'
        : 'Google Docs';

    return {
      kind: 'google-drive',
      embedUrl: null,
      originalUrl,
      providerLabel: fallbackLabel,
      embeddable: false,
    };
  }

  return null;
}

function resolveOneDriveUrl(parsed: URL, originalUrl: string): ResolvedEmbed | null {
  const host = parsed.hostname.toLowerCase();
  const pathLower = parsed.pathname.toLowerCase();

  if (host === '1drv.ms') {
    return {
      kind: 'onedrive',
      embedUrl: null,
      originalUrl,
      providerLabel: 'OneDrive',
      embeddable: false,
    };
  }

  if (host === 'onedrive.live.com') {
    if (pathLower === '/embed' || pathLower.startsWith('/embed/')) {
      const hasIdentifier =
        Boolean(parsed.searchParams.get('resid')) ||
        Boolean(parsed.searchParams.get('cid')) ||
        Boolean(parsed.searchParams.get('id'));
      if (hasIdentifier) {
        return {
          kind: 'onedrive',
          embedUrl: originalUrl,
          originalUrl,
          providerLabel: 'OneDrive',
          embeddable: true,
        };
      }
    }

    if (pathLower === '/redir' || pathLower === '/view.aspx') {
      const resid = parsed.searchParams.get('resid');
      const authkey = parsed.searchParams.get('authkey');
      if (resid && authkey) {
        const embed = new URL('https://onedrive.live.com/embed');
        embed.searchParams.set('resid', resid);
        embed.searchParams.set('authkey', authkey);
        const em = parsed.searchParams.get('em');
        if (em) embed.searchParams.set('em', em);
        return {
          kind: 'onedrive',
          embedUrl: embed.toString(),
          originalUrl,
          providerLabel: 'OneDrive',
          embeddable: true,
        };
      }
    }

    return {
      kind: 'onedrive',
      embedUrl: null,
      originalUrl,
      providerLabel: 'OneDrive',
      embeddable: false,
    };
  }

  if (host === 'sharepoint.com' || host.endsWith('.sharepoint.com')) {
    if (pathLower.endsWith('/_layouts/15/embed.aspx')) {
      const hasDocId =
        Boolean(parsed.searchParams.get('UniqueId')) ||
        Boolean(parsed.searchParams.get('id')) ||
        Boolean(parsed.searchParams.get('sourcedoc'));
      if (hasDocId) {
        return {
          kind: 'onedrive',
          embedUrl: originalUrl,
          originalUrl,
          providerLabel: 'SharePoint',
          embeddable: true,
        };
      }
    }

    if (pathLower.endsWith('/_layouts/15/doc.aspx')) {
      const action = parsed.searchParams.get('action')?.toLowerCase();
      if (action === 'embedview') {
        return {
          kind: 'onedrive',
          embedUrl: originalUrl,
          originalUrl,
          providerLabel: 'SharePoint',
          embeddable: true,
        };
      }
      if (parsed.searchParams.has('sourcedoc')) {
        const embed = new URL(parsed.toString());
        embed.searchParams.set('action', 'embedview');
        return {
          kind: 'onedrive',
          embedUrl: embed.toString(),
          originalUrl,
          providerLabel: 'SharePoint',
          embeddable: true,
        };
      }
    }

    return {
      kind: 'onedrive',
      embedUrl: null,
      originalUrl,
      providerLabel: 'SharePoint',
      embeddable: false,
    };
  }

  return null;
}

function resolveYouTubeUrl(parsed: URL, originalUrl: string): ResolvedEmbed | null {
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let videoId: string | null = null;
  const path = parsed.pathname;

  if (host === 'youtu.be') {
    const match = path.match(/^\/([a-zA-Z0-9_-]{6,})(?:\/|$)/);
    if (match) videoId = match[1];
  } else {
    const vParam = parsed.searchParams.get('v');
    if (path === '/watch' && vParam && /^[a-zA-Z0-9_-]{6,}$/.test(vParam)) {
      videoId = vParam;
    } else {
      const pathMatch = path.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{6,})(?:\/|$)/);
      if (pathMatch) videoId = pathMatch[1];
    }
  }

  if (!videoId) return null;

  const startSec =
    parseStartSeconds(parsed.searchParams.get('t')) ??
    parseStartSeconds(parsed.searchParams.get('start'));
  const startSuffix = startSec ? `?start=${startSec}` : '';

  return {
    kind: 'youtube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}${startSuffix}`,
    originalUrl,
    providerLabel: 'YouTube',
    embeddable: true,
  };
}

function resolveVimeoUrl(parsed: URL, originalUrl: string): ResolvedEmbed | null {
  const host = parsed.hostname.toLowerCase();
  if (!VIMEO_HOSTS.has(host)) return null;

  const match = parsed.pathname.match(
    /^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/|$)/
  );
  if (!match) return null;

  return {
    kind: 'vimeo',
    embedUrl: `https://player.vimeo.com/video/${match[1]}?dnt=1`,
    originalUrl,
    providerLabel: 'Vimeo',
    embeddable: true,
  };
}

export function resolveEmbedUrl(rawUrl: string): ResolvedEmbed {
  const trimmed = rawUrl.trim();
  const fallback: ResolvedEmbed = {
    kind: 'external',
    embedUrl: null,
    originalUrl: trimmed,
    providerLabel: 'External Link',
    embeddable: false,
  };

  if (!trimmed) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== 'https:') {
    return fallback;
  }

  const googleResolved = resolveGoogleUrl(parsed, trimmed);
  if (googleResolved) return googleResolved;

  const oneDriveResolved = resolveOneDriveUrl(parsed, trimmed);
  if (oneDriveResolved) return oneDriveResolved;

  const youtubeResolved = resolveYouTubeUrl(parsed, trimmed);
  if (youtubeResolved) return youtubeResolved;

  const vimeoResolved = resolveVimeoUrl(parsed, trimmed);
  if (vimeoResolved) return vimeoResolved;

  const pathLower = parsed.pathname.toLowerCase();

  if (VIDEO_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) {
    return {
      kind: 'direct-video',
      embedUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'Video',
      embeddable: true,
    };
  }

  if (AUDIO_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) {
    return {
      kind: 'direct-audio',
      embedUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'Audio',
      embeddable: true,
    };
  }

  if (pathLower.endsWith('.pdf')) {
    return {
      kind: 'direct-pdf',
      embedUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'PDF Document',
      embeddable: true,
    };
  }

  if (IMAGE_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) {
    return {
      kind: 'direct-image',
      embedUrl: trimmed,
      originalUrl: trimmed,
      providerLabel: 'Image',
      embeddable: true,
    };
  }

  return fallback;
}
