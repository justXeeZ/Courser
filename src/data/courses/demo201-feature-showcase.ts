import type { CourseTree } from '@/types/course';

export const demo201FeatureShowcase: CourseTree = {
  slug: 'demo201-feature-showcase',
  code: 'DEMO201',
  title: 'Feature Showcase: Sample Course',
  department: 'Computer Science',
  year: 2,
  semester: 1,
  credits: 4,
  description:
    'A comprehensive feature overview that showcases the entire application: all 10 material kinds (including audio), recommended pinning, interactive LaTeX exams and assignments, From → To week ranges (Week 1-3, Week 11), top-right Ch1 and Ch2 / L1 drawer tags, bounded 2D tree panning with 50%–250% zoom, left/right/auto branch placement, cross-chapter prerequisites, a six-lesson chapter, long titles, and direct milestone chapters.',
  chapters: [
    {
      id: 'demo201-ch1-foundations-core-layouts',
      order: 1,
      title: '1. Foundations & Core Layouts',
      weekRange: 'Week 1-3',
      description:
        'Demonstrates From → To multi-week ranges (Week 1-3), top-right Ch1 drawer tagging, chapter-level Notes tab, textbook and course links, and explicit left, right, and auto-balanced sub-lesson placement.',
      notes:
        'Chapter 1 illustrates how the Chapter Overview drawer displays its top-right Ch1 badge, week range pill (Week 1-3), Overview and Notes tabs, chapter materials, and interactive sub-lesson completion toggles in one place.',
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
          recommended: true,
        },
      ],
      supplements: [
        {
          id: 'demo201-ch1-s1-syllabus-reference-card',
          title: 'Syllabus Reference Card',
          summary:
            'Informational chapter child supplement (trackable: false) demonstrating typed custom fields without affecting progress.',
          notes:
            'Informational supplements display a dashed border on the tree and an Info badge in the Syllabus Checklist.',
          side: 'right',
          trackable: false,
          customFields: [
            { label: 'Grading Policy', value: '40% Labs / 60% Exams', type: 'text' },
            { label: 'Level', value: 'Undergraduate', type: 'badge' },
          ],
          resources: [],
        },
      ],
      lessons: [
        {
          id: 'demo201-ch1-l1-course-overview-tree-structure',
          title: 'Course Overview & Tree Structure',
          summary:
            'Introduces the feature showcase layout with lecture slides, a recommended walkthrough video, and an audio summary, plus the top-right Ch1 / L1 tag inside the Lesson Overview drawer.',
          notes:
            'Notice how this opening lesson sits on the left branch, displays a burnt-peach Ch1 / L1 badge at the top right of its drawer, and includes an audio lecture summary alongside slides and video.',
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
              recommended: true,
            },
            {
              title: 'Episode 01 Audio Summary: Big-O Intuition',
              url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
              kind: 'audio',
            },
          ],
        },
        {
          id: 'demo201-ch1-l2-left-branch-placement-example',
          title: 'Left Branch Placement Example',
          summary:
            'Explicitly pinned to the left side of the chapter spine using side: "left", paired with a focused document reference.',
          notes:
            'Pinning related theory topics to the left branch keeps conceptual material visually grouped together.',
          side: 'left',
          prerequisites: ['demo201-ch1-l1-course-overview-tree-structure'],
          resources: [
            {
              title: 'Growth of Functions Study Notes',
              url: 'https://www.bigocheatsheet.com/',
              kind: 'document',
            },
          ],
        },
        {
          id: 'demo201-ch1-l3-right-branch-placement-example',
          title: 'Right Branch Placement Example',
          summary:
            'Explicitly pinned to the right side of the chapter spine using side: "right", linked to an official interactive visualization.',
          notes:
            'Pinning applied or visual topics to the right branch contrasts cleanly against left-branch theory nodes.',
          side: 'right',
          prerequisites: ['demo201-ch1-l1-course-overview-tree-structure'],
          resources: [
            {
              title: 'VisuAlgo Official Algorithm Visualizer',
              url: 'https://visualgo.net/en',
              kind: 'official',
            },
          ],
        },
        {
          id: 'demo201-ch1-l4-auto-balanced-placement-example',
          title: 'Auto-Balanced Placement Example',
          summary:
            'Omits the explicit side field (auto mode) so the layout engine assigns left or right automatically based on index.',
          notes:
            'Auto placement lets authors add lessons quickly without manually managing branch symmetry.',
          prerequisites: [
            'demo201-ch1-l2-left-branch-placement-example',
            'demo201-ch1-l3-right-branch-placement-example',
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
      weekRange: 'Week 4-8',
      description:
        'A six-lesson chapter demonstrating default-collapsed editor cards, sticky editor scrolling with Ch2 / L1 context badges, a 40-character lesson title, cross-chapter links, and a lesson-to-chapter prerequisite.',
      notes:
        'Open this course in the editor to see all existing chapters and lessons load collapsed by default for a clean overview, then expand Chapter 2 to see the sticky context bar track your focus across all six sky-blue-accented sub-lessons.',
      prerequisites: ['demo201-ch1-foundations-core-layouts'],
      resources: [
        {
          title: 'Chapter 2 Study Guide & Problem Index',
          url: 'https://cp-algorithms.com/',
          kind: 'document',
        },
      ],
      lessons: [
        {
          id: 'demo201-ch2-l1-asymptotic-notation-recurrences',
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
            {
              title: 'Interactive Quiz: Asymptotics & Master Theorem',
              kind: 'exam',
              recommended: true,
              assessment: {
                mode: 'exam',
                instructions:
                  'Evaluate asymptotic bounds and solve recurrences such as $$T(n) = 2T(n/2) + n$$ before submitting.',
                timeLimitMinutes: 15,
                passingScorePercent: 70,
                questions: [
                  {
                    id: 'demo201-asymp-q1',
                    type: 'mcq',
                    header: {
                      text: 'By the Master Theorem, what is the tight asymptotic bound for $$T(n) = 2T(n/2) + n$$?',
                    },
                    options: [
                      '$\\Theta(n)$',
                      '$\\Theta(n \\log n)$',
                      '$\\Theta(n^2)$',
                      '$\\Theta(\\log n)$',
                    ],
                    correctIndices: [1],
                    points: 2,
                    explanation:
                      'Here $a = 2, b = 2, f(n) = n = \\Theta(n^{\\log_2 2})$, which falls in Case 2 giving $\\Theta(n \\log n)$.',
                  },
                  {
                    id: 'demo201-asymp-q2',
                    type: 'multi-select',
                    header: {
                      text: 'Select all functions that satisfy $g(n) = O(n \\log n)$.',
                    },
                    options: ['$n$', '$n \\log n$', '$n^2$', '$\\log n$'],
                    correctIndices: [0, 1, 3],
                    points: 2,
                    explanation:
                      '$n$, $\\log n$, and $n \\log n$ grow no faster than $n \\log n$, whereas $n^2$ grows strictly faster.',
                  },
                  {
                    id: 'demo201-asymp-q3',
                    type: 'true-false',
                    header: {
                      text: 'True or False: If $f(n) = \\Theta(g(n))$, then $f(n) = O(g(n))$ and $f(n) = \\Omega(g(n))$.',
                    },
                    options: ['True', 'False'],
                    correctIndices: [0],
                    points: 1,
                    explanation:
                      'By definition, $\\Theta(g(n))$ is the intersection of $O(g(n))$ (upper bound) and $\\Omega(g(n))$ (lower bound).',
                  },
                  {
                    id: 'demo201-asymp-q4',
                    type: 'short-answer',
                    header: {
                      text: 'For $T(n) = 4T(n/2) + n$, what is the exponent $c$ in the tight bound $\\Theta(n^c)$?',
                    },
                    acceptedAnswers: ['2'],
                    points: 1,
                    explanation:
                      'Since $\\log_2 4 = 2$ and $n = O(n^{2 - \\epsilon})$, Master Theorem Case 1 gives $\\Theta(n^2)$.',
                  },
                ],
              },
            },
          ],
          supplements: [
            {
              id: 'demo201-ch2-l1-s1-recurrence-cheat-sheet',
              title: 'Recurrence Cheat Sheet',
              summary:
                'Lesson child supplement (side: "down") attached directly below Asymptotic Notation & Recurrences.',
              side: 'down',
              customFields: [
                { label: 'Focus', value: 'Master Theorem Cases', type: 'badge' },
                { label: 'Tip', value: 'Compare f(n) vs n^(log_b a)', type: 'text' },
              ],
              resources: [],
            },
          ],
        },
        {
          id: 'demo201-ch2-l2-implementing-lock-free-concurrent-queues',
          title: 'Implementing Lock-Free Concurrent Queues',
          summary:
            'Showcases a 40-character lesson title to verify tree node width clamping, text wrapping, and drawer header responsiveness.',
          notes:
            'Long titles automatically expand node boxes up to the layout maximum without overlapping neighboring nodes.',
          side: 'right',
          prerequisites: ['demo201-ch2-l1-asymptotic-notation-recurrences'],
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
          id: 'demo201-ch2-l3-amortized-potential-analysis',
          title: 'Amortized Potential Analysis',
          summary:
            'Covers aggregate, accounting, and potential-function proofs for resizable tables and disjoint-set structures.',
          notes:
            'Define a non-negative potential function Phi(D_i) so amortized cost bounds worst-case operation sequences.',
          side: 'left',
          prerequisites: ['demo201-ch2-l1-asymptotic-notation-recurrences'],
          resources: [
            {
              title: 'Amortized Analysis Primer',
              url: 'https://cp-algorithms.com/data_structures/disjoint_set_union.html',
              kind: 'document',
            },
            {
              title: 'Interactive Assignment: Potential Method Practice',
              kind: 'assignment',
              assessment: {
                mode: 'assignment',
                instructions:
                  'Practice computing amortized costs $\\hat{c}_i = c_i + \\Phi(D_i) - \\Phi(D_{i-1})$ with instant checks and hints.',
                passingScorePercent: 60,
                questions: [
                  {
                    id: 'demo201-amort-q1',
                    type: 'mcq',
                    header: {
                      text: 'For a binary counter starting at $0$ with potential $\\Phi(D_i) = b_i$ (number of $1$-bits), what is the amortized cost $\\hat{c}_i$ of each increment?',
                    },
                    options: ['$1$', '$2$', '$\\log n$', '$n$'],
                    correctIndices: [1],
                    points: 1,
                    hint: 'If $t_i$ bits flip from $1$ to $0$ and $1$ bit flips from $0$ to $1$, then $c_i = t_i + 1$ and $\\Phi(D_i) - \\Phi(D_{i-1}) = 1 - t_i$.',
                    explanation:
                      'Adding actual cost and potential change gives $\\hat{c}_i = (t_i + 1) + (1 - t_i) = 2 = O(1)$.',
                  },
                  {
                    id: 'demo201-amort-q2',
                    type: 'short-answer',
                    header: {
                      text: 'What minimum value must a valid potential function satisfy at step $0$ if $\\Phi(D_i) \\ge \\Phi(D_0)$ for all $i$, typically chosen as $\\Phi(D_0) = ?$',
                    },
                    acceptedAnswers: ['0'],
                    points: 1,
                    hint: 'Choosing $\\Phi(D_0) = 0$ and ensuring $\\Phi(D_i) \\ge 0$ guarantees total amortized cost upper-bounds total actual cost.',
                    explanation:
                      'Setting $\\Phi(D_0) = 0$ with $\\Phi(D_i) \\ge 0$ ensures $\\sum \\hat{c}_i = \\sum c_i + \\Phi(D_n) - \\Phi(D_0) \\ge \\sum c_i$.',
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'demo201-ch2-l4-balanced-search-tree-rotations',
          title: 'Balanced Search Tree Rotations',
          summary:
            'Demonstrates a cross-chapter lesson-to-lesson prerequisite linking back to Chapter 1 Auto-Balanced Placement Example.',
          notes:
            'Single and double tree rotations restore logarithmic height invariants in O(1) structural pointer updates.',
          side: 'right',
          prerequisites: ['demo201-ch1-l4-auto-balanced-placement-example'],
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
          id: 'demo201-ch2-l5-skip-lists-probabilistic-bounds',
          title: 'Skip Lists & Probabilistic Bounds',
          summary:
            'Uses auto-balanced placement (omitted side) to explore randomized multi-level linked lists with expected O(log n) search.',
          notes:
            'Skip lists trade deterministic rotations for coin-flip tower heights that remain simple to implement concurrently.',
          prerequisites: ['demo201-ch2-l4-balanced-search-tree-rotations'],
          resources: [
            {
              title: 'MIT 6.046 Randomized Structures Module',
              url: 'https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/',
              kind: 'course',
            },
          ],
        },
        {
          id: 'demo201-ch2-l6-midterm-practice-synthesis',
          title: 'Midterm Practice & Synthesis',
          summary:
            'Combines earlier Chapter 2 lessons into a timed exam preparation pack with worked solutions.',
          notes:
            'Try skipping one non-essential lesson in this chapter to verify the progress badge updates from 0/6 to 0/5.',
          side: 'right',
          prerequisites: [
            'demo201-ch2-l3-amortized-potential-analysis',
            'demo201-ch2-l5-skip-lists-probabilistic-bounds',
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
      weekRange: 'Week 9-10',
      description:
        'First direct milestone chapter (0 sub-lessons) showcasing chapter-level assignment and lab materials, From → To week range (Week 9-10), and mixed chapter and lesson prerequisites.',
      notes:
        'Chapters without sub-lessons appear directly on the spine and can be marked Learning, Done, or Skipped in both Tree View and Checklist View (where mobile chapter tags stack vertically to keep titles roomy).',
      prerequisites: [
        'demo201-ch2-six-lesson-deep-dive',
        'demo201-ch2-l2-implementing-lock-free-concurrent-queues',
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
        'Second direct milestone chapter demonstrating a single-week From value (Week 11, where To is left empty or equal to From), final exam materials, review slides, and a prerequisite on Chapter 3.',
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
  supplements: [
    {
      id: 'demo201-s1-midterm-checkpoint',
      title: 'Midterm Checkpoint',
      summary:
        'Spine Supplement positioned between Chapter 2 and Chapter 3 with typed custom fields and a child supplement.',
      notes:
        'Click this Teal spine supplement or its child to inspect typed custom fields (date, badge, text, link), prerequisites, and materials.',
      afterChapterOrder: 2,
      prerequisites: ['demo201-ch2-six-lesson-deep-dive'],
      customFields: [
        { label: 'Exam Date', value: '30/11/2026', type: 'date' },
        { label: 'Weight', value: '25% of Grade', type: 'badge' },
        { label: 'Room', value: 'Hall B-204', type: 'text' },
        {
          label: 'Formula Sheet',
          value: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
          type: 'link',
        },
      ],
      resources: [
        {
          title: 'Midterm Study Guide',
          url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/quizzes/',
          kind: 'document',
        },
      ],
      children: [
        {
          id: 'demo201-s1-s1-office-hours-prep',
          title: 'Office Hours Prep',
          summary:
            'Trackable child Supplement branching off the Midterm Checkpoint spine supplement.',
          side: 'right',
          customFields: [
            { label: 'Schedule', value: 'Tue/Thu 14:00–16:00', type: 'text' },
          ],
          resources: [],
        },
      ],
    },
  ],
};
