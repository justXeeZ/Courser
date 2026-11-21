import type { CourseTree } from '@/types/course';

export const demo201FeatureShowcase: CourseTree = {
  slug: 'demo201-feature-showcase',
  code: 'DEMO201',
  title: 'Feature Showcase: Sample Course',
  department: 'Computer Science',
  semester: 'Year 2 - First Semester',
  credits: 4,
  description:
    'A comprehensive sample course demonstrating all nine material kinds, left/right/auto branch placement, cross-chapter and lesson-to-chapter prerequisites, a six-lesson chapter, long titles, and standalone chapters.',
  chapters: [
    {
      id: 'demo201-ch1-foundations-core-layouts',
      order: 1,
      title: '1. Foundations & Core Layouts',
      weekRange: 'Weeks 1–3',
      description:
        'Demonstrates chapter-level notes, chapter-level textbook and course links, and explicit left, right, and auto-balanced sub-lesson placement.',
      notes:
        'Chapter 1 illustrates how a chapter overview drawer surfaces chapter notes, materials, and sub-lesson status summaries in one place.',
      resources: [
        {
          title: 'MIT OCW Algorithms Course Homepage',
          url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
          kind: 'course',
        },
        {
          title: 'Algorithms Textbook (Open Edition)',
          url: 'https://algs4.cs.princeton.edu/home/',
          kind: 'textbook',
        },
      ],
      lessons: [
        {
          id: 'demo201-course-overview-tree-structure',
          title: 'Course Overview & Tree Structure',
          summary:
            'Introduces the sample course layout with lecture slides and an introductory walkthrough video.',
          notes:
            'Notice how this opening lesson sits on the left branch and serves as the foundation for subsequent nodes.',
          side: 'left',
          resources: [
            {
              title: 'Lecture 01 Slides: Course Roadmap',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/',
              kind: 'slides',
            },
            {
              title: 'Course Intro Walkthrough Video',
              url: 'https://www.youtube.com/watch?v=ZA-tUyM_y7s',
              kind: 'video',
            },
          ],
        },
        {
          id: 'demo201-left-branch-placement-example',
          title: 'Left Branch Placement Example',
          summary:
            'Explicitly pinned to the left side of the chapter spine using side: "left", paired with a focused reading reference.',
          notes:
            'Pinning related theory topics to the left branch keeps conceptual material visually grouped together.',
          side: 'left',
          prerequisites: ['demo201-course-overview-tree-structure'],
          resources: [
            {
              title: 'Growth of Functions Reading Notes',
              url: 'https://www.bigocheatsheet.com/',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'demo201-right-branch-placement-example',
          title: 'Right Branch Placement Example',
          summary:
            'Explicitly pinned to the right side of the chapter spine using side: "right", linked to an official interactive visualization.',
          notes:
            'Pinning applied or visual topics to the right branch contrasts cleanly against left-branch theory nodes.',
          side: 'right',
          prerequisites: ['demo201-course-overview-tree-structure'],
          resources: [
            {
              title: 'VisuAlgo Official Algorithm Visualizer',
              url: 'https://visualgo.net/en',
              kind: 'official',
            },
          ],
        },
        {
          id: 'demo201-auto-balanced-placement-example',
          title: 'Auto-Balanced Placement Example',
          summary:
            'Omits the explicit side field (auto mode) so the layout engine assigns left or right automatically based on index.',
          notes:
            'Auto placement lets authors add lessons quickly without manually managing branch symmetry.',
          prerequisites: [
            'demo201-left-branch-placement-example',
            'demo201-right-branch-placement-example',
          ],
          resources: [
            {
              title: 'Lab 01: Dynamic Array Benchmarks',
              url: 'https://algs4.cs.princeton.edu/13stacks/',
              kind: 'lab',
            },
          ],
        },
      ],
    },
    {
      id: 'demo201-ch2-six-lesson-deep-dive',
      order: 2,
      title: '2. Six-Lesson Deep Dive',
      weekRange: 'Weeks 4–8',
      description:
        'A six-lesson chapter demonstrating sticky editor scrolling, a 40-character lesson title, cross-chapter links, and a lesson-to-chapter prerequisite.',
      notes:
        'Open this chapter in the course editor to see the sticky chapter and lesson context bar follow your focus while scrolling across all six lessons.',
      prerequisites: ['demo201-ch1-foundations-core-layouts'],
      resources: [
        {
          title: 'Chapter 2 Study Guide & Problem Index',
          url: 'https://cp-algorithms.com/',
          kind: 'reading',
        },
      ],
      lessons: [
        {
          id: 'demo201-asymptotic-notation-recurrences',
          title: 'Asymptotic Notation & Recurrences',
          summary:
            'Demonstrates a lesson-to-chapter prerequisite by depending directly on Chapter 1 as a whole.',
          notes:
            'Clicking the prerequisite chip below jumps straight to the Chapter 1 Overview drawer rather than a single sub-lesson.',
          side: 'left',
          prerequisites: ['demo201-ch1-foundations-core-layouts'],
          resources: [
            {
              title: 'Lecture 02 Slides: Master Theorem',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/',
              kind: 'slides',
            },
            {
              title: 'CLRS Recurrence Relations Reference',
              url: 'https://algs4.cs.princeton.edu/14analysis/',
              kind: 'textbook',
            },
          ],
        },
        {
          id: 'demo201-implementing-lock-free-concurrent-queues',
          title: 'Implementing Lock-Free Concurrent Queues',
          summary:
            'Showcases a 40-character lesson title to verify tree node width clamping, text wrapping, and drawer header responsiveness.',
          notes:
            'Long titles automatically expand node boxes up to the layout maximum without overlapping neighboring nodes.',
          side: 'right',
          prerequisites: ['demo201-asymptotic-notation-recurrences'],
          resources: [
            {
              title: 'Lab 02: Atomic Compare-and-Swap Ring Buffer',
              url: 'https://en.cppreference.com/w/cpp/atomic/atomic',
              kind: 'lab',
            },
            {
              title: 'Assignment 1: Lock-Free Queue Verification',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/assignments/',
              kind: 'assignment',
            },
          ],
        },
        {
          id: 'demo201-amortized-potential-analysis',
          title: 'Amortized Potential Analysis',
          summary:
            'Covers aggregate, accounting, and potential-function proofs for resizable tables and disjoint-set structures.',
          notes:
            'Define a non-negative potential function Phi(D_i) so amortized cost bounds worst-case operation sequences.',
          side: 'left',
          prerequisites: ['demo201-asymptotic-notation-recurrences'],
          resources: [
            {
              title: 'Amortized Analysis Primer',
              url: 'https://cp-algorithms.com/data_structures/disjoint_set_union.html',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'demo201-balanced-search-tree-rotations',
          title: 'Balanced Search Tree Rotations',
          summary:
            'Demonstrates a cross-chapter lesson-to-lesson prerequisite linking back to Chapter 1 Auto-Balanced Placement Example.',
          notes:
            'Single and double tree rotations restore logarithmic height invariants in O(1) structural pointer updates.',
          side: 'right',
          prerequisites: ['demo201-auto-balanced-placement-example'],
          resources: [
            {
              title: 'AVL & Red-Black Rotations Lecture Video',
              url: 'https://www.youtube.com/watch?v=U1JYwHcFfso',
              kind: 'video',
            },
            {
              title: 'VisuAlgo AVL Tree Official Demo',
              url: 'https://visualgo.net/en/bst',
              kind: 'official',
            },
          ],
        },
        {
          id: 'demo201-skip-lists-probabilistic-bounds',
          title: 'Skip Lists & Probabilistic Bounds',
          summary:
            'Uses auto-balanced placement (omitted side) to explore randomized multi-level linked lists with expected O(log n) search.',
          notes:
            'Skip lists trade deterministic rotations for coin-flip tower heights that remain simple to implement concurrently.',
          prerequisites: ['demo201-balanced-search-tree-rotations'],
          resources: [
            {
              title: 'MIT 6.046 Randomized Structures Module',
              url: 'https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/',
              kind: 'course',
            },
          ],
        },
        {
          id: 'demo201-midterm-practice-synthesis',
          title: 'Midterm Practice & Synthesis',
          summary:
            'Combines earlier Chapter 2 lessons into a timed exam preparation pack with worked solutions.',
          notes:
            'Try skipping one non-essential lesson in this chapter to verify the progress badge updates from 0/6 to 0/5.',
          side: 'right',
          prerequisites: [
            'demo201-amortized-potential-analysis',
            'demo201-skip-lists-probabilistic-bounds',
          ],
          resources: [
            {
              title: 'Midterm Practice Exam & Solutions',
              url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/quizzes/',
              kind: 'exam',
            },
          ],
        },
      ],
    },
    {
      id: 'demo201-ch3-capstone-lab-milestone',
      order: 3,
      title: '3. Capstone Lab Milestone',
      weekRange: 'Weeks 9–10',
      description:
        'First standalone chapter (0 sub-lessons) showcasing chapter-level assignment and lab materials plus mixed chapter and lesson prerequisites.',
      notes:
        'Standalone chapters appear directly on the spine with a status pill instead of an x/y counter, and can be marked Learning, Done, or Skipped in both Tree View and Checklist View.',
      prerequisites: [
        'demo201-ch2-six-lesson-deep-dive',
        'demo201-implementing-lock-free-concurrent-queues',
      ],
      resources: [
        {
          title: 'Capstone Specification & Grading Rubric',
          url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/assignments/',
          kind: 'assignment',
        },
        {
          title: 'Capstone Benchmark Harness Lab',
          url: 'https://algs4.cs.princeton.edu/44sp/',
          kind: 'lab',
        },
      ],
      lessons: [],
    },
    {
      id: 'demo201-ch4-final-exam-course-retrospective',
      order: 4,
      title: '4. Final Exam & Course Retrospective',
      weekRange: 'Week 11',
      description:
        'Second standalone chapter wrapping up the showcase course with final exam materials, review slides, and a prerequisite on Chapter 3.',
      notes:
        'Try exporting this course from the header Export button and importing it as a new draft to test slug conflict resolution and full schema round-tripping.',
      prerequisites: ['demo201-ch3-capstone-lab-milestone'],
      resources: [
        {
          title: 'Final Exam Past Papers Pack',
          url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/quizzes/',
          kind: 'exam',
        },
        {
          title: 'Course Summary & Review Slides',
          url: 'https://algs4.cs.princeton.edu/home/',
          kind: 'slides',
        },
      ],
      lessons: [],
    },
  ],
};
