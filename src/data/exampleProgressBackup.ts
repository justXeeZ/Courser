import type { ProgressState } from '@/lib/storage/types';

export const EXAMPLE_PROGRESS_BACKUP: ProgressState = {
  version: 1,
  statuses: {
    'stat101-probability-statistics': {
      'stat101-ch1-l1-summary-measures-histograms': 'done',
      'stat101-ch1-l2-variance-standard-deviation': 'done',
      'stat101-ch2-l1-conditional-probability-bayes': 'learning',
      'stat101-ch2-l2-normal-binomial-models': 'skipped',
      'stat101-ch3-applied-data-lab-capstone': 'learning',
    },
  },
  bookmarks: ['stat101-probability-statistics'],
  assessmentScores: {
    'stat101-probability-statistics': {
      'stat101-ch2-l2-normal-binomial-models::Midterm Practice Exam': {
        bestScorePercent: 90,
        latestScorePercent: 90,
        attempts: 2,
        passed: true,
        updatedAt: '2026-11-21T00:00:00.000Z',
      },
    },
  },
};
