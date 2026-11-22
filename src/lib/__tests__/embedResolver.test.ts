import { describe, expect, it } from 'vitest';
import { resolveEmbedUrl } from '@/lib/embedResolver';

describe('embedResolver', () => {
  it('resolves Google Drive file, open, and uc links and marks Drive folders non-embeddable', () => {
    expect(
      resolveEmbedUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing')
    ).toEqual({
      kind: 'google-drive',
      embedUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview',
      originalUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing',
      providerLabel: 'Google Drive',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://drive.google.com/open?id=file_12345&resourcekey=0-abc')
    ).toEqual({
      kind: 'google-drive',
      embedUrl: 'https://drive.google.com/file/d/file_12345/preview?resourcekey=0-abc',
      originalUrl: 'https://drive.google.com/open?id=file_12345&resourcekey=0-abc',
      providerLabel: 'Google Drive',
      embeddable: true,
    });

    expect(resolveEmbedUrl('https://drive.google.com/uc?id=uc_file_99')).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://drive.google.com/file/d/uc_file_99/preview',
      embeddable: true,
    });

    expect(resolveEmbedUrl('https://drive.google.com/drive/folders/1FolderId')).toEqual({
      kind: 'google-drive',
      embedUrl: null,
      originalUrl: 'https://drive.google.com/drive/folders/1FolderId',
      providerLabel: 'Google Drive',
      embeddable: false,
    });
  });

  it('resolves Google Docs, Slides, and Sheets standard and published URLs', () => {
    expect(
      resolveEmbedUrl('https://docs.google.com/document/d/docId_1/edit?usp=sharing')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/document/d/docId_1/preview',
      providerLabel: 'Google Docs',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/document/d/e/2PACX-doc/pub')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/document/d/e/2PACX-doc/pub?embedded=true',
      providerLabel: 'Google Docs',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/presentation/d/slides_42/edit#slide=id.p')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/presentation/d/slides_42/embed',
      providerLabel: 'Google Slides',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/presentation/d/e/2PACX-slides/pub')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/presentation/d/e/2PACX-slides/embed',
      providerLabel: 'Google Slides',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/spreadsheets/d/sheet_99/edit#gid=0')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/spreadsheets/d/sheet_99/preview',
      providerLabel: 'Google Sheets',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/spreadsheets/d/e/2PACX-sheet/pubhtml')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl:
        'https://docs.google.com/spreadsheets/d/e/2PACX-sheet/pubhtml?widget=true&headers=false',
      providerLabel: 'Google Sheets',
      embeddable: true,
    });
  });

  it('resolves embeddable OneDrive & SharePoint links and falls back cleanly on unsupported share links', () => {
    expect(resolveEmbedUrl('https://1drv.ms/w/s!AbCdEf')).toEqual({
      kind: 'onedrive',
      embedUrl: null,
      originalUrl: 'https://1drv.ms/w/s!AbCdEf',
      providerLabel: 'OneDrive',
      embeddable: false,
    });

    expect(
      resolveEmbedUrl('https://onedrive.live.com/embed?cid=123&resid=123%21456&authkey=!XYZ')
    ).toMatchObject({
      kind: 'onedrive',
      embedUrl: 'https://onedrive.live.com/embed?cid=123&resid=123%21456&authkey=!XYZ',
      providerLabel: 'OneDrive',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://onedrive.live.com/redir?resid=ABC!123&authkey=!KEY&em=2')
    ).toMatchObject({
      kind: 'onedrive',
      embedUrl: 'https://onedrive.live.com/embed?resid=ABC%21123&authkey=%21KEY&em=2',
      providerLabel: 'OneDrive',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl(
        'https://contoso.sharepoint.com/sites/cs/_layouts/15/Doc.aspx?sourcedoc=%7B1234%7D&file=notes.docx'
      )
    ).toEqual({
      kind: 'onedrive',
      embedUrl:
        'https://contoso.sharepoint.com/sites/cs/_layouts/15/Doc.aspx?sourcedoc=%7B1234%7D&file=notes.docx&action=embedview',
      originalUrl:
        'https://contoso.sharepoint.com/sites/cs/_layouts/15/Doc.aspx?sourcedoc=%7B1234%7D&file=notes.docx',
      providerLabel: 'SharePoint',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl(
        'https://contoso.sharepoint.com/:w:/s/cs/EW1234567890'
      )
    ).toEqual({
      kind: 'onedrive',
      embedUrl: null,
      originalUrl: 'https://contoso.sharepoint.com/:w:/s/cs/EW1234567890',
      providerLabel: 'SharePoint',
      embeddable: false,
    });
  });

  it('resolves YouTube (with optional timestamps) and Vimeo URLs', () => {
    expect(resolveEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90',
      originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s',
      providerLabel: 'YouTube',
      embeddable: true,
    });

    expect(resolveEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=45')).toMatchObject({
      kind: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=45',
      embeddable: true,
    });

    expect(resolveEmbedUrl('https://www.youtube.com/playlist?list=PL12345')).toMatchObject({
      kind: 'external',
      embedUrl: null,
      embeddable: false,
    });

    expect(resolveEmbedUrl('https://vimeo.com/channels/staffpicks/12345678')).toEqual({
      kind: 'vimeo',
      embedUrl: 'https://player.vimeo.com/video/12345678?dnt=1',
      originalUrl: 'https://vimeo.com/channels/staffpicks/12345678',
      providerLabel: 'Vimeo',
      embeddable: true,
    });
  });

  it('resolves direct media extensions, treats Notion as external, and blocks unsafe/non-https protocols', () => {
    expect(resolveEmbedUrl('https://cdn.example.edu/lecture.mp4')).toMatchObject({
      kind: 'direct-video',
      embeddable: true,
    });
    expect(resolveEmbedUrl('https://cdn.example.edu/podcast.m4a')).toMatchObject({
      kind: 'direct-audio',
      embeddable: true,
    });
    expect(resolveEmbedUrl('https://cdn.example.edu/syllabus.pdf')).toMatchObject({
      kind: 'direct-pdf',
      embeddable: true,
    });
    expect(resolveEmbedUrl('https://cdn.example.edu/diagram.webp')).toMatchObject({
      kind: 'direct-image',
      embeddable: true,
    });

    expect(resolveEmbedUrl('https://www.notion.so/my-course-notes-1234')).toMatchObject({
      kind: 'external',
      embedUrl: null,
      embeddable: false,
    });

    for (const unsafe of [
      'http://youtube.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'not a valid url',
      '',
    ]) {
      expect(resolveEmbedUrl(unsafe)).toMatchObject({
        kind: 'external',
        embedUrl: null,
        embeddable: false,
      });
    }
  });

  it('hardens Google /d/e/ lookahead, multi-account /u/N/ paths, and fallback provider labels', () => {
    expect(
      resolveEmbedUrl('https://docs.google.com/spreadsheets/d/e/2PACX-sheet/pub?output=csv')
    ).toEqual({
      kind: 'google-drive',
      embedUrl: null,
      originalUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-sheet/pub?output=csv',
      providerLabel: 'Google Sheets',
      embeddable: false,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/document/d/e/2PACX-doc/edit')
    ).toEqual({
      kind: 'google-drive',
      embedUrl: null,
      originalUrl: 'https://docs.google.com/document/d/e/2PACX-doc/edit',
      providerLabel: 'Google Docs',
      embeddable: false,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/presentation/d/e/2PACX-slides/htmlpresent')
    ).toEqual({
      kind: 'google-drive',
      embedUrl: null,
      originalUrl: 'https://docs.google.com/presentation/d/e/2PACX-slides/htmlpresent',
      providerLabel: 'Google Slides',
      embeddable: false,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/document/d/e12345_doc/edit')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/document/d/e12345_doc/preview',
      providerLabel: 'Google Docs',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/document/u/0/d/docId_1/edit')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/document/d/docId_1/preview',
      providerLabel: 'Google Docs',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/presentation/u/1/d/slides_42/edit')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://docs.google.com/presentation/d/slides_42/embed',
      providerLabel: 'Google Slides',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://docs.google.com/spreadsheets/u/2/d/e/2PACX-sheet/pubhtml')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl:
        'https://docs.google.com/spreadsheets/d/e/2PACX-sheet/pubhtml?widget=true&headers=false',
      providerLabel: 'Google Sheets',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://drive.google.com/file/u/0/d/1AbCd/view')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://drive.google.com/file/d/1AbCd/preview',
      providerLabel: 'Google Drive',
      embeddable: true,
    });

    expect(
      resolveEmbedUrl('https://drive.google.com/u/0/open?id=file_123')
    ).toMatchObject({
      kind: 'google-drive',
      embedUrl: 'https://drive.google.com/file/d/file_123/preview',
      providerLabel: 'Google Drive',
      embeddable: true,
    });
  });
});
