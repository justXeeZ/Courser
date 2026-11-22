export const ROADMAP_COLORS = {
  chapterFill: '#fdff00',
  chapterHover: '#d6d700',
  lessonFill: '#ffe599',
  lessonHover: '#f3c950',
  nodeStroke: '#000000',
  nodeText: '#000000',
  edgeBlue: '#2b78e4',
  statusDoneFill: '#cbcbcb',
  statusLearningFill: '#dad1fd',
  statusSkippedFill: '#64748b',
  statusSkippedText: '#ffffff',
  canvasBg: '#f9fafb',
  darkNavBg: '#0f172b',
} as const;

export const RESOURCE_BADGE_STYLES = {
  slides: {
    label: 'Slides',
    className: 'bg-amber-300 text-slate-950 dark:bg-amber-400/25 dark:text-amber-200',
  },
  video: {
    label: 'Video',
    className: 'bg-purple-300 text-slate-950 dark:bg-purple-400/25 dark:text-purple-200',
  },
  lab: {
    label: 'Lab',
    className: 'bg-emerald-400 text-slate-950 dark:bg-emerald-400/25 dark:text-emerald-200',
  },
  document: {
    label: 'Document',
    className: 'bg-sky-200 text-slate-950 dark:bg-sky-400/20 dark:text-sky-200',
  },
  textbook: {
    label: 'Textbook',
    className: 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950',
  },
  course: {
    label: 'Course',
    className: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
  },
  official: {
    label: 'Official',
    className: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  },
  exam: {
    label: 'Exam',
    className: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950',
  },
  assignment: {
    label: 'Assignment',
    className: 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white',
  },
} as const;

export type ResourceKindKey = keyof typeof RESOURCE_BADGE_STYLES;
