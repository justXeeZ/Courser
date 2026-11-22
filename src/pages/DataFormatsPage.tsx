import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, FileJson } from 'lucide-react';
import { BRAND } from '@/config/brand';
import {
  ASSESSMENT_EXPORT_FORMAT,
  ASSESSMENT_EXPORT_VERSION,
  type AssessmentExportEnvelope,
} from '@/lib/assessmentExchange';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { EXAMPLE_PROGRESS_BACKUP } from '@/data/exampleProgressBackup';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as Array<
  keyof typeof RESOURCE_BADGE_STYLES
>;

export const EXAMPLE_ASSESSMENT_EXPORT: AssessmentExportEnvelope = {
  format: ASSESSMENT_EXPORT_FORMAT,
  version: ASSESSMENT_EXPORT_VERSION,
  exportedAt: '2026-11-21T00:00:00.000Z',
  title: 'Midterm Practice: Asymptotics & Recurrences',
  kind: 'exam',
  assessment: {
    mode: 'exam',
    instructions:
      'Solve each question carefully. Inline math uses $...$ and display equations use $$T(n) = 2T(n/2) + n$$.',
    timeLimitMinutes: 20,
    passingScorePercent: 70,
    shuffleQuestions: false,
    questions: [
      {
        id: 'q1-master-theorem',
        type: 'mcq',
        header: {
          text: 'What is the tight asymptotic bound for $$T(n) = 2T(n/2) + n$$?',
        },
        options: ['$\\Theta(n)$', '$\\Theta(n \\log n)$', '$\\Theta(n^2)$', '$\\Theta(\\log n)$'],
        correctIndices: [1],
        points: 2,
        explanation:
          'By Master Theorem Case 2 with $a = 2, b = 2, f(n) = \\Theta(n^{\\log_2 2})$, $T(n) = \\Theta(n \\log n)$.',
      },
      {
        id: 'q2-upper-bounds',
        type: 'multi-select',
        header: {
          text: 'Select every function $g(n)$ satisfying $g(n) = O(n \\log n)$.',
        },
        options: ['$n$', '$n \\log n$', '$n^2$', '$\\log n$'],
        correctIndices: [0, 1, 3],
        points: 2,
        explanation:
          '$n$, $\\log n$, and $n \\log n$ are all bounded above by $c \\cdot n \\log n$ for large $n$.',
      },
      {
        id: 'q3-theta-equivalence',
        type: 'true-false',
        header: {
          text: 'If $f(n) = \\Theta(g(n))$, then both $f(n) = O(g(n))$ and $f(n) = \\Omega(g(n))$ hold.',
        },
        options: ['True', 'False'],
        correctIndices: [0],
        points: 1,
        explanation: 'Big-Theta characterizes both an asymptotic upper and lower bound.',
      },
      {
        id: 'q4-recurrence-degree',
        type: 'short-answer',
        header: {
          text: 'For $T(n) = 4T(n/2) + n$, what integer exponent $c$ gives $T(n) = \\Theta(n^c)$?',
        },
        acceptedAnswers: ['2'],
        caseSensitive: false,
        points: 1,
        explanation: 'Since $\\log_2 4 = 2$, Case 1 yields $\\Theta(n^2)$.',
      },
    ],
  },
};

const EXAMPLE_COURSE_JSON = JSON.stringify(EXAMPLE_COURSE_EXPORT, null, 2);
const EXAMPLE_ASSESSMENT_JSON = JSON.stringify(EXAMPLE_ASSESSMENT_EXPORT, null, 2);
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
- "year" (optional, integer 1–10): study year; omit if unscheduled.
- "semester" (optional, 1 | 2): 1 for 1st Semester, 2 for 2nd Semester; omit if unscheduled.
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
- "lessons" (required, SubLesson[]): array of lessons, OR an empty array [] for a single-unit milestone chapter tracked directly without sub-lessons.

4. SubLesson fields:
- "id" (required, string): unique across ALL chapters and lessons, prefixed with "<prefix>-" (canonical: "<prefix>-ch<chapterOrder>-l<lessonOrder>-<slugified-title>").
- "title" (required, non-empty string).
- "summary" (required, non-empty string).
- "notes" (optional, string).
- "side" (optional, "left" | "right"): omit to auto-balance or specify layout side.
- "prerequisites" (optional, string[]): chapter or lesson IDs present in this same course (no self-references).
- "resources" (required, LessonResource[]): may be [] or a list of materials.

