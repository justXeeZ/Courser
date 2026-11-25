import type { CourseTree } from '@/types/course';

export const guide101QuickStart: CourseTree = {
  slug: 'guide101-quick-start',
  code: 'GUIDE101',
  title: 'Quick Start: Using Course Trees',
  department: 'Preparatory',
  year: 1,
  semester: 1,
  credits: 1,
  description:
    'Step-by-step tutorial teaching you how to browse the catalog, pan and zoom interactive course trees, track your progress, author courses with From → To week ranges and collapsible editor cards, attach materials, and back up your data.',
  chapters: [
    {
      id: 'guide101-ch1-navigating-the-catalog',
      order: 1,
      title: '1. Navigating the Catalog',
      weekRange: 'Week 1',
      description:
        'Browse courses grouped by department, bookmark favorites, and jump straight to any course, chapter, or lesson with instant search.',
      notes:
        'Courses on the homepage are grouped by Department (defaulting to Preparatory) with each card showing its course code, title, and optional Year · Semester term.',
      lessons: [
        {
          id: 'guide101-ch1-l1-browsing-bookmarks',
          title: 'Browsing & Bookmarks',
          summary:
            'Explore the homepage catalog grouped by Department in Light or Dark mode and filter between Course Trees, Bookmarked, and In Progress tabs. Click the bookmark icon on any course card or inside a course header to keep priority courses one click away.',
          notes:
            'Department grouping stays active across tabs so you can quickly scan your Preparatory, Computer Science, or custom department courses.\nEach card displays the course code, title, Year · Semester term, and your completion ratio. Pinned Recommended materials float to the top inside item drawers.',
          side: 'left',
          resources: [
            {
              title: 'Catalog Navigation Overview',
              url: 'https://roadmap.sh/guides',
              kind: 'document',
              recommended: true,
            },
          ],
        },
        {
          id: 'guide101-ch1-l2-searching-with-ctrl-k',
          title: 'Searching with Ctrl+K',
          summary:
            'Press Ctrl+K (or Cmd+K on macOS) from anywhere in the app to open the global search modal. Search across course codes, titles, departments, chapters, and individual sub-lessons to jump straight into the target view.',
          notes:
            'Use Arrow Up/Down to highlight a match and Enter to open it immediately, or press Esc to dismiss the search modal.\nBookmarking key courses first helps you keep frequently visited syllabi close even without searching.',
          side: 'right',
          prerequisites: ['guide101-ch1-l1-browsing-bookmarks'],
          resources: [
            {
              title: 'Keyboard-First Navigation Patterns',
              url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets',
              kind: 'document',
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
      weekRange: 'Week 2',
      description:
        'Understand the central chapter spine, left/right sub-lesson branches, bounded 2D tree panning and zooming, prerequisite links, and the Chapter Overview drawer.',
      notes:
        'Each course tree arranges chapters down the center spine with sub-lessons branching left and right, plus a Checklist View tab for linear study.',
      lessons: [
        {
          id: 'guide101-ch2-l1-chapters-vs-sub-lessons',
          title: 'Chapters vs Sub-Lessons',
          summary:
            'Dark-bordered boxes down the center spine represent major chapters, while cream-colored branch nodes represent sub-lessons inside each chapter. Drag with your mouse or swipe on touchscreens to freely pan the bounded 2D tree canvas in any direction, zoom from 50% up to 250%, or switch to the linear Checklist View.',
          notes:
            'In Tree View, lessons can sit on the left branch, the right branch, or be auto-balanced along the chapter, and panning is clamped to the tree bounds so the syllabus never gets lost off-screen.\nChecklist View groups those same items into collapsible chapter sections, stacking chapter tags vertically on smaller mobile screens so long chapter titles always have room.',
          side: 'left',
          resources: [
            {
              title: 'Visual Learning Roadmaps Guide',
              url: 'https://roadmap.sh/get-started',
              kind: 'official',
              recommended: true,
            },
          ],
        },
        {
          id: 'guide101-ch2-l2-prerequisites',
          title: 'Prerequisites',
          summary:
            'Both chapters and sub-lessons can declare prerequisites pointing to earlier chapters or lessons within the same course. Open any item drawer to see clickable prerequisite chips that show completion status and jump directly to that topic.',
          notes:
            'Cross-chapter prerequisites help connect foundational modules to later capstone work.\nCompleted prerequisites display a green check inside their chip so you know you are ready to proceed.',
          side: 'right',
          prerequisites: ['guide101-ch2-l1-chapters-vs-sub-lessons'],
          resources: [
            {
              title: 'Prerequisite Graphs in Curriculum Design',
              url: 'https://en.wikipedia.org/wiki/Topological_sorting',
              kind: 'document',
            },
          ],
        },
        {
          id: 'guide101-ch2-l3-chapter-overview',
          title: 'Chapter Overview',
          summary:
            'Clicking any chapter node on the spine opens the Chapter Overview drawer with a top-right Ch1 badge rather than jumping into its first lesson. Inside, you can switch between Overview and Notes tabs, review prerequisites and chapter-level materials, and toggle sub-lesson completion directly.',
          notes:
            'Lesson drawers display a matching sky-blue Ch2 / L1 badge in the top-right corner so you always know your exact syllabus position.\nMulti-lesson chapters hide the empty Chapter Materials box automatically when no chapter-level materials are attached, and the Notes tab appears only when study notes are present.\nThe URL updates to ?chapter=<id> or ?lesson=<id>, making links shareable and refresh-safe.',
          side: 'left',
          prerequisites: ['guide101-ch2-l1-chapters-vs-sub-lessons'],
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
      weekRange: 'Week 3',
      description:
        'Mark lessons and single-unit chapters as Learning, Done, or Skip, and learn how skipping adjusts required completion totals.',
      notes:
        'Progress is stored locally per browser in localStorage under college_course_trees_progress_v1.',
      lessons: [
        {
          id: 'guide101-ch3-l1-learning-done-skip',
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
              kind: 'document',
            },
          ],
        },
        {
          id: 'guide101-ch3-l2-right-click-shift-click',
          title: 'Right-click & Shift+Click',
          summary:
            'You do not have to open a drawer just to update your progress on the tree. Right-click any lesson or single-unit chapter node for a quick status pill, or hold Shift and click a node to toggle Done immediately.',
          notes:
            'You can also filter the tree canvas by All, Todo, Learning, Done, or Skipped using the progress strip filter pills.\nIn Checklist View or Chapter Overview, clicking the status button on any row toggles Done directly.',
          side: 'right',
          prerequisites: ['guide101-ch3-l1-learning-done-skip'],
          resources: [
            {
              title: 'Interactive Tree Controls Summary',
              url: 'https://roadmap.sh/about',
              kind: 'official',
            },
          ],
        },
        {
          id: 'guide101-ch3-l3-keyboard-shortcuts-l-d-s-esc',
          title: 'Keyboard Shortcuts L/D/S/←/→/Esc',
          summary:
            'While a lesson drawer or single-unit chapter drawer is open, press L for Learning, D for Done, or S for Skip to toggle that status. Press Left or Right Arrow to move between trackable items, and Esc to close the drawer.',
          notes:
            'Pressing the active status key a second time resets the item back to Todo.\nKeyboard shortcuts automatically ignore keystrokes while typing inside inputs or textareas.',
          side: 'left',
          prerequisites: ['guide101-ch3-l1-learning-done-skip'],
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
      weekRange: 'Week 4-5',
      description:
        'Build new courses from scratch with clean default/placeholder fields, set From → To week ranges, collapse or expand chapters and sub-lessons, and attach URL links or uploaded study files.',
      notes:
        'When you open the editor, existing chapters and lessons start collapsed by default for a clean bird’s-eye view, while any newly added chapter or sub-lesson opens expanded automatically.',
      lessons: [
        {
          id: 'guide101-ch4-l1-new-course-derived-ids',
          title: 'New Course & Derived IDs',
          summary:
            'Click + New Course in the navbar to open the course editor. Required fields start with a sensible default and a placeholder (shown if cleared), while optional fields (Year, Semester, Credits, From → To week range, and Notes) start completely empty with helpful placeholders. Chapter and lesson IDs are automatically derived from the course code, compact position tag (Ch2 / L1), and title.',
          notes:
            'Because progress is remapped using an oldId-to-newId map on save, renaming a tracked lesson or changing a course code never orphans your Done/Learning/Skipped history or saved quiz scores.\nIf a required field is left blank, clicking Save highlights the invalid fields in red and shows the first validation issue in the sticky top bar.',
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
          id: 'guide101-ch4-l2-chapters-lessons-direct-milestones',
          title: 'Chapters, Lessons & Direct Milestones',
          summary:
            'Each chapter includes optional positive-integer From → To week fields: leave both empty for no label, fill From only (or equal From and To) for Week 1, or set a span for Week 1-2 (the To input stays disabled until From has a value). Chapters and burnt-peach-accented sub-lesson cards can be collapsed individually or all at once via Collapse all.',
          notes:
            'Existing chapters and lessons start collapsed when loading the editor so you can scan or reorder large courses effortlessly, while clicking Add Chapter or Add Sub-Lesson expands the new card immediately.\nChapters with 0 sub-lessons act as direct milestones on the spine for midterms, capstones, or final exams.',
          side: 'right',
          prerequisites: ['guide101-ch4-l1-new-course-derived-ids'],
          resources: [
            {
              title: 'Modular Curriculum Design Notes',
              url: 'https://cft.vanderbilt.edu/guides-sub-pages/understanding-by-design/',
              kind: 'document',
            },
          ],
        },
        {
          id: 'guide101-ch4-l3-uploading-materials',
          title: 'Uploading Materials',
          summary:
            'Material rows support Link and Upload modes (plus Interactive mode when Exam or Assignment is selected) and a Recommended pin toggle. Uploaded files (stored in IndexedDB with no size cap, including Audio files) and supported cloud/video links open inside the fast in-app Material Viewer, while Interactive items launch the built-in LaTeX Exam and Assignment runner.',
          notes:
            'The Material Viewer renders uploaded PDFs, videos (with playback speed and keyboard shortcuts), centered audio players, zoomable images, line-numbered code/text, YouTube/Vimeo, Google Drive/Docs/Slides/Sheets, and OneDrive/SharePoint embeds (with an Open in new tab fallback card when direct framing is unavailable).\nInteractive Exams and Assignments can be built visually on the spot or imported/exported as .assessment.json with KaTeX math and optional question header images.\nDangerous extensions such as .exe, .bat, .sh, .ps1, .html, and .svg are blocked for safety.',
          side: 'left',
          prerequisites: ['guide101-ch4-l2-chapters-lessons-direct-milestones'],
          resources: [
            {
              title: 'IndexedDB Browser Storage Overview',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
              kind: 'official',
            },
          ],
        },
      ],
      supplements: [
        {
          id: 'guide101-ch4-s1-supplements-overview',
          title: 'Supplements Overview',
          summary:
            'Teal-accented Supplements can sit on the main spine, under a chapter, or off any sub-lesson—with typed custom fields and an optional informational-only toggle.',
          notes:
            'Supplements support materials, prerequisites, and notes just like chapters and lessons.\nThis supplement is marked Informational (trackable: false), so it shows a dashed border on the tree and does not affect your course completion percentage.',
          side: 'right',
          trackable: false,
          customFields: [
            { label: 'Color Family', value: 'Teal', type: 'badge' },
            { label: 'Placements', value: 'Spine, Chapter, Lesson', type: 'text' },
          ],
          resources: [],
        },
      ],
    },
    {
      id: 'guide101-ch5-backup-import-export',
      order: 5,
      title: '5. Backup, Import & Export',
      weekRange: 'Week 6',
      description:
        'Milestone chapter covering course export (.course.json), course import into new drafts, and per-user progress backup.',
      notes:
        'Use Export Course in any course header to download a portable .course.json file—with "Include uploaded files" checked by default to embed IndexedDB attachments (including assessment header images) as base64, or unchecked for a lightweight link-only export.\nOn the New Course page, click Import Course to load a .course.json or bare course object (with automatic slug conflict resolution), and use Backup Progress inside any course header to export or restore your completion statuses, bookmarks, and interactive assessment scores.',
      prerequisites: [
        'guide101-ch4-creating-editing-courses',
        'guide101-ch4-l1-new-course-derived-ids',
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
          kind: 'document',
        },
      ],
      lessons: [],
    },
    {
      id: 'guide101-ch6-dark-mode-data-formats',
      order: 6,
      title: '6. Dark Mode & Data Formats',
      description:
        'Milestone chapter covering Light/Dark/System theme switching and the built-in Data Formats & LLM Authoring Guide.',
      notes:
        'Click the theme toggle button in the top navbar to cycle between Light, Dark, and System modes; Light and Dark themes adapt across the homepage catalog, course cards, editor, drawers, and modals while keeping only the top Navbar dark.\nVisit the Data formats documentation page linked at the bottom of the homepage for a structured Table of Contents, complete .course.json and .assessment.json schemas, KaTeX LaTeX syntax guide, copyable JSON examples, and LLM prompts for generating courses and exams.',
      prerequisites: ['guide101-ch5-backup-import-export'],
      resources: [
        {
          title: 'Prefers-Color-Scheme & Accessible Contrast',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme',
          kind: 'document',
        },
      ],
      lessons: [],
    },
  ],
  supplements: [
    {
      id: 'guide101-s1-supplements-sandbox',
      title: 'Supplements Sandbox',
      summary:
        'A spine-level Supplement placed after Chapter 6 with a child Supplement and typed custom fields.',
      notes:
        'Spine Supplements can be placed before, between, or after any chapter using afterChapterOrder, and can host child Supplements.',
      afterChapterOrder: 6,
      prerequisites: ['guide101-ch6-dark-mode-data-formats'],
      customFields: [
        { label: 'Role', value: 'Interactive Guide', type: 'badge' },
        { label: 'Format Docs', value: 'https://courser.app/docs/data-formats', type: 'link' },
      ],
      resources: [],
      children: [
        {
          id: 'guide101-s1-s1-trying-custom-fields',
          title: 'Trying Custom Fields',
          summary:
            'Inspect typed custom fields (text, link, badge, date) in the Teal Supplement drawer and toggle completion like any lesson.',
          side: 'left',
          customFields: [
            { label: 'Field Types', value: 'text, link, badge, date', type: 'text' },
          ],
          resources: [],
        },
      ],
    },
  ],
};
