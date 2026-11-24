import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MaterialViewerModal } from '@/components/viewer/MaterialViewerModal';
import * as fileStore from '@/lib/fileStore';
import type { StoredFileRecord } from '@/lib/storage/types';
import type { LessonResource } from '@/types/course';

describe('MaterialViewerModal', () => {
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let clipboardWriteSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const ids = await fileStore.listFileIds();
    await Promise.all(ids.map((id) => fileStore.deleteFile(id)));

    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    let count = 0;
    createObjectURLSpy = vi.fn(() => `blob:viewer-${++count}`);
    revokeObjectURLSpy = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLSpy,
    });

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteSpy },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: origCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: origRevokeObjectURL,
    });
  });

  it('returns null when closed or resource is null, and dismisses via Escape, backdrop, and Close button', () => {
    const onClose = vi.fn();
    const resource: LessonResource = {
      title: 'Syllabus Link',
      kind: 'document',
      url: 'https://example.com/syllabus',
    };

    const { rerender } = render(
      <MaterialViewerModal isOpen={false} resource={resource} onClose={onClose} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<MaterialViewerModal isOpen resource={null} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<MaterialViewerModal isOpen resource={resource} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Syllabus Link' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders uploaded PDF and revokes blob object URL on close and unmount', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.4');
    await fileStore.putFile(
      'cs101-file-pdf1',
      new Blob([pdfBytes], { type: 'application/pdf' }),
      'notes.pdf',
      'application/pdf'
    );

    const resource: LessonResource = {
      title: 'Lecture Notes PDF',
      kind: 'document',
      file: {
        id: 'cs101-file-pdf1',
        name: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
      },
    };

    const { rerender, unmount } = render(
      <MaterialViewerModal isOpen resource={resource} onClose={vi.fn()} />
    );

    const iframe = await screen.findByTitle('Lecture Notes PDF');
    expect(iframe).toHaveAttribute('src', 'blob:viewer-1');
    expect(screen.getByRole('link', { name: /Open in new tab/i })).toHaveAttribute(
      'href',
      'blob:viewer-1'
    );

    rerender(<MaterialViewerModal isOpen={false} resource={resource} onClose={vi.fn()} />);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:viewer-1');

    rerender(<MaterialViewerModal isOpen resource={resource} onClose={vi.fn()} />);
    await screen.findByTitle('Lecture Notes PDF');
    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:viewer-2');
  });

  it('renders uploaded video with MIME fallback, playback speeds, and guarded keyboard shortcuts', async () => {
    const movBytes = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]);
    await fileStore.putFile(
      'cs101-file-vid1',
      new Blob([movBytes]),
      'lecture.mov',
      ''
    );

    const resource: LessonResource = {
      title: 'Recorded Lecture',
      kind: 'video',
      file: {
        id: 'cs101-file-vid1',
        name: 'lecture.mov',
        mimeType: '',
        sizeBytes: movBytes.byteLength,
      },
    };

    render(<MaterialViewerModal isOpen resource={resource} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(document.querySelector('video')).not.toBeNull();
    });
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toHaveAttribute('src', 'blob:viewer-1');
    expect(createObjectURLSpy.mock.calls[0][0].type).toBe('video/quicktime');

    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {});
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
    Object.defineProperty(video, 'paused', { configurable: true, value: true });

    // Speed buttons
    const speed15 = screen.getByRole('button', { name: '1.5x' });
    fireEvent.click(speed15);
    expect(speed15).toHaveAttribute('aria-pressed', 'true');
    expect(video.playbackRate).toBe(1.5);

    // Space plays when target is not a button
    fireEvent.keyDown(window, { key: ' ' });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Space is ignored when focused on a button
    fireEvent.keyDown(speed15, { key: ' ' });
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy).not.toHaveBeenCalled();

    // ArrowRight / ArrowLeft seek +/- 5s
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(5);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(video.currentTime).toBe(0);

    // F toggles fullscreen CSS fallback
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
  });

  it('renders uploaded audio and zoomable images', async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    await fileStore.putFile(
      'cs101-file-aud1',
      new Blob([audioBytes], { type: 'audio/mp4' }),
      'podcast.m4a',
      'audio/mp4'
    );

    const audioResource: LessonResource = {
      title: 'Audio Episode',
      kind: 'video',
      file: {
        id: 'cs101-file-aud1',
        name: 'podcast.m4a',
        mimeType: 'audio/mp4',
        sizeBytes: audioBytes.byteLength,
      },
    };

    const { rerender } = render(
      <MaterialViewerModal isOpen resource={audioResource} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:viewer-1');
    });

    const imgBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]);
    await fileStore.putFile(
      'cs101-file-img1',
      new Blob([imgBytes], { type: 'image/png' }),
      'architecture.png',
      'image/png'
    );

    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Architecture Diagram',
          kind: 'slides',
          file: {
            id: 'cs101-file-img1',
            name: 'architecture.png',
            mimeType: 'image/png',
            sizeBytes: imgBytes.byteLength,
          },
        }}
        onClose={vi.fn()}
      />
    );

    const img = await screen.findByAltText('Architecture Diagram');
    expect(img).toHaveAttribute('src', 'blob:viewer-2');
    expect(screen.getByTestId('image-zoom-readout')).toHaveTextContent('Fit');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('image-zoom-readout')).toHaveTextContent('125%');
    expect(img).toHaveStyle({ width: '125%' });

    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(screen.getByTestId('image-zoom-readout')).toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByTestId('image-zoom-readout')).toHaveTextContent('75%');

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByTestId('image-zoom-readout')).toHaveTextContent('Fit');
  });

  it('renders UTF-8 text/code via FileReader fallback with line numbers, wrap toggle, and copy', async () => {
    const code = 'def hello():\n    return "<script>safe</script>"\nprint(hello())';
    const blob = new Blob([code], { type: 'text/x-python' });
    await fileStore.putFile('cs101-file-py1', blob, 'hello.py', 'text/x-python');

    render(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Python Starter',
          kind: 'lab',
          file: {
            id: 'cs101-file-py1',
            name: 'hello.py',
            mimeType: 'text/x-python',
            sizeBytes: blob.size,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('3 lines')).toBeInTheDocument();
    expect(screen.getByText('def hello():')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(createObjectURLSpy.mock.calls[0][0].type).toBe('text/plain;charset=utf-8');

    const wrapBtn = screen.getByRole('button', { name: 'Wrap' });
    expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(wrapBtn);
    expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(clipboardWriteSpy).toHaveBeenCalledWith(code);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
  });

  it('shows download card for unsupported binaries and blocked .svg without inline preview', async () => {
    const svgBytes = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    await fileStore.putFile(
      'cs101-file-svg1',
      new Blob([svgBytes], { type: 'image/svg+xml' }),
      'diagram.svg',
      'image/svg+xml'
    );

    const { rerender } = render(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Vector File',
          kind: 'document',
          file: {
            id: 'cs101-file-svg1',
            name: 'diagram.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: svgBytes.byteLength,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/In-app preview is not available for this file format/i)
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();

    const pptxBytes = new Uint8Array([80, 75, 3, 4]);
    await fileStore.putFile(
      'cs101-file-ppt1',
      new Blob([pptxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );

    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Deck',
          kind: 'slides',
          file: {
            id: 'cs101-file-ppt1',
            name: 'slides.pptx',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            sizeBytes: pptxBytes.byteLength,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('slides.pptx')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it('handles missing files and prevents leaked URLs during async getFile race conditions', async () => {
    let resolveDeferred!: (rec: StoredFileRecord | undefined) => void;
    const deferred = new Promise<StoredFileRecord | undefined>((res) => {
      resolveDeferred = res;
    });
    const getFileSpy = vi.spyOn(fileStore, 'getFile').mockReturnValueOnce(deferred);

    const resourceA: LessonResource = {
      title: 'Slow PDF',
      kind: 'document',
      file: {
        id: 'cs101-file-slow',
        name: 'slow.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      },
    };

    const { rerender } = render(
      <MaterialViewerModal isOpen resource={resourceA} onClose={vi.fn()} />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading file...');

    // Close before deferred resolves
    rerender(<MaterialViewerModal isOpen={false} resource={resourceA} onClose={vi.fn()} />);
    resolveDeferred({
      id: 'cs101-file-slow',
      name: 'slow.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      blob: new Blob(['%PDF'], { type: 'application/pdf' }),
      createdAt: Date.now(),
    });
    await Promise.resolve();
    expect(createObjectURLSpy).not.toHaveBeenCalled();

    // Missing file renders alert
    getFileSpy.mockRestore();
    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Missing PDF',
          kind: 'document',
          file: {
            id: 'cs101-file-missing',
            name: 'missing.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 10,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not be found in local browser storage/i
    );
  });

  it('renders embeddable links, fallback cards for non-embeddable links, and blocks unsafe URLs', () => {
    const { rerender } = render(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Lecture Video',
          kind: 'video',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }}
        onClose={vi.fn()}
      />
    );

    const ytIframe = screen.getByTitle('Lecture Video');
    expect(ytIframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    fireEvent.load(ytIframe);
    expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument();

    // Non-embeddable OneDrive share link
    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'OneDrive Handout',
          kind: 'document',
          url: 'https://1drv.ms/w/s!AbCdEf',
        }}
        onClose={vi.fn()}
      />
    );
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/cannot be embedded directly/i)).toBeInTheDocument();
    const openLinks = screen.getAllByRole('link', { name: /Open in new tab/i });
    expect(openLinks[0]).toHaveAttribute('rel', 'noopener noreferrer');

    // General external webpage renders inside a sandboxed iframe with visible fallback notice
    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Notion Notes',
          kind: 'document',
          url: 'https://www.notion.so/course-notes-123',
        }}
        onClose={vi.fn()}
      />
    );
    const extIframe = document.querySelector('iframe');
    expect(extIframe).not.toBeNull();
    expect(extIframe).toHaveAttribute('src', 'https://www.notion.so/course-notes-123');
    expect(extIframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-popups'
    );
    expect(extIframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.queryByTestId('external-embed-fallback-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('external-embed-header-warning')).toHaveTextContent(
      /Some websites block embedding/i
    );

    // Unsafe javascript: URL
    rerender(
      <MaterialViewerModal
        isOpen
        resource={{
          title: 'Bad Link',
          kind: 'document',
          url: 'javascript:alert(1)',
        }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsafe or unsupported URL/i);
    expect(document.querySelector('a')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