5. LessonResource fields (3-way XOR payload):
- "title" (required, non-empty string).
- "kind" (required): EXACTLY one of ${RESOURCE_KINDS.map((k) => `"${k}"`).join(' | ')}.
- "recommended" (optional, boolean): true to pin to the top of the materials list.
- Provide EXACTLY ONE of "url" OR "assessment" (do NOT include "file"):
  - "url": valid "https://..." URL.
  - "assessment": interactive exam or assignment object:
    {
      "mode": "exam" | "assignment",
      "instructions": "optional string (supports KaTeX $...$ and $$...$$)",
      "timeLimitMinutes": 20, // optional positive int (exam mode)
      "passingScorePercent": 70, // optional int 0..100
      "shuffleQuestions": false, // optional boolean
      "questions": [
        {
          "id": "unique-q-id",
          "type": "mcq" | "multi-select" | "true-false" | "short-answer",
          "header": { "text": "Question prompt with optional KaTeX $...$", "imageUrl": "https://... (optional)" },
          "options": ["Choice A", "Choice B"], // required for mcq (min 2), multi-select (min 2), optional ["True","False"] for true-false
          "correctIndices": [0], // required for mcq (exact length 1), multi-select (min 1), true-false (exact length 1, 0 or 1)
          "acceptedAnswers": ["ans"], // required for short-answer (min 1 non-empty string)
          "caseSensitive": false, // optional boolean for short-answer
          "points": 1, // optional positive number
          "hint": "optional hint for assignment mode",
          "explanation": "optional post-check/review explanation"
        }
      ]
    }

6. LaTeX & Strict rules:
- Use KaTeX math ($...$, $$...$$, \\\\(...\\\\), \\\\[...\\\\]) in assessment instructions, question headers, options, hints, and explanations. Always double-escape backslashes inside JSON strings (e.g. "\\\\frac{a}{b}", "\\\\Theta(n \\\\log n)").
- All chapter and lesson IDs share ONE uniqueness namespace and must start with "<prefix>-".
- Every ID in "prerequisites" must exist in this same course (import re-derives canonical IDs from code/titles and remaps prerequisites within the file automatically).
- Do NOT invent or include any unlisted, extra, or time/duration fields—use ONLY the exact field names listed above.`;

export const LLM_EXAM_PROMPT = `Design an interactive exam or assignment and output ONLY valid JSON (no markdown fences, no commentary) matching the ".assessment.json" export envelope.

1. Envelope structure:
{
  "format": "college-assessment",
  "version": 1,
  "exportedAt": "2026-11-21T00:00:00.000Z",
  "title": "Descriptive Exam or Assignment Title",
  "kind": "exam", // "exam" | "assignment"
  "assessment": {
    "mode": "exam", // "exam" | "assignment"
    "instructions": "Optional instructions supporting KaTeX $...$ and $$...$$.",
    "timeLimitMinutes": 20, // optional positive integer (1..300)
    "passingScorePercent": 70, // optional integer (0..100)
    "shuffleQuestions": false, // optional boolean
    "questions": [ ... ] // required, at least 1 question
  }
}
Do not include "attachments" or "imageFile".

2. AssessmentQuestion fields (each question "id" must be unique):
- "id" (required, non-empty string): e.g. "q1-limits".
- "type" (required): "mcq" | "multi-select" | "true-false" | "short-answer".
- "header" (required): { "text": "Question prompt", "imageUrl": "https://... (optional)" } — at least one of "text" or "imageUrl" must be non-empty.
- Type-specific rules:
  - "mcq": "options" (min 2 non-empty strings), "correctIndices" (array of EXACTLY 1 valid index).
  - "multi-select": "options" (min 2 non-empty strings), "correctIndices" (array of 1+ unique valid indices).
  - "true-false": "options" (optional, defaults to ["True", "False"]), "correctIndices" ([0] or [1]).
  - "short-answer": "acceptedAnswers" (array of 1+ non-empty strings), optional "caseSensitive" (boolean, default false).
- Optional fields on all types: "points" (positive number, default 1), "hint" (helpful nudge for Assignment mode), "explanation" (solution walkthrough shown after checking/submitting).

