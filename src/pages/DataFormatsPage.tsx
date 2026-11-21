import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, FileJson, Sparkles } from 'lucide-react';
import { SEMESTER_OPTIONS } from '@/types/course';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { EXAMPLE_PROGRESS_BACKUP } from '@/data/exampleProgressBackup';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as Array<
  keyof typeof RESOURCE_BADGE_STYLES
>;

const EXAMPLE_COURSE_JSON = JSON.stringify(EXAMPLE_COURSE_EXPORT, null, 2);
const EXAMPLE_PROGRESS_JSON = JSON.stringify(EXAMPLE_PROGRESS_BACKUP, null, 2);

export const LLM_AUTHORING_PROMPT = `Design a college course roadmap and output ONLY valid JSON (no markdown fences, no commentary) matching the College Course Trees ".course.json" export envelope.

1. Envelope structure:
{
  "format": "college-course-tree",
  "version": 1,
  "exportedAt": "2026-11-21T00:00:00.000Z",
  "course": { ... }
}
Do not include "attachments".

2. CourseTree ("course") fields:
- "slug" (required, string): lowercase kebab-case, regex ^[a-z0-9-]+$ (e.g. "math101-calculus-i").
- "code" (required, string, min 2 chars): course code (e.g. "MATH101").
- "title" (required, string, min 2 chars): course title.
- "department" (required, string, min 2 chars): department name; use "Preparatory" as default if unsure.
- "semester" (optional, string): omit if unscheduled, or use EXACTLY one of:
  ${SEMESTER_OPTIONS.map((s) => `"${s}"`).join(', ')}
- "credits" (optional, positive integer): credit hours.
- "description" (required, non-empty string): concise course overview.
- "chapters" (required, non-empty array of Chapter objects).

3. Chapter fields:
- "id" (required, string): unique across ALL chapters and lessons, prefixed with "<prefix>-" where <prefix> is the lowercase alphanumeric characters of "code" (canonical: "<prefix>-ch<order>-<slugified-title>").
- "order" (required, positive integer): sequential 1, 2, 3, ...
- "title" (required, non-empty string): e.g. "1. Limits & Continuity".
- "weekRange" (optional, string): e.g. "Weeks 1–3".
- "description" (required, non-empty string): chapter summary.
- "notes" (optional, string): study tips or context.
- "prerequisites" (optional, string[]): array of chapter or lesson IDs present in this same course (no self-references).
- "resources" (optional, LessonResource[]): chapter-level study materials.
- "lessons" (required, SubLesson[]): array of lessons, OR an empty array [] for a standalone chapter (a milestone/project chapter tracked directly without sub-lessons).

4. SubLesson fields:
- "id" (required, string): unique across ALL chapters and lessons, prefixed with "<prefix>-" (canonical: "<prefix>-<slugified-title>").
- "title" (required, non-empty string).
- "summary" (required, non-empty string).
- "notes" (optional, string).
- "side" (optional, "left" | "right"): omit to auto-balance or specify layout side.
- "prerequisites" (optional, string[]): chapter or lesson IDs present in this same course (no self-references).
- "resources" (required, LessonResource[]): may be [] or a list of materials.

5. LessonResource fields:
- "title" (required, non-empty string).
- "kind" (required): EXACTLY one of ${RESOURCE_KINDS.map((k) => `"${k}"`).join(' | ')}.
- "url" (required here): valid "https://..." URL. Do NOT include "file" (each resource must have either "url" or "file", never both).

6. Strict rules:
- All chapter and lesson IDs share ONE uniqueness namespace and must start with "<prefix>-".
- Every ID in "prerequisites" must exist in this same course (import re-derives canonical IDs from code/titles and remaps prerequisites within the file automatically).
- Do NOT invent or include any unlisted, extra, or time/duration fields—use ONLY the exact field names listed above.`;

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  return false;
}

interface CopyButtonProps {
  text: string;
  label: string;
}

function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

interface FieldRow {
  field: string;
  type: string;
  required: string;
  details: string;
}

