# Contributing a New College Course Tree

Adding a new course takes just a few minutes and requires no manual SVG coordinate placement—the layout engine automatically arranges chapters along the spine and balances sub-lessons on the left and right branches.

You can author a course in two ways:
1. **In the app (recommended for users & LLM workflows):** Click **+ New Course** (`/editor/new`) to build visually or click **Import Course** to load a `.course.json` file (or bare `CourseTree` JSON). See the built-in schema reference, valid examples, and ready-to-paste LLM authoring prompt at **`/docs/data-formats`**.
2. **As a built-in TypeScript module (for contributors):** Follow the steps below to add a bundled seed course under `src/data/courses/`.

## 1. Create a Course File
Create a new TypeScript file under `src/data/courses/`, e.g. `src/data/courses/math201-linear-algebra.ts`:

```ts
import type { CourseTree } from '@/types/course';

export const math201LinearAlgebra: CourseTree = {
  slug: 'math201-linear-algebra',
  code: 'MATH201',
  title: 'Linear Algebra',
  department: 'Preparatory', // Defaults to 'Preparatory'; homepage catalog groups by department
  semester: 'Year 2 - First Semester', // Optional; must be one of SEMESTER_OPTIONS
  credits: 3,
  description: 'Vector spaces, linear transformations, eigenvalues, and SVD.',
  chapters: [
    {
      id: 'math201-ch1-vectors-matrices',
      order: 1,
      title: '1. Vectors & Matrices',
      weekRange: 'Weeks 1–3',
      description: 'Linear combinations, Gaussian elimination, and matrix inverses.',
      notes: 'Focus on geometric intuition alongside row-reduction mechanics.',
      lessons: [
        {
          id: 'math201-vectors-dot-products',
          title: 'Vectors & Dot Products',
          summary: 'Geometric intuition for linear combinations, norms, and orthogonality.',
          notes: 'Verify Cauchy-Schwarz on concrete 2D and 3D examples.',
          side: 'left', // optional: 'left' | 'right' (auto-balanced if omitted)
          resources: [
            {
              title: 'Lecture 01 Slides: Vectors & Linear Combinations',
              url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
              kind: 'slides', // slides | video | lab | reading | textbook | course | official | exam | assignment
            },
          ],
        },
      ],
    },
    {
      id: 'math201-ch2-capstone-project',
      order: 2,
      title: '2. SVD Image Compression Capstone',
      weekRange: 'Week 4',
      description: 'Standalone milestone chapter tracked directly without sub-lessons.',
      notes: 'Standalone chapters (lessons: []) support notes, prerequisites, and materials.',
      prerequisites: ['math201-vectors-dot-products'],
      resources: [
        {
          title: 'Capstone Lab Handout',
          url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
          kind: 'lab',
        },
      ],
      lessons: [],
    },
  ],
};
```

### Schema Rules & Options
- **`department`**: Required string (min 2 chars), defaulting to `'Preparatory'`. Kept visible in the editor, course header, search modal, and homepage catalog grouping.
- **`semester`**: Optional enum (`SEMESTER_OPTIONS` in `src/types/course.ts`):
  - `'Year 1 - First Semester'`, `'Year 1 - Second Semester'`
  - `'Year 2 - First Semester'`, `'Year 2 - Second Semester'`
  - `'Year 3 - First Semester'`, `'Year 3 - Second Semester'`
  - `'Year 4 - First Semester'`, `'Year 4 - Second Semester'`
  - Omit `semester` to leave the course unscheduled.
- **Standalone chapters (`lessons: []`)**: A chapter with zero sub-lessons is treated as a standalone trackable item (`1` item in progress fractions) and supports optional `notes`, `prerequisites`, and `resources`.
- **ID uniqueness & prerequisites**: All chapter and lesson `id` values share a single uniqueness namespace per course and must start with `<coursePrefix>-` (lowercase alphanumeric characters of `code`, e.g. `math201-`). Both chapters and lessons can declare `prerequisites` referencing any chapter or lesson ID in the same course (no self-references).
- **Materials (`LessonResource`)**: Each resource must provide **either** `url` **or** `file` (`StoredFileRef`), never both.

## 2. Register the Course
Import and add it to `COURSES` in `src/data/courses/index.ts` alongside the bundled seed courses (`guide101QuickStart` and `demo201FeatureShowcase`):

```ts
import { demo201FeatureShowcase } from '@/data/courses/demo201-feature-showcase';
import { guide101QuickStart } from '@/data/courses/guide101-quick-start';
import { math201LinearAlgebra } from '@/data/courses/math201-linear-algebra';

export const COURSES: CourseTree[] = [
  guide101QuickStart,
  demo201FeatureShowcase,
  math201LinearAlgebra,
].map(parseCourseTree);
```

## 3. Uploaded Materials & Import/Export (`.course.json`)
- **Uploaded materials (IndexedDB)**: In the Course Editor, materials can link to an external URL or upload a local file stored in IndexedDB (`college_course_trees`, object store `files`).
  - **No file size cap** is enforced.
  - Light validation auto-suggests a `kind` from the filename and shows a non-blocking warning if a file's extension doesn't match typical extensions for the selected `kind` (e.g., `slides` → `.pdf`, `.ppt`, `.pptx`; `video` → `.mp4`, `.webm`; `lab` → `.pdf`, `.zip`, `.ipynb`, code, or video).
  - Empty files (`0` bytes) and dangerous/executable or scriptable extensions (`.exe`, `.bat`, `.sh`, `.msi`, `.dll`, `.cmd`, `.ps1`, `.html`, `.svg`, etc.) are rejected.
- **Course Import & Export**:
  - Click **Export** in any course header to download `<slug>.course.json` (`format: "college-course-tree"`, `version: 1`), optionally embedding IndexedDB file attachments as base64.
  - Click **Import Course** on `/editor/new` to load a `.course.json` envelope or bare `CourseTree` object (slug conflicts are automatically resolved with `-2`, `-3`, etc.).
  - Visit **`/docs/data-formats`** in the app for the complete schema reference, copyable JSON examples, and an LLM authoring prompt.

## 4. Validate Before Committing
Run the automated checks to verify schema compliance, unique IDs, valid prerequisite links, and zero SVG node overlaps:

```bash
npm run typecheck
npm run test
npm run build
```
