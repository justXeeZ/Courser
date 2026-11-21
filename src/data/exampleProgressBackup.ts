import type { ProgressState } from '@/lib/storage/types';

export const EXAMPLE_PROGRESS_BACKUP: ProgressState = {
  version: 1,
  statuses: {
    'stat101-probability-statistics': {
      'stat101-summary-measures-histograms': 'done',
      'stat101-variance-standard-deviation': 'done',
      'stat101-conditional-probability-bayes': 'learning',
      'stat101-normal-binomial-models': 'skipped',
      'stat101-ch3-applied-data-lab-capstone': 'learning',
    },
  },
  bookmarks: ['stat101-probability-statistics'],
};
