import type { CourseTree } from '@/types/course';

export const guide101QuickStart: CourseTree = {
  slug: 'guide101-quick-start',
  code: 'GUIDE101',
  title: 'Quick Start: Using Course Trees',
  department: 'Preparatory',
  semester: 'Year 1 - First Semester',
  credits: 1,
  description:
    'Learn how to browse the catalog, read interactive course trees, track your progress, author new courses, upload materials, and back up your data.',
  chapters: [
    {
      id: 'guide101-ch1-navigating-the-catalog',
      order: 1,
      title: '1. Navigating the Catalog',
      weekRange: 'Part 1',
      description:
        'Browse courses grouped by department, bookmark favorites, and jump straight to any course, chapter, or lesson with instant search.',
      notes:
        'Courses on the homepage are grouped by Department (defaulting to Preparatory) with each card showing its course code, title, and scheduled semester.',
      lessons: [
        {
          id: 'guide101-browsing-bookmarks',
          title: 'Browsing & Bookmarks',
          summary:
            'Explore the homepage catalog grouped by Department and filter between All Course Trees, Bookmarked, and In Progress tabs. Click the bookmark icon on any course card or inside a course header to keep priority courses one click away.',
          notes:
            'Department grouping stays active across tabs so you can quickly scan your Preparatory, Computer Science, or custom department courses.\nEach card displays the course code, title, semester, and your completion ratio.',
          side: 'left',
          resources: [
            {
              title: 'Catalog Navigation Overview',
              url: 'https://roadmap.sh/guides',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'guide101-searching-with-ctrl-k',
          title: 'Searching with Ctrl+K',
          summary:
            'Press Ctrl+K (or Cmd+K on macOS) from anywhere in the app to open the global search modal. Search across course codes, titles, departments, chapters, and individual sub-lessons to jump straight into the target view.',
          notes:
            'Use Arrow Up/Down to highlight a match and Enter to open it immediately, or press Esc to dismiss the search modal.\nBookmarking key courses first helps you keep frequently visited syllabi close even without searching.',
          side: 'right',
          prerequisites: ['guide101-browsing-bookmarks'],
          resources: [
            {
              title: 'Keyboard-First Navigation Patterns',
              url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets',
              kind: 'reading',
            },
            {
              title: 'Command Palette Design Reference',
              url: 'https://www.nngroup.com/articles/keyboard-shortcuts/',
              kind: 'official',
            },
          ],
        },
      ],
    },
    {
      id: 'guide101-ch2-reading-a-course-tree',
      order: 2,
      title: '2. Reading a Course Tree',
      weekRange: 'Part 2',
      description:
        'Understand the central chapter spine, left/right sub-lesson branches, prerequisite links, and the Chapter Overview drawer.',
      notes:
        'Each course tree arranges chapters down the center spine with sub-lessons branching left and right, plus a List View tab for linear study.',
      lessons: [
        {
          id: 'guide101-chapters-vs-sub-lessons',
          title: 'Chapters vs Sub-Lessons',
          summary:
            'Dark-bordered boxes down the center spine represent major chapters, while cream-colored branch nodes represent sub-lessons inside each chapter. You can switch between the visual Tree View and the linear Checklist View in the course header.',
          notes:
            'In Tree View, lessons can sit on the left branch, the right branch, or be auto-balanced along the chapter.\nChecklist View groups those same items into collapsible chapter sections for fast keyboard or mobile scanning.',
          side: 'left',
          resources: [
            {
              title: 'Visual Learning Roadmaps Guide',
              url: 'https://roadmap.sh/get-started',
              kind: 'official',
            },
          ],
        },
        {
          id: 'guide101-prerequisites',
          title: 'Prerequisites',
          summary:
            'Both chapters and sub-lessons can declare prerequisites pointing to earlier chapters or lessons within the same course. Open any item drawer to see clickable prerequisite chips that show completion status and jump directly to that topic.',
          notes:
            'Cross-chapter prerequisites help connect foundational modules to later capstone work.\nCompleted prerequisites display a green check inside their chip so you know you are ready to proceed.',
          side: 'right',
          prerequisites: ['guide101-chapters-vs-sub-lessons'],
          resources: [
            {
              title: 'Prerequisite Graphs in Curriculum Design',
              url: 'https://en.wikipedia.org/wiki/Topological_sorting',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'guide101-chapter-overview',
          title: 'Chapter Overview',
          summary:
            'Clicking any chapter node on the spine opens the Chapter Overview drawer rather than jumping into its first lesson. Inside, you can review chapter progress, prerequisites, chapter-level materials, study notes, and the full list of sub-lessons.',
          notes:
            'The URL updates to ?chapter=<id> when inspecting a chapter and ?lesson=<id> when inspecting a sub-lesson, making links shareable and refresh-safe.\nUse Prev/Next chapter buttons at the bottom of the drawer to step along the syllabus.',
          side: 'left',
          prerequisites: ['guide101-chapters-vs-sub-lessons'],
          resources: [
            {
              title: 'Syllabus Structure Best Practices',
              url: 'https://ctl.stanford.edu/syllabus-design',
              kind: 'course',
            },
          ],
        },
      ],
    },
    {
      id: 'guide101-ch3-tracking-progress',
      order: 3,
      title: '3. Tracking Progress',
      weekRange: 'Part 3',
      description:
        'Mark lessons and standalone chapters as Learning, Done, or Skip, and learn how skipping adjusts required completion totals.',
      notes:
        'Progress is stored locally per browser in localStorage under college_course_trees_progress_v1.',
      lessons: [
        {
          id: 'guide101-learning-done-skip',
          title: 'Learning, Done & Skip',
          summary:
            'Every trackable item supports four states: Todo, Learning (violet), Done (green), and Skip (slate gray). Marking an item as Skip styles its icon, pills, badges, and tree node in slate gray and reduces the required denominator in chapter and course progress fractions.',
          notes:
            'For example, skipping 1 of 4 lessons updates the chapter fraction from 0/4 to 0/3 so optional or waived topics do not hold back your completion percentage.\nIf every item in a chapter is skipped, required drops to 0 and completion reads 100%.',
          side: 'left',
          resources: [
            {
              title: 'Self-Paced Study Tracking Strategies',
              url: 'https://learningcenter.unc.edu/tips-and-tools/studying-101-study-smarter-not-harder/',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'guide101-right-click-shift-click',
          title: 'Right-click & Shift+Click',
          summary:
            'You do not have to open a drawer just to update your progress on the tree. Right-click any lesson or standalone chapter node for a quick status pill, or hold Shift and click a node to toggle Done immediately.',
          notes:
            'You can also filter the tree canvas by All, Todo, Learning, Done, or Skipped using the progress strip filter pills.\nIn Checklist View, clicking the status button on any row toggles Done directly.',
          side: 'right',
          prerequisites: ['guide101-learning-done-skip'],
          resources: [
            {
              title: 'Interactive Tree Controls Summary',
              url: 'https://roadmap.sh/about',
              kind: 'official',
            },
          ],
        },
        {
          id: 'guide101-keyboard-shortcuts-l-d-s-esc',
          title: 'Keyboard Shortcuts L/D/S/←/→/Esc',
          summary:
            'While a lesson drawer or standalone chapter drawer is open, press L for Learning, D for Done, or S for Skip to toggle that status. Press Left or Right Arrow to move between trackable items, and Esc to close the drawer.',
          notes:
            'Pressing the active status key a second time resets the item back to Todo.\nKeyboard shortcuts automatically ignore keystrokes while typing inside inputs or textareas.',
          side: 'left',
          prerequisites: ['guide101-learning-done-skip'],
          resources: [
            {
              title: 'Shortcut Reference Sheet',
              url: 'https://webaim.org/techniques/keyboard/',
              kind: 'slides',
            },
          ],
        },
      ],
    },
    {
      id: 'guide101-ch4-creating-editing-courses',
      order: 4,
      title: '4. Creating & Editing Courses',
      weekRange: 'Part 4',
      description:
        'Build new courses from scratch, organize chapters and standalone milestones, and attach URL links or uploaded study files.',
      notes:
        'The sticky editor bar tracks whichever chapter or lesson you are currently editing as you scroll through long syllabi.',
      lessons: [
        {
          id: 'guide101-new-course-derived-ids',
          title: 'New Course & Derived IDs',
          summary:
            'Click + New Course in the navbar to open the course editor, choose a Department (defaulting to Preparatory) and a Semester from the 8-semester dropdown, and add chapters. Chapter and lesson IDs are automatically derived from the course code and title, and saving a rename or code change automatically remaps your saved progress and bookmarks.',
          notes:
            'Because progress is remapped using an oldId-to-newId map on save, renaming a tracked lesson or changing a course code never orphans your Done/Learning/Skipped history.\nEstimated time fields have been completely removed so authoring stays focused on structure and materials.',
          side: 'left',
          resources: [
            {
              title: 'Course Authoring Workflow Guide',
              url: 'https://ocw.mit.edu/about/',
              kind: 'course',
            },
          ],
        },
        {
          id: 'guide101-chapters-lessons-standalone-chapters',
          title: 'Chapters, Lessons & Standalone Chapters',
          summary:
            'Chapters can hold multiple sub-lessons or zero sub-lessons. A chapter with 0 sub-lessons becomes a standalone chapter that supports its own prerequisites, materials, and study notes and can be checked off directly in both Tree View and Checklist View.',
          notes:
            'Use standalone chapters for midterms, capstone projects, reading weeks, or wrap-up milestones that do not need nested sub-lessons.\nThe editor shows a helpful standalone-chapter hint whenever a chapter has 0 lessons.',
          side: 'right',
          prerequisites: ['guide101-new-course-derived-ids'],
          resources: [
            {
              title: 'Modular Curriculum Design Notes',
              url: 'https://cft.vanderbilt.edu/guides-sub-pages/understanding-by-design/',
              kind: 'reading',
            },
          ],
        },
        {
          id: 'guide101-uploading-materials',
          title: 'Uploading Materials',
          summary:
            'Every material row lets you toggle between a web Link and an uploaded File stored locally in IndexedDB. Uploads have no file size cap, auto-suggest a material kind from the filename, warn gently if an extension looks unusual for the chosen kind, and reject empty files or dangerous executable/scriptable formats.',
          notes:
            'Uploaded slides, PDFs, videos, or code archives persist across browser reloads and open or download straight from the chapter or lesson drawer.\nDangerous extensions such as .exe, .bat, .sh, .ps1, .html, and .svg are blocked for safety.',
          side: 'left',
          prerequisites: ['guide101-chapters-lessons-standalone-chapters'],
          resources: [
            {
              title: 'IndexedDB Browser Storage Overview',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
              kind: 'official',
            },
          ],
        },
      ],
    },
    {
      id: 'guide101-ch5-backup-import-export',
      order: 5,
      title: '5. Backup, Import & Export',
      weekRange: 'Part 5',
      description:
        'Standalone milestone covering course export (.course.json), course import into new drafts, and per-user progress backup.',
      notes:
        'Use Export in any course header to download a portable .course.json file—with "Include uploaded files" checked by default to embed IndexedDB attachments as base64, or unchecked for a lightweight link-only export.\nOn the New Course page, click Import Course to load a .course.json or bare course object (with automatic slug conflict resolution), and use Progress Backup inside any course header to export or restore your completion statuses and bookmarks.',
      prerequisites: [
        'guide101-ch4-creating-editing-courses',
        'guide101-new-course-derived-ids',
      ],
      resources: [
        {
          title: 'Portable JSON Data Exchange Principles',
          url: 'https://www.json.org/json-en.html',
          kind: 'official',
        },
        {
          title: 'Base64 File Embedding Reference',
          url: 'https://developer.mozilla.org/en-US/docs/Glossary/Base64',
          kind: 'reading',
        },
      ],
      lessons: [],
    },
    {
      id: 'guide101-ch6-dark-mode-data-formats',
      order: 6,
      title: '6. Dark Mode & Data Formats',
      weekRange: 'Part 6',
      description:
        'Standalone milestone covering Light/Dark/System theme switching and the built-in Data Formats & LLM Authoring Guide.',
      notes:
        'Click the theme toggle button in the top navbar to cycle between Light, Dark, and System modes; your preference persists across reloads while keeping the homepage catalog dark and tree nodes high-contrast.\nVisit the Data Formats documentation page linked at the bottom of the homepage for complete schemas, copyable JSON examples, and a ready-to-paste LLM prompt for generating importable courses.',
      prerequisites: ['guide101-ch5-backup-import-export'],
      resources: [
        {
          title: 'Prefers-Color-Scheme & Accessible Contrast',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme',
          kind: 'reading',
        },
      ],
      lessons: [],
    },
  ],
};