function SchemaTable({ title, rows }: { title: string; rows: FieldRow[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-slate-700">
          <thead className="bg-gray-50 text-gray-600 dark:bg-slate-800/70 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-semibold">Field</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Required</th>
              <th className="px-3 py-2 font-semibold">Rules &amp; Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {rows.map((row) => (
              <tr key={row.field}>
                <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-gray-900 dark:text-slate-100">
                  {row.field}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600 dark:text-slate-300">
                  {row.type}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-slate-300">
                  {row.required}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-slate-300">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataFormatsPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {/* Top Back Navigation & Header */}
        <header className="space-y-4 border-b border-gray-200 pb-6 dark:border-slate-800">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← Back to Catalog
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-200">
                <FileJson className="h-3.5 w-3.5" />
                Data Formats &amp; Authoring Guide
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-slate-100">
                Course &amp; Progress JSON Formats
              </h1>
              <p className="max-w-3xl text-sm text-gray-600 dark:text-slate-300">
                Reference specification for importing and exporting{' '}
                <code className="font-mono text-xs">.course.json</code> course trees, backing up
                personal study progress, and prompting an LLM to generate valid importable courses.
              </p>
            </div>
          </div>

          <nav aria-label="Page sections" className="flex flex-wrap gap-2 pt-1 text-xs">
            {[
              { href: '#overview', label: '1. Overview' },
              { href: '#course-json', label: '2. Course JSON' },
              { href: '#progress-json', label: '3. Progress Backup JSON' },
              { href: '#examples', label: '4. Valid Examples' },
              { href: '#llm-prompt', label: '5. Prompt for an LLM' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        {/* Section 1: Overview */}
        <section
          id="overview"
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">1. Overview</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            College Course Trees uses two distinct JSON formats so syllabi can be shared cleanly
            without mixing in personal study state:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                Course Export JSON (<code className="font-mono text-xs">.course.json</code>)
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                Packages a complete <code className="font-mono">CourseTree</code> (chapters,
                lessons, prerequisites, and material links or optional base64-encoded uploaded
                files) inside a versioned envelope. Used by <strong>Export Course</strong> and{' '}
                <strong>Import Course</strong>. Importing also accepts a bare{' '}
                <code className="font-mono">CourseTree</code> object without the envelope.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                Progress Backup JSON
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                Stores your personal <code className="font-mono">done</code> /{' '}
                <code className="font-mono">learning</code> /{' '}
                <code className="font-mono">skipped</code> statuses keyed by course slug and item
                ID, along with your bookmarked course slugs. Used by{' '}
                <strong>Backup &amp; Restore Progress</strong> on any course page.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Course JSON Format */}
        <section
          id="course-json"
          className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              2. Course JSON Format (<code className="font-mono text-base">.course.json</code>)
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Exporting a course wraps it in a <code className="font-mono text-xs">.course.json</code>{' '}
              envelope. When importing, you may provide either the full envelope or a bare{' '}
              <code className="font-mono text-xs">CourseTree</code> object.
            </p>
          </div>

          <SchemaTable
            title="Export Envelope (CourseExportEnvelope)"
            rows={[
              {
                field: 'format',
                type: '"college-course-tree"',
                required: 'Required (envelope)',
                details: 'Constant format identifier for .course.json exports.',
              },
              {
                field: 'version',
                type: '1',
                required: 'Required (envelope)',
                details: 'Schema version integer (currently 1).',
              },
              {
                field: 'exportedAt',
                type: 'string (ISO-8601)',
                required: 'Required (envelope)',
                details: 'UTC timestamp when the export was generated.',
              },
              {
                field: 'course',
                type: 'CourseTree',
                required: 'Required (envelope)',
                details: 'The full course tree definition.',
              },
              {
                field: 'attachments',
                type: 'Attachment[]',
                required: 'Optional',
                details:
                  'Included when "Include uploaded files" is enabled. Each entry has { id, name, mimeType, sizeBytes, dataBase64 } matching resource.file.id.',
              },
            ]}
          />

          <SchemaTable
            title="CourseTree"
            rows={[
              {
                field: 'slug',
                type: 'string',
                required: 'Required',
                details:
                  'Lowercase kebab-case URL identifier matching ^[a-z0-9-]+$ (import appends -2, -3 if a slug already exists).',
              },
              {
                field: 'code',
                type: 'string',
                required: 'Required',
                details: 'Course code, minimum 2 characters (e.g. "STAT101").',
              },
              {
                field: 'title',
                type: 'string',
                required: 'Required',
                details: 'Human-readable course title, minimum 2 characters.',
              },
              {
                field: 'department',
                type: 'string',
                required: 'Required',
                details:
                  'Department grouping label (min 2 trimmed chars). Defaults to "Preparatory" if omitted/invalid.',
              },
              {
                field: 'semester',
                type: 'SemesterOption',
                required: 'Optional',
                details:
                  'Must be one of the 8 allowed SEMESTER_OPTIONS values below, or omitted for unscheduled.',
              },
              {
                field: 'credits',
                type: 'number (int > 0)',
                required: 'Optional',
                details: 'Positive integer credit hours.',
              },
              {
                field: 'description',
                type: 'string',
                required: 'Required',
                details: 'Non-empty course overview shown in the header and search.',
              },
              {
                field: 'chapters',
                type: 'Chapter[]',
                required: 'Required',
                details: 'At least 1 chapter.',
              },
            ]}
          />

          <SchemaTable
            title="Chapter"
            rows={[
              {
                field: 'id',
                type: 'string',
                required: 'Required',
                details:
                  'Unique item ID starting with "<coursePrefix>-". Canonical form: "<prefix>-ch<order>-<slugified-title>".',
              },
              {
                field: 'order',
                type: 'number (int > 0)',
                required: 'Required',
                details: '1-based display order along the spine (1, 2, 3, ...).',
              },
              {
                field: 'title',
                type: 'string',
                required: 'Required',
                details: 'Non-empty chapter title (e.g. "1. Descriptive Statistics").',
              },
              {
                field: 'weekRange',
                type: 'string',
                required: 'Optional',
                details: 'Schedule hint (e.g. "Weeks 1–3").',
              },
              {
                field: 'description',
                type: 'string',
                required: 'Required',
                details: 'Non-empty chapter summary shown in the Chapter Overview drawer.',
              },
              {
                field: 'notes',
                type: 'string',
                required: 'Optional',
                details: 'Additional study notes displayed in the Notes tab.',
              },
              {
                field: 'prerequisites',
                type: 'string[]',
                required: 'Optional',
                details:
                  'IDs of prerequisite chapters or lessons in the same course. Cannot reference itself.',
              },
              {
                field: 'resources',
                type: 'LessonResource[]',
                required: 'Optional',
                details: 'Chapter-level materials (slides, readings, labs, etc.).',
              },
              {
                field: 'lessons',
                type: 'SubLesson[]',
                required: 'Required',
                details:
                  'Sub-lessons belonging to this chapter. Set lessons: [] to create a standalone chapter.',
              },
            ]}
          />

          <SchemaTable
            title="SubLesson"
            rows={[
              {
                field: 'id',
                type: 'string',
                required: 'Required',
                details:
                  'Unique item ID starting with "<coursePrefix>-". Canonical form: "<prefix>-<slugified-title>".',
              },
              {
                field: 'title',
                type: 'string',
                required: 'Required',
                details: 'Non-empty lesson title.',
              },
              {
                field: 'summary',
                type: 'string',
                required: 'Required',
                details: 'Non-empty lesson summary shown in the Lesson drawer.',
              },
              {
                field: 'notes',
                type: 'string',
                required: 'Optional',
                details: 'Optional detailed notes for the Notes tab.',
              },
              {
                field: 'side',
                type: '"left" | "right"',
                required: 'Optional',
                details: 'Branch side on the tree canvas; auto-balanced when omitted.',
              },
              {
                field: 'prerequisites',
                type: 'string[]',
                required: 'Optional',
                details:
                  'IDs of prerequisite lessons or chapters in the same course. Cannot reference itself.',
              },
              {
                field: 'resources',
                type: 'LessonResource[]',
                required: 'Required',
                details: 'Array of materials (may be [] if none).',
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SchemaTable
              title="LessonResource (URL vs File XOR rule)"
              rows={[
                {
                  field: 'title',
                  type: 'string',
                  required: 'Required',
                  details: 'Display label for the material.',
                },
                {
                  field: 'kind',
                  type: 'ResourceKind',
                  required: 'Required',
                  details: 'One of the 9 ResourceKind tags listed below.',
                },
                {
                  field: 'url',
                  type: 'string (URL)',
                  required: 'XOR with file',
                  details:
                    'Valid external URL (e.g. https://...). Provide EITHER url OR file, never both and never neither.',
                },
                {
                  field: 'file',
                  type: 'StoredFileRef',
                  required: 'XOR with url',
                  details:
                    'Uploaded IndexedDB file reference. When authoring JSON manually or via an LLM, use url and omit file.',
                },
              ]}
            />

            <SchemaTable
              title="StoredFileRef"
              rows={[
                {
                  field: 'id',
                  type: 'string',
                  required: 'Required',
                  details: 'Format "<coursePrefix>-file-<8 hex>", preserved across title edits.',
                },
                {
                  field: 'name',
                  type: 'string',
                  required: 'Required',
                  details: 'Original filename (e.g. "lecture-01.pdf").',
                },
                {
                  field: 'mimeType',
                  type: 'string',
                  required: 'Required',
                  details: 'MIME type string (e.g. "application/pdf").',
                },
                {
                  field: 'sizeBytes',
                  type: 'number (int >= 0)',
                  required: 'Required',
                  details: 'File size in bytes.',
                },
              ]}
            />
          </div>

          {/* Allowed Semester Options & Resource Kinds */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Allowed <code className="font-mono text-xs">semester</code> Values
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-300">
                Choose one of these {SEMESTER_OPTIONS.length} exact strings, or omit{' '}
                <code className="font-mono">semester</code> to leave the course unscheduled:
              </p>
              <ul className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
                {SEMESTER_OPTIONS.map((sem) => (
                  <li
                    key={sem}
                    className="rounded border border-gray-200 bg-white px-2.5 py-1 font-mono text-xs text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {sem}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Allowed <code className="font-mono text-xs">ResourceKind</code> Values
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-300">
                Each <code className="font-mono">LessonResource.kind</code> must be one of these{' '}
                {RESOURCE_KINDS.length} keys:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {RESOURCE_KINDS.map((kind) => {
                  const style = RESOURCE_BADGE_STYLES[kind];
                  return (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.className}`}
                      >
                        {style.label}
                      </span>
                      <code className="font-mono text-gray-700 dark:text-slate-300">{kind}</code>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Standalone Chapters & ID Rules */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Standalone Chapters (<code className="font-mono text-xs">lessons: []</code>)
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                A chapter with an empty <code className="font-mono">lessons: []</code> array acts
                as a standalone chapter (great for capstones, exams, or short modules). It supports{' '}
                <code className="font-mono">notes</code>,{' '}
                <code className="font-mono">prerequisites</code>, and{' '}
                <code className="font-mono">resources</code>, and is directly trackable as 1 item
                in both the tree canvas and checklist view.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                ID Prefix, Uniqueness &amp; Re-keying Rules
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                <li>
                  <code className="font-mono">coursePrefix</code> is the lowercase alphanumeric
                  characters of <code className="font-mono">code</code> (e.g.{' '}
                  <code className="font-mono">STAT101</code> →{' '}
                  <code className="font-mono">stat101</code>).
                </li>
                <li>
                  All chapter and lesson <code className="font-mono">id</code> values share{' '}
                  <strong>one uniqueness namespace</strong> and must start with{' '}
                  <code className="font-mono">{`<coursePrefix>-`}</code>.
                </li>
                <li>
                  <strong>Import behavior:</strong> importing automatically re-derives canonical
                  chapter/lesson IDs from <code className="font-mono">code</code> and titles while
                  remapping <code className="font-mono">prerequisites</code> within the same file—so
                  prerequisites only need to reference IDs present in that file.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Progress Backup JSON Format */}
        <section
          id="progress-json"
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
            3. Progress Backup JSON Format
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Exported from <strong>Backup &amp; Restore Progress</strong> on any course page. Validated
            strictly by <code className="font-mono text-xs">ProgressStateSchema</code>.
          </p>

          <SchemaTable
            title="ProgressState"
            rows={[
              {
                field: 'version',
                type: '1',
                required: 'Required',
                details: 'Must be literal integer 1.',
              },
              {
                field: 'statuses',
                type: 'Record<courseSlug, Record<itemId, Status>>',
                required: 'Required',
                details:
                  'Status is "todo" | "learning" | "done" | "skipped". itemId can be either a lesson ID or a standalone chapter ID.',
              },
              {
                field: 'bookmarks',
                type: 'string[]',
                required: 'Required',
                details: 'Array of bookmarked course slugs.',
              },
            ]}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <strong>How skipped items affect progress:</strong> Marking an item as{' '}
            <code className="font-mono">skipped</code> reduces the required denominator (
            <code className="font-mono">required = total - skipped</code>). For example, skipping 1
            of 4 items changes the chapter progress fraction from <code className="font-mono">0/4</code>{' '}
            to <code className="font-mono">0/3</code>.
          </div>
        </section>

        {/* Section 4: Full Valid Examples */}
        <section
          id="examples"
          className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              4. Full Valid Examples
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Both examples below pass strict schema validation and can be imported directly into the
              app.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Course Export Example (<code className="font-mono text-xs">stat101.course.json</code>)
              </h3>
              <CopyButton text={EXAMPLE_COURSE_JSON} label="Copy Course JSON" />
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400">
              Demonstrates 3 chapters (including a standalone Chapter 3 with{' '}
              <code className="font-mono">lessons: []</code>), cross-chapter prerequisites
              (lesson → chapter and chapter → lesson), <code className="font-mono">Preparatory</code>{' '}
              department, <code className="font-mono">Year 1 - First Semester</code>, and multiple{' '}
              <code className="font-mono">https://</code> resource kinds.
            </p>
            <pre className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 dark:border-slate-700 dark:bg-slate-950">
              <code>{EXAMPLE_COURSE_JSON}</code>
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Progress Backup Example (<code className="font-mono text-xs">college-course-progress.json</code>)
              </h3>
              <CopyButton text={EXAMPLE_PROGRESS_JSON} label="Copy Progress JSON" />
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400">
              Demonstrates <code className="font-mono">done</code>,{' '}
              <code className="font-mono">learning</code>, and{' '}
              <code className="font-mono">skipped</code> statuses across both lesson IDs and the
              standalone chapter ID <code className="font-mono">stat101-ch3-applied-data-lab-capstone</code>.
            </p>
            <pre className="max-h-80 overflow-auto rounded-lg border border-gray-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 dark:border-slate-700 dark:bg-slate-950">
              <code>{EXAMPLE_PROGRESS_JSON}</code>
            </pre>
          </div>
        </section>

        {/* Section 5: Prompt for an LLM */}
        <section
          id="llm-prompt"
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-slate-100">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                5. Prompt for an LLM
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Paste this prompt into any LLM alongside your syllabus or topic list to generate a
                valid, directly importable <code className="font-mono text-xs">.course.json</code>.
              </p>
            </div>
            <CopyButton text={LLM_AUTHORING_PROMPT} label="Copy LLM Prompt" />
          </div>

          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-700 dark:bg-slate-950">
            <code>{LLM_AUTHORING_PROMPT}</code>
          </pre>
        </section>
      </div>
    </main>
  );
}
