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
  statusSkippedFill: '#496b69',
  statusSkippedText: '#ffffff',
  canvasBg: '#f9fafb',
  darkNavBg: '#0f172b',
} as const;

export const RESOURCE_BADGE_STYLES = {
  lab: { label: 'Lab', className: 'bg-green-400 text-black' },
  course: { label: 'Course', className: 'bg-green-400 text-black' },
  slides: { label: 'Slides', className: 'bg-yellow-300 text-black' },
  reading: { label: 'Reading', className: 'bg-yellow-300 text-black' },
  video: { label: 'Video', className: 'bg-purple-300 text-black' },
  official: { label: 'Official', className: 'bg-blue-600 text-white' },
  textbook: { label: 'Textbook', className: 'bg-blue-600 text-white' },
  exam: { label: 'Exam', className: 'bg-black text-white' },
  assignment: { label: 'Assignment', className: 'bg-black text-white' },
} as const;

export type ResourceKindKey = keyof typeof RESOURCE_BADGE_STYLES;