3. KaTeX LaTeX Math & JSON Escaping:
- Inline math: "$...$" or "\\\\(...\\\\)". Display math: "$$...$$" or "\\\\[...\\\\]".
- Escaped dollar signs ("\\\\$") and currency amounts ("$50") stay plain text.
- CRITICAL: Double-escape every LaTeX backslash in JSON strings, e.g. "$\\\\Theta(n \\\\log n)$", "$$T(n) = 2T(n/2) + n$$", "$\\\\frac{d}{dx} x^2 = 2x$".
- Include a balanced mix of "mcq", "multi-select", "true-false", and "short-answer" questions.`;

const TOC_ITEMS = [
  { href: '#overview', label: '1. Overview' },
  { href: '#course-json', label: '2. Course JSON Format' },
  { href: '#assessment-json', label: '3. Interactive Exams & Assignments JSON' },
  { href: '#progress-json', label: '4. Progress Backup JSON Format' },
  { href: '#examples', label: '5. Full Valid Examples' },
  { href: '#llm-prompt', label: '6. Prompts for an LLM' },
] as const;

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
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
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
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/80">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-700/80">
          <thead className="bg-slate-50 text-slate-700 dark:bg-[#1b2436] dark:text-slate-200">
            <tr>
              <th className="px-3 py-2 font-semibold">Field</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Required</th>
              <th className="px-3 py-2 font-semibold">Rules &amp; Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-[#121926]">
            {rows.map((row) => (
              <tr key={row.field}>
                <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {row.field}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                  {row.type}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
                  {row.required}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.details}</td>
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
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {/* Top Back Navigation & Header */}
        <header className="space-y-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← Back to Catalog
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                <FileJson className="h-3.5 w-3.5" />
                Data Formats &amp; Authoring Guide
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
                Course &amp; Progress JSON Formats
              </h1>
               <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Reference specification for importing and exporting{' '}
                <code className="font-mono text-xs">.course.json</code> course trees,{' '}
                <code className="font-mono text-xs">.assessment.json</code> interactive exams and
                assignments with KaTeX LaTeX, backing up personal study progress, and prompting an LLM.
              </p>
            </div>
          </div>

          {/* Mobile / Tablet Vertical TOC Card */}
          <nav
            aria-label="On this page"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:hidden dark:border-slate-700/80 dark:bg-[#121926]"
          >
            <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              On this page
            </h2>
            <ol className="flex flex-col gap-1 text-sm">
              {TOC_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-md px-2.5 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#1b2436] dark:hover:text-slate-100"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <div className="lg:flex lg:items-start lg:gap-8">
          {/* Desktop Sticky Sidebar Table of Contents */}
          <aside className="hidden lg:block lg:w-64 lg:shrink-0">
            <nav
              aria-label="Table of contents"
              className="sticky top-8 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <h2 className="mb-3 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Table of Contents
              </h2>
              <ol className="flex flex-col gap-1 text-xs">
                {TOC_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block rounded-md px-2.5 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#1b2436] dark:hover:text-slate-100"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 flex-1 space-y-8">
            {/* Section 1: Overview */}
            <section
              id="overview"
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">1. Overview</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {BRAND.name} uses three distinct JSON formats so syllabi, portable interactive
                assessments, and personal study state stay clean and portable:
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Course Export JSON (<code className="font-mono text-xs">.course.json</code>)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Packages a complete <code className="font-mono">CourseTree</code> (chapters,
                    lessons, prerequisites, material links, embedded interactive assessments, or
                    optional base64-encoded uploaded files) inside a versioned envelope. Used by{' '}
                    <strong>Export Course</strong> and <strong>Import Course</strong>.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Assessment JSON (<code className="font-mono text-xs">.assessment.json</code>)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Packages an interactive exam or assignment (
                    <code className="font-mono">AssessmentData</code> with KaTeX math and optional
                    header image attachments) for importing or exporting directly inside any
                    material row or the visual builder.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Progress Backup JSON
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Stores your personal <code className="font-mono">done</code> /{' '}
                    <code className="font-mono">learning</code> /{' '}
                    <code className="font-mono">skipped</code> statuses, bookmarked course slugs,
                    and <code className="font-mono">assessmentScores</code>. Used by{' '}
                    <strong>Backup Progress</strong> on any course page.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Course JSON Format */}
            <section
              id="course-json"
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  2. Course JSON Format (<code className="font-mono text-base">.course.json</code>)
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Exporting a course wraps it in a{' '}
                  <code className="font-mono text-xs">.course.json</code> envelope. When importing,
                  you may provide either the full envelope or a bare{' '}
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
                      'Included when "Include uploaded files" is enabled. Each entry has { id, name, mimeType, sizeBytes, dataBase64 } matching resource.file.id or question.header.imageFile.id.',
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
                    field: 'year',
                    type: 'number (int 1..10)',
                    required: 'Optional',
                    details: 'Academic year (1 to 10), or omitted if unscheduled.',
                  },
                  {
                    field: 'semester',
                    type: '1 | 2',
                    required: 'Optional',
                    details: '1 (1st Semester) or 2 (2nd Semester), or omitted if unscheduled.',
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
                    details: 'Chapter-level materials (slides, documents, labs, etc.).',
                  },
                  {
                    field: 'lessons',
                    type: 'SubLesson[]',
                    required: 'Required',
                    details:
                      'Sub-lessons belonging to this chapter. Set lessons: [] to create a single-unit milestone chapter.',
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
                      'Unique item ID starting with "<coursePrefix>-". Canonical form: "<prefix>-ch<chapterOrder>-l<lessonOrder>-<slugified-title>".',
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

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SchemaTable
                  title="LessonResource (3-way XOR rule)"
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
                      details: 'One of the 10 ResourceKind tags listed below.',
                    },
                    {
                      field: 'recommended',
                      type: 'boolean',
                      required: 'Optional',
                      details: 'When true, pins this material to the top of the list.',
                    },
                    {
                      field: 'url',
                      type: 'string (URL)',
                      required: 'XOR payload',
                      details:
                        'Valid external URL (e.g. https://...). Provide EXACTLY ONE of url, file, or assessment.',
                    },
                    {
                      field: 'file',
                      type: 'StoredFileRef',
                      required: 'XOR payload',
                      details:
                        'Uploaded IndexedDB file reference. When authoring JSON manually or via an LLM, use url or assessment.',
                    },
                    {
                      field: 'assessment',
                      type: 'AssessmentData',
                      required: 'XOR payload',
                      details:
                        'Interactive exam or assignment definition (questions, mode, grading options).',
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

              {/* Course Term & Allowed Resource Kinds */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Course Term (<code className="font-mono text-xs">year</code> &amp;{' '}
                    <code className="font-mono text-xs">semester</code>)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Both fields are optional and formatted together via{' '}
                    <code className="font-mono">formatCourseTerm(course)</code> (e.g.{' '}
                    <code className="font-mono">Year 1 · 1st Semester</code>):
                  </p>
                  <ul className="space-y-1.5 pt-1 text-xs text-slate-700 dark:text-slate-300">
                    <li className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-600 dark:bg-[#0d131f]">
                      year: integer 1..10
                    </li>
                    <li className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-600 dark:bg-[#0d131f]">
                      semester: 1 (1st Semester) | 2 (2nd Semester)
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Allowed <code className="font-mono text-xs">ResourceKind</code> Values
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Each <code className="font-mono">LessonResource.kind</code> must be one of these{' '}
                    {RESOURCE_KINDS.length} keys:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {RESOURCE_KINDS.map((kind) => {
                      const style = RESOURCE_BADGE_STYLES[kind];
                      return (
                        <span
                          key={kind}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-[#0d131f]"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.className}`}
                          >
                            {style.label}
                          </span>
                          <code className="font-mono text-slate-700 dark:text-slate-300">
                            {kind}
                          </code>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Direct Milestone Chapters & ID Rules */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Direct Milestone Chapters (<code className="font-mono text-xs">lessons: []</code>)
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    A chapter with an empty <code className="font-mono">lessons: []</code> array
                    acts as a single-unit milestone chapter (great for capstones, exams, or short modules). It
                    supports <code className="font-mono">notes</code>,{' '}
                    <code className="font-mono">prerequisites</code>, and{' '}
                    <code className="font-mono">resources</code>, and is directly trackable as 1
                    item in both the tree canvas and checklist view.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    ID Prefix, Uniqueness &amp; Re-keying Rules
                  </h3>
                  <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
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
                      chapter/lesson IDs from <code className="font-mono">code</code> and titles
                      while remapping <code className="font-mono">prerequisites</code> within the
                      same file—so prerequisites only need to reference IDs present in that file.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: Interactive Exams & Assignments JSON */}
            <section
              id="assessment-json"
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  3. Interactive Exams &amp; Assignments JSON (
                  <code className="font-mono text-base">.assessment.json</code>)
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Interactive assessments can live either embedded inside a{' '}
                  <code className="font-mono text-xs">LessonResource.assessment</code> or as a
                  dedicated <code className="font-mono text-xs">.assessment.json</code> file. Both
                  the full <code className="font-mono text-xs">AssessmentExportEnvelope</code> and a
                  bare <code className="font-mono text-xs">AssessmentData</code> object are accepted
                  on import.
                </p>
              </div>

              <SchemaTable
                title="AssessmentExportEnvelope (.assessment.json)"
                rows={[
                  {
                    field: 'format',
                    type: '"college-assessment"',
                    required: 'Required (envelope)',
                    details: 'Constant format identifier for .assessment.json exports.',
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
                    details: 'UTC timestamp when the assessment was exported.',
                  },
                  {
                    field: 'title',
                    type: 'string',
                    required: 'Optional',
                    details: 'Suggested material title when importing into a course row.',
                  },
                  {
                    field: 'kind',
                    type: '"exam" | "assignment"',
                    required: 'Optional',
                    details: 'Suggested ResourceKind when importing.',
                  },
                  {
                    field: 'assessment',
                    type: 'AssessmentData',
                    required: 'Required (envelope)',
                    details: 'Full interactive assessment configuration and question array.',
                  },
                  {
                    field: 'attachments',
                    type: 'Attachment[]',
                    required: 'Optional',
                    details:
                      'Base64-encoded image attachments matching question.header.imageFile.id.',
                  },
                ]}
              />

              <SchemaTable
                title="AssessmentData"
                rows={[
                  {
                    field: 'mode',
                    type: '"exam" | "assignment"',
                    required: 'Required',
                    details:
                      'exam provides an optional timer, flagging, and end-of-test review; assignment provides per-question Check Answer and Show Hint controls.',
                  },
                  {
                    field: 'instructions',
                    type: 'string',
                    required: 'Optional',
                    details: 'Introductory prompt rendered with KaTeX LaTeX support.',
                  },
                  {
                    field: 'timeLimitMinutes',
                    type: 'number (int 1..300)',
                    required: 'Optional',
                    details: 'Countdown duration in minutes (typically used with mode: "exam").',
                  },
                  {
                    field: 'passingScorePercent',
                    type: 'number (int 0..100)',
                    required: 'Optional',
                    details: 'Pass threshold percentage (defaults to 70% if omitted).',
                  },
                  {
                    field: 'shuffleQuestions',
                    type: 'boolean',
                    required: 'Optional',
                    details: 'When true, randomizes question order on each attempt.',
                  },
                  {
                    field: 'questions',
                    type: 'AssessmentQuestion[]',
                    required: 'Required',
                    details: 'Non-empty array of questions with unique id values.',
                  },
                ]}
              />

              <SchemaTable
                title="AssessmentQuestion"
                rows={[
                  {
                    field: 'id',
                    type: 'string',
                    required: 'Required',
                    details: 'Non-empty unique identifier within this assessment.',
                  },
                  {
                    field: 'type',
                    type: '"mcq" | "multi-select" | "true-false" | "short-answer"',
                    required: 'Required',
                    details: 'Question interaction and grading mode.',
                  },
                  {
                    field: 'header',
                    type: 'AssessmentQuestionHeader',
                    required: 'Required',
                    details: 'Prompt text and/or header image (at least one required).',
                  },
                  {
                    field: 'options',
                    type: 'string[]',
                    required: 'Conditional',
                    details:
                      'Required (min 2 non-empty choices) for mcq and multi-select; optional 2-label array (defaults to ["True", "False"]) for true-false.',
                  },
                  {
                    field: 'correctIndices',
                    type: 'number[]',
                    required: 'Conditional',
                    details:
                      'Required for mcq (exact length 1), multi-select (min 1 unique valid index), and true-false ([0] or [1]).',
                  },
                  {
                    field: 'acceptedAnswers',
                    type: 'string[]',
                    required: 'Conditional',
                    details: 'Required (min 1 non-empty string) for short-answer.',
                  },
                  {
                    field: 'caseSensitive',
                    type: 'boolean',
                    required: 'Optional',
                    details: 'Applies to short-answer comparisons (defaults to false).',
                  },
                  {
                    field: 'points',
                    type: 'number (> 0)',
                    required: 'Optional',
                    details: 'Question weight in total score (defaults to 1).',
                  },
                  {
                    field: 'hint',
                    type: 'string',
                    required: 'Optional',
                    details: 'Shown on demand via Show Hint in Assignment mode (supports LaTeX).',
                  },
                  {
                    field: 'explanation',
                    type: 'string',
                    required: 'Optional',
                    details: 'Shown after checking/submitting (supports LaTeX).',
                  },
                ]}
              />

              <SchemaTable
                title="AssessmentQuestionHeader"
                rows={[
                  {
                    field: 'text',
                    type: 'string',
                    required: 'At least one',
                    details: 'Question prompt text supporting inline and display KaTeX LaTeX.',
                  },
                  {
                    field: 'imageUrl',
                    type: 'string (https://...)',
                    required: 'At least one',
                    details: 'External HTTPS image URL shown in the question header.',
                  },
                  {
                    field: 'imageFile',
                    type: 'StoredFileRef',
                    required: 'At least one',
                    details:
                      'Uploaded local image stored in IndexedDB and bundled into attachments on export.',
                  },
                ]}
              />

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  KaTeX LaTeX Math Syntax &amp; JSON Escaping Guide
                </h3>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <li>
                    <strong>Inline math:</strong>{' '}
                    <code className="font-mono">$...$</code> or{' '}
                    <code className="font-mono">\(...\)</code> (for example,{' '}
                    <code className="font-mono">$\Theta(n \log n)$</code>).
                  </li>
                  <li>
                    <strong>Display math:</strong>{' '}
                    <code className="font-mono">$$...$$</code> or{' '}
                    <code className="font-mono">\[...\]</code> (for example,{' '}
                    <code className="font-mono">$$T(n) = 2T(n/2) + n$$</code>).
                  </li>
                  <li>
                    <strong>Literal currency &amp; escaped dollars:</strong> Escaped{' '}
                    <code className="font-mono">\$</code> and currency amounts like{' '}
                    <code className="font-mono">$50</code> render as plain text.
                  </li>
                  <li>
                    <strong>JSON escaping reminder:</strong> Inside JSON strings, every LaTeX
                    backslash must be doubled (e.g.{' '}
                    <code className="font-mono">&quot;\\frac&#123;a&#125;&#123;b&#125;&quot;</code>
                    , <code className="font-mono">&quot;\\Theta(n \\log n)&quot;</code>,{' '}
                    <code className="font-mono">&quot;\\(x^2\\)&quot;</code>).
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 4: Progress Backup JSON Format */}
            <section
              id="progress-json"
              className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                4. Progress Backup JSON Format
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Exported from <strong>Backup Progress</strong> on any course page (default download
                filename <code className="font-mono text-xs">{BRAND.progressBackupFilename}</code>).
                Validated strictly by{' '}
                <code className="font-mono text-xs">ProgressStateSchema</code>.
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
                      'Status is "todo" | "learning" | "done" | "skipped". itemId can be either a lesson ID or a single-unit chapter ID.',
                  },
                  {
                    field: 'bookmarks',
                    type: 'string[]',
                    required: 'Required',
                    details: 'Array of bookmarked course slugs.',
                  },
                  {
                    field: 'assessmentScores',
                    type: 'Record<courseSlug, Record<scoreKey, AssessmentScoreRecord>>',
                    required: 'Optional',
                    details:
                      'Stores interactive exam/assignment scores keyed by "${itemId}::${resourceTitle}".',
                  },
                ]}
              />

              <SchemaTable
                title="AssessmentScoreRecord"
                rows={[
                  {
                    field: 'bestScorePercent',
                    type: 'number (0..100)',
                    required: 'Required',
                    details: 'Highest score achieved across attempts, shown as Best: XX%.',
                  },
                  {
                    field: 'latestScorePercent',
                    type: 'number (0..100)',
                    required: 'Required',
                    details: 'Most recent submitted percentage score.',
                  },
                  {
                    field: 'attempts',
                    type: 'number (int >= 1)',
                    required: 'Required',
                    details: 'Total number of completed submissions.',
                  },
                  {
                    field: 'passed',
                    type: 'boolean',
                    required: 'Required',
                    details: 'True if any attempt met passingScorePercent.',
                  },
                  {
                    field: 'updatedAt',
                    type: 'string (ISO-8601)',
                    required: 'Required',
                    details: 'UTC timestamp of the latest recorded attempt.',
                  },
                ]}
              />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700/80 dark:bg-[#1b2436] dark:text-slate-300">
                <strong>How skipped items affect progress:</strong> Marking an item as{' '}
                <code className="font-mono">skipped</code> reduces the required denominator (
                <code className="font-mono">required = total - skipped</code>). For example, skipping
                1 of 4 items changes the chapter progress fraction from{' '}
                <code className="font-mono">0/4</code> to <code className="font-mono">0/3</code>.
              </div>
            </section>

            {/* Section 5: Full Valid Examples */}
            <section
              id="examples"
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  5. Full Valid Examples
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  All three examples below pass strict schema validation and can be imported
                  directly into the app.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Course Export Example (<code className="font-mono text-xs">stat101.course.json</code>)
                  </h3>
                  <CopyButton text={EXAMPLE_COURSE_JSON} label="Copy Course JSON" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Demonstrates 3 chapters (including a direct milestone Chapter 3 with{' '}
                  <code className="font-mono">lessons: []</code>), cross-chapter prerequisites,{' '}
                  <code className="font-mono">Preparatory</code> department,{' '}
                  <code className="font-mono">Year 1 · 1st Semester</code>,{' '}
                  <code className="font-mono">recommended: true</code> pins, and an embedded
                  interactive LaTeX <code className="font-mono">assessment</code>.
                </p>
                <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
                  <code>{EXAMPLE_COURSE_JSON}</code>
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Interactive Exam Example (
                    <code className="font-mono text-xs">asymptotics.assessment.json</code>)
                  </h3>
                  <CopyButton text={EXAMPLE_ASSESSMENT_JSON} label="Copy Exam JSON" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Demonstrates an <code className="font-mono">.assessment.json</code>{' '}
                  envelope covering all four question types (<code className="font-mono">mcq</code>,{' '}
                  <code className="font-mono">multi-select</code>,{' '}
                  <code className="font-mono">true-false</code>,{' '}
                  <code className="font-mono">short-answer</code>) with inline and display KaTeX
                  math.
                </p>
                <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
                  <code>{EXAMPLE_ASSESSMENT_JSON}</code>
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Progress Backup Example (
                    <code className="font-mono text-xs">{BRAND.progressBackupFilename}</code>)
                  </h3>
                  <CopyButton text={EXAMPLE_PROGRESS_JSON} label="Copy Progress JSON" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Demonstrates <code className="font-mono">done</code>,{' '}
                  <code className="font-mono">learning</code>, and{' '}
                  <code className="font-mono">skipped</code> statuses, milestone chapter ID{' '}
                  <code className="font-mono">stat101-ch3-applied-data-lab-capstone</code>, and
                  persisted <code className="font-mono">assessmentScores</code>.
                </p>
                <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
                  <code>{EXAMPLE_PROGRESS_JSON}</code>
                </pre>
              </div>
            </section>

            {/* Section 6: Prompts for an LLM */}
            <section
              id="llm-prompt"
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  6. Prompts for an LLM
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Use these prompts with any LLM to generate directly importable course trees (
                  <code className="font-mono text-xs">.course.json</code>) or interactive
                  exams and assignments (
                  <code className="font-mono text-xs">.assessment.json</code>).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Course Roadmap Prompt (<code className="font-mono text-xs">.course.json</code>)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Generates a complete syllabus with optional embedded interactive assessments and
                      recommended pins.
                    </p>
                  </div>
                  <CopyButton text={LLM_AUTHORING_PROMPT} label="Copy LLM Prompt" />
                </div>

                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-100 p-4 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
                  <code>{LLM_AUTHORING_PROMPT}</code>
                </pre>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-700/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Interactive Exam &amp; Assignment Prompt (
                      <code className="font-mono text-xs">.assessment.json</code>)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Generates a KaTeX-enabled exam or assignment you can paste into any
                      Interactive material row.
                    </p>
                  </div>
                  <CopyButton text={LLM_EXAM_PROMPT} label="Copy Exam Prompt" />
                </div>

                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-100 p-4 font-mono text-xs leading-relaxed text-slate-900 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-100">
                  <code>{LLM_EXAM_PROMPT}</code>
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
