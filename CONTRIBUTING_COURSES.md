# Contributing a New College Course Tree

Adding a new course takes about 5 minutes and requires no manual SVG coordinate placement—the layout engine automatically arranges chapters along the spine and balances sub-lessons on the left and right branches.

## 1. Create a Course File
Create a new TypeScript file under `src/data/courses/`, e.g. `src/data/courses/math201-linear-algebra.ts`:

```ts
import type { CourseTree } from '@/types/course';

export const math201LinearAlgebra: CourseTree = {
  slug: 'math201-linear-algebra',
  code: 'MATH201',
  title: 'Linear Algebra',
  department: 'Mathematics',
  semester: 'Year 2 · Fall',
  credits: 3,
  description: 'Vector spaces, linear transformations, eigenvalues, and SVD.',
  chapters: [
    {
      id: 'math201-ch1-vectors',
      order: 1,
      title: '1. Vectors & Matrices',
      weekRange: 'Weeks 1–3',
      description: 'Linear combinations, Gaussian elimination, and matrix inverses.',
      lessons: [
        {
          id: 'math201-dot-products',
          title: 'Vectors & Dot Products',
          summary: 'Geometric intuition for linear combinations, norms, and orthogonality.',
          side: 'left', // optional: 'left' | 'right' (auto-balanced if omitted)
          estimatedMinutes: 45,
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
  ],
};
```

## 2. Register the Course
Import and add it to `COURSES` in `src/data/courses/index.ts`:

```ts
import { math201LinearAlgebra } from '@/data/courses/math201-linear-algebra';

export const COURSES: CourseTree[] = [
  parseCourseTree(cs201DataStructures),
  parseCourseTree(cs301OperatingSystems),
  parseCourseTree(math201LinearAlgebra),
];
```

## 3. Validate Before Committing
Run the automated checks to verify unique IDs, valid prerequisite links, and zero SVG node overlaps:

```bash
npm run typecheck
npm run test
npm run build
```
