import type { CourseTree } from '@/types/course';

export interface CourseExportAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface CourseExportEnvelope {
  format: 'college-course-tree';
  version: 1;
  exportedAt: string;
  course: CourseTree;
  attachments?: CourseExportAttachment[];
}

export const EXAMPLE_COURSE_EXPORT: CourseExportEnvelope = {
  format: 'college-course-tree',
  version: 1,
  exportedAt: '2026-11-21T00:00:00.000Z',
  course: {
    slug: 'stat101-probability-statistics',
    code: 'STAT101',
    title: 'Probability & Statistics',
    department: 'Preparatory',
    year: 1,
    semester: 1,
    credits: 3,
    description:
      'Foundational descriptive statistics, probability rules, common distributions, and an applied data lab capstone.',
    chapters: [
      {
        id: 'stat101-ch1-descriptive-statistics',
        order: 1,
        title: '1. Descriptive Statistics',
        weekRange: 'Weeks 1–3',
        description:
          'Summarizing distributions numerically and visually before formal probability modeling.',
        notes:
          'Compare mean and standard deviation against median and IQR whenever a dataset is skewed or has outliers.',
        resources: [
          {
            title: 'Chapter 1 Overview Slides',
            kind: 'slides',
            recommended: true,
            url: 'https://example.edu/stat101/ch1-overview-slides.pdf',
          },
        ],
        lessons: [
          {
            id: 'stat101-ch1-l1-summary-measures-histograms',
            title: 'Summary Measures & Histograms',
            summary:
              'Compute mean, median, and quartiles, and interpret histogram bin shapes.',
            side: 'left',
            resources: [
              {
                title: 'Lecture 01 Slides: Center & Spread',
                kind: 'slides',
                url: 'https://example.edu/stat101/lecture-01-slides.pdf',
              },
              {
                title: 'Visualizing Distributions Video',
                kind: 'video',
                url: 'https://example.edu/stat101/distributions-video',
              },
            ],
          },
          {
            id: 'stat101-ch1-l2-variance-standard-deviation',
            title: 'Variance & Standard Deviation',
            summary:
              'Quantify spread around the mean and compare standardized z-scores across scales.',
            side: 'right',
            prerequisites: ['stat101-ch1-l1-summary-measures-histograms'],
            resources: [
              {
                title: 'OpenIntro Chapter 2 Notes',
                kind: 'document',
                url: 'https://example.edu/stat101/openintro-ch2',
              },
            ],
          },
        ],
      },
      {
        id: 'stat101-ch2-probability-distributions',
        order: 2,
        title: '2. Probability & Distributions',
        weekRange: 'Weeks 4–7',
        description:
          'Conditional probability, Bayes rule, and discrete and continuous probability models.',
        prerequisites: ['stat101-ch1-descriptive-statistics'],
        lessons: [
          {
            id: 'stat101-ch2-l1-conditional-probability-bayes',
            title: 'Conditional Probability & Bayes',
            summary:
              'Evaluate conditional events, independence, and posterior updates using Bayes theorem.',
            notes:
              'Sketch a probability tree first when solving multi-stage diagnostic testing problems.',
            side: 'left',
            prerequisites: ['stat101-ch1-descriptive-statistics'],
            resources: [
              {
                title: 'Probability & Bayes Textbook Section',
                kind: 'textbook',
                url: 'https://example.edu/stat101/bayes-textbook',
              },
              {
                title: 'Problem Set 2: Conditional Events',
                kind: 'assignment',
                url: 'https://example.edu/stat101/pset-2',
              },
            ],
          },
          {
            id: 'stat101-ch2-l2-normal-binomial-models',
            title: 'Normal & Binomial Models',
            summary:
              'Model repeated Bernoulli trials and approximate tail probabilities with normal curves.',
            side: 'right',
            prerequisites: [
              'stat101-ch2-l1-conditional-probability-bayes',
              'stat101-ch1-l2-variance-standard-deviation',
            ],
            resources: [
              {
                title: 'Normal & Binomial Walkthrough Video',
                kind: 'video',
                url: 'https://example.edu/stat101/normal-binomial-video',
              },
              {
                title: 'Midterm Practice Exam',
                kind: 'exam',
                recommended: true,
                assessment: {
                  mode: 'exam',
                  instructions:
                    'Solve each probability and distribution question. Standardize normal variables with $Z = \\frac{X - \\mu}{\\sigma}$.',
                  timeLimitMinutes: 20,
                  passingScorePercent: 70,
                  questions: [
                    {
                      id: 'stat101-q1-zscore',
                      type: 'mcq',
                      header: {
                        text: 'If $X \\sim \\mathcal{N}(\\mu = 70, \\sigma = 10)$, what is the standardized score $Z = \\frac{X - \\mu}{\\sigma}$ when $X = 85$?',
                      },
                      options: ['0.5', '1.5', '2.0', '-1.5'],
                      correctIndices: [1],
                      points: 1,
                      explanation:
                        'Substitute into $Z = \\frac{85 - 70}{10} = \\frac{15}{10} = 1.5$.',
                    },
                    {
                      id: 'stat101-q2-binomial-mean',
                      type: 'short-answer',
                      header: {
                        text: 'For $Y \\sim \\text{Binomial}(n = 40, p = 0.25)$, compute the expected value $\\mathbb{E}[Y] = np$.',
                      },
                      acceptedAnswers: ['10'],
                      points: 1,
                      explanation: 'The binomial expectation is $np = 40 \\times 0.25 = 10$.',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: 'stat101-ch3-applied-data-lab-capstone',
        order: 3,
        title: '3. Applied Data Lab Capstone',
        weekRange: 'Weeks 8–10',
        description:
          'Direct project chapter applying descriptive statistics and distribution checks to a real dataset.',
        notes:
          'Milestone chapter (lessons: []): learners can track this milestone directly from the tree or checklist.',
        prerequisites: ['stat101-ch2-l2-normal-binomial-models'],
        resources: [
          {
            title: 'Capstone Data Analysis Lab',
            kind: 'lab',
            url: 'https://example.edu/stat101/capstone-lab',
          },
          {
            title: 'Official Capstone Rubric',
            kind: 'official',
            url: 'https://example.edu/stat101/capstone-rubric',
          },
        ],
        lessons: [],
      },
    ],
  },
};
