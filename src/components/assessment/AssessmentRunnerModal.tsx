import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  HelpCircle,
  ListChecks,
  Play,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ResourceBadge } from '@/components/ResourceBadge';
import { RichMathText } from '@/components/RichMathText';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { getFile } from '@/lib/fileStore';
import { isSafeHttpUrl } from '@/lib/materialValidation';
import { useProgress } from '@/store/useProgressStore';
import type {
  AssessmentData,
  AssessmentQuestion,
  LessonResource,
  StoredFileRef,
} from '@/types/course';

export interface AssessmentRunnerModalProps {
  isOpen: boolean;
  courseSlug: string;
  itemId: string;
  resource: LessonResource;
  onClose: () => void;
}

export type UserAnswer = number | number[] | string | null;

export interface QuestionGrade {
  question: AssessmentQuestion;
  answered: boolean;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
  userAnswer: UserAnswer;
}

export interface GradedAssessmentResult {
  earnedPoints: number;
  totalPoints: number;
  scorePercent: number;
  passThreshold: number;
  passed: boolean;
  questionGrades: QuestionGrade[];
}

type RunnerPhase = 'overview' | 'active' | 'review' | 'results';
type ResultFilter = 'all' | 'incorrect' | 'unanswered' | 'flagged';

function getTrueFalseOptions(q: AssessmentQuestion): string[] {
  return q.options && q.options.length === 2 ? q.options : ['True', 'False'];
}

function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isQuestionAnswered(
  question: AssessmentQuestion,
  answer: UserAnswer | undefined
): boolean {
  if (question.type === 'mcq' || question.type === 'true-false') {
    return typeof answer === 'number';
  }
  if (question.type === 'multi-select') {
    return Array.isArray(answer) && answer.length > 0;
  }
  return typeof answer === 'string' && answer.trim().length > 0;
}

export function gradeQuestion(
  question: AssessmentQuestion,
  answer: UserAnswer | undefined
): QuestionGrade {
  const maxPoints = question.points ?? 1;
  const answered = isQuestionAnswered(question, answer);
  let isCorrect = false;

  if (question.type === 'mcq' || question.type === 'true-false') {
    isCorrect =
      typeof answer === 'number' &&
      question.correctIndices?.length === 1 &&
      answer === question.correctIndices[0];
  } else if (question.type === 'multi-select') {
    const expected = new Set(question.correctIndices ?? []);
    if (Array.isArray(answer) && expected.size > 0) {
      const actual = new Set(answer);
      isCorrect =
        actual.size === expected.size &&
        Array.from(expected).every((idx) => actual.has(idx));
    }
  } else if (question.type === 'short-answer') {
    if (typeof answer === 'string' && answer.trim().length > 0) {
      const normalized = question.caseSensitive
        ? answer.trim()
        : answer.trim().toLowerCase();
      isCorrect = (question.acceptedAnswers ?? []).some((accepted) => {
        const expected = question.caseSensitive
          ? accepted.trim()
          : accepted.trim().toLowerCase();
        return normalized === expected;
      });
    }
  }

  return {
    question,
    answered,
    isCorrect,
    earnedPoints: isCorrect ? maxPoints : 0,
    maxPoints,
    userAnswer: answer ?? null,
  };
}

export function gradeAssessment(
  assessment: AssessmentData,
  answers: Record<string, UserAnswer>,
  orderedQuestions: AssessmentQuestion[] = assessment.questions
): GradedAssessmentResult {
  const questionGrades = orderedQuestions.map((q) => gradeQuestion(q, answers[q.id]));
  const totalPoints = questionGrades.reduce((sum, g) => sum + g.maxPoints, 0);
  const earnedPoints = questionGrades.reduce((sum, g) => sum + g.earnedPoints, 0);
  const scorePercent =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passThreshold = assessment.passingScorePercent ?? 70;
  const passed = scorePercent >= passThreshold;

  return {
    earnedPoints,
    totalPoints,
    scorePercent,
    passThreshold,
    passed,
    questionGrades,
  };
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatPointsLabel(points: number): string {
  return points === 1 ? '1 pt' : `${points} pts`;
}

function formatUserAnswerLabel(
  q: AssessmentQuestion,
  answer: UserAnswer
): string {
  if (!isQuestionAnswered(q, answer)) return 'Unanswered';
  if (q.type === 'mcq' || q.type === 'true-false') {
    const opts = q.type === 'true-false' ? getTrueFalseOptions(q) : (q.options ?? []);
    return typeof answer === 'number' && opts[answer] !== undefined
      ? opts[answer]
      : 'Unanswered';
  }
  if (q.type === 'multi-select') {
    const opts = q.options ?? [];
    const selected = Array.isArray(answer)
      ? [...answer].sort((a, b) => a - b).map((idx) => opts[idx] ?? String(idx))
      : [];
    return selected.length > 0 ? selected.join(', ') : 'Unanswered';
  }
  return typeof answer === 'string' ? answer.trim() : 'Unanswered';
}

function formatCorrectAnswerLabel(q: AssessmentQuestion): string {
  if (q.type === 'mcq' || q.type === 'true-false') {
    const opts = q.type === 'true-false' ? getTrueFalseOptions(q) : (q.options ?? []);
    const idx = q.correctIndices?.[0];
    return idx !== undefined && opts[idx] !== undefined ? opts[idx] : '';
  }
  if (q.type === 'multi-select') {
    const opts = q.options ?? [];
    return [...(q.correctIndices ?? [])]
      .sort((a, b) => a - b)
      .map((idx) => opts[idx] ?? String(idx))
      .join(', ');
  }
  return (q.acceptedAnswers ?? []).join(' / ');
}

function QuestionHeaderImage({
  imageFile,
  imageUrl,
}: {
  imageFile?: StoredFileRef;
  imageUrl?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!imageFile?.id) {
      setObjectUrl(null);
      setMissing(false);
      return;
    }

    setObjectUrl(null);
    setMissing(false);

    getFile(imageFile.id)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setMissing(true);
          return;
        }
        createdUrl = URL.createObjectURL(record.blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          createdUrl = null;
          return;
        }
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
        createdUrl = null;
      }
    };
  }, [imageFile?.id]);

  if (imageFile) {
    if (missing) {
      return (
        <p className="text-xs text-[var(--status-warning-text)]">
          Image &ldquo;{imageFile.name}&rdquo; unavailable in local storage.
        </p>
      );
    }
    if (!objectUrl) {
      return (
        <p className="text-xs text-[var(--text-muted)]">
          Loading image...
        </p>
      );
    }
    return (
      <img
        src={objectUrl}
        alt={imageFile.name}
        className="max-h-64 rounded-lg border border-[var(--border-subtle)] object-contain"
      />
    );
  }

  if (imageUrl && isSafeHttpUrl(imageUrl)) {
    return (
      <img
        src={imageUrl.trim()}
        alt="Question illustration"
        className="max-h-64 rounded-lg border border-[var(--border-subtle)] object-contain"
      />
    );
  }

  return null;
}

export function AssessmentRunnerModal({
  isOpen,
  courseSlug,
  itemId,
  resource,
  onClose,
}: AssessmentRunnerModalProps) {
  const titleId = useId();
  const { recordAssessmentScore } = useProgress();
  const assessment = resource.assessment;

  const [phase, setPhase] = useState<RunnerPhase>('overview');
  const [orderedQuestions, setOrderedQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [hintOpenIds, setHintOpenIds] = useState<Record<string, boolean>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [gradedResult, setGradedResult] = useState<GradedAssessmentResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState<boolean>(false);
  const [navOpenMobile, setNavOpenMobile] = useState<boolean>(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState<boolean>(false);
  const [confirmUnansweredOpen, setConfirmUnansweredOpen] = useState<boolean>(false);
  const scoreRecordedRef = useRef<boolean>(false);

  const initAttempt = useCallback(() => {
    if (!assessment) return;
    const questions = assessment.shuffleQuestions
      ? shuffleArray(assessment.questions)
      : [...assessment.questions];
    setPhase('overview');
    setOrderedQuestions(questions);
    setCurrentIndex(0);
    setAnswers({});
    setCheckedIds({});
    setHintOpenIds({});
    setFlaggedIds(new Set());
    setGradedResult(null);
    setSecondsLeft(
      assessment.mode === 'exam' && assessment.timeLimitMinutes
        ? assessment.timeLimitMinutes * 60
        : null
    );
    setInstructionsOpen(false);
    setNavOpenMobile(false);
    setResultFilter('all');
    setConfirmLeaveOpen(false);
    setConfirmUnansweredOpen(false);
    scoreRecordedRef.current = false;
  }, [assessment]);

  useEffect(() => {
    if (!isOpen || !assessment) return;
    initAttempt();
  }, [isOpen, courseSlug, itemId, resource, assessment, initAttempt]);

  const handleRequestClose = useCallback(() => {
    if (phase === 'active' || phase === 'review') {
      setConfirmLeaveOpen(true);
      return;
    }
    onClose();
  }, [phase, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen,
    containerRef: dialogRef,
    onEscape: handleRequestClose,
  });

  const finalizeSubmission = useCallback(() => {
    if (!assessment || scoreRecordedRef.current) return;
    scoreRecordedRef.current = true;
    const result = gradeAssessment(assessment, answers, orderedQuestions);
    setGradedResult(result);
    setPhase('results');
    setConfirmUnansweredOpen(false);
    setConfirmLeaveOpen(false);
    recordAssessmentScore(
      courseSlug,
      itemId,
      resource.title,
      result.scorePercent,
      result.passed
    );
  }, [assessment, answers, orderedQuestions, recordAssessmentScore, courseSlug, itemId, resource.title]);

  // Countdown tick in exam mode ONLY while active or in pre-submit review
  useEffect(() => {
    if (
      !isOpen ||
      !assessment ||
      assessment.mode !== 'exam' ||
      (phase !== 'active' && phase !== 'review') ||
      secondsLeft === null ||
      secondsLeft <= 0
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isOpen, assessment, phase, secondsLeft]);

  // Auto-submit at 00:00 using current render's answers (no stale closure)
  useEffect(() => {
    if (
      isOpen &&
      assessment?.mode === 'exam' &&
      (phase === 'active' || phase === 'review') &&
      secondsLeft === 0
    ) {
      finalizeSubmission();
    }
  }, [isOpen, assessment, phase, secondsLeft, finalizeSubmission]);

  const totalPoints = useMemo(
    () => orderedQuestions.reduce((sum, q) => sum + (q.points ?? 1), 0),
    [orderedQuestions]
  );

  const answeredCount = useMemo(
    () =>
      orderedQuestions.filter((q) => isQuestionAnswered(q, answers[q.id])).length,
    [orderedQuestions, answers]
  );

  const unansweredCount = orderedQuestions.length - answeredCount;
  const flaggedCount = flaggedIds.size;

  if (!isOpen || !assessment || orderedQuestions.length === 0) return null;

  const isExam = assessment.mode === 'exam';
  const currentQuestion = orderedQuestions[currentIndex] ?? orderedQuestions[0];
  const currentAnswer = answers[currentQuestion.id];
  const isChecked = !isExam && Boolean(checkedIds[currentQuestion.id]);
  const isHintOpen = !isExam && Boolean(hintOpenIds[currentQuestion.id]);
  const isFlagged = isExam && flaggedIds.has(currentQuestion.id);
  const currentGrade = isChecked
    ? gradeQuestion(currentQuestion, currentAnswer)
    : null;

  const optionsForCurrent =
    currentQuestion.type === 'true-false'
      ? getTrueFalseOptions(currentQuestion)
      : (currentQuestion.options ?? []);

  const progressPercent =
    orderedQuestions.length > 0
      ? Math.round((answeredCount / orderedQuestions.length) * 100)
      : 0;

  const handleSubmitFromReview = () => {
    if (unansweredCount > 0) {
      setConfirmUnansweredOpen(true);
      return;
    }
    finalizeSubmission();
  };

  const renderNavigatorPills = () => (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
      {orderedQuestions.map((q, idx) => {
        const answered = isQuestionAnswered(q, answers[q.id]);
        const flagged = isExam && flaggedIds.has(q.id);
        const checked = !isExam && Boolean(checkedIds[q.id]);
        const checkedGrade = checked ? gradeQuestion(q, answers[q.id]) : null;
        const isCurrent = idx === currentIndex;

        let pillColor =
          'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]';
        if (checkedGrade) {
          pillColor = checkedGrade.isCorrect
            ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
            : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
        } else if (flagged) {
          pillColor =
            'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
        } else if (answered) {
          pillColor =
            'border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)] text-[var(--accent-purple-text)]';
        }

        return (
          <button
            key={q.id}
            type="button"
            aria-label={`Jump to question ${idx + 1}${flagged ? ' (flagged)' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            onClick={() => {
              setCurrentIndex(idx);
              setNavOpenMobile(false);
            }}
            className={`inline-flex h-8 items-center justify-center gap-0.5 rounded-md border px-1.5 font-mono text-xs font-semibold transition-colors ${pillColor} ${
              isCurrent ? 'ring-2 ring-[var(--border-focus)] ring-offset-1 ring-offset-[var(--surface-1)]' : ''
            }`}
          >
            <span>{idx + 1}</span>
            {flagged && <Flag className="h-2.5 w-2.5 fill-current" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-2 sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-primary)] shadow-2xl"
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ResourceBadge kind={resource.kind} />
            <h2 id={titleId} className="truncate text-sm font-bold sm:text-base">
              {resource.title}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {isExam &&
              secondsLeft !== null &&
              (phase === 'active' || phase === 'review') && (
                <div
                  aria-label="Time remaining"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold ${
                    secondsLeft <= 60
                      ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-primary)]'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimer(secondsLeft)}
                </div>
              )}

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Close assessment"
              className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Phase 1: Pre-Start Overview */}
        {phase === 'overview' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="space-y-2">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--accent-purple-text)]">
                  {isExam ? 'Timed Exam Overview' : 'Practice Assignment Overview'}
                </p>
                <h3 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                  {resource.title}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Questions
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {orderedQuestions.length}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Total Points
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {formatPointsLabel(totalPoints)}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Pass Score
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {assessment.passingScorePercent ?? 70}%
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Time Limit
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {isExam && assessment.timeLimitMinutes
                      ? `${assessment.timeLimitMinutes} min`
                      : 'Untimed'}
                  </div>
                </div>
              </div>

              {assessment.instructions?.trim() && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Instructions
                  </div>
                  <RichMathText text={assessment.instructions} as="div" />
                </div>
              )}

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4 text-xs text-[var(--text-secondary)]">
                {isExam ? (
                  <p>
                    Exam mode: hints and instant answer checking are disabled until submission.
                    You can flag questions for review and jump between questions before submitting.
                    {assessment.timeLimitMinutes
                      ? ' The timer starts when you click Start Exam.'
                      : ''}
                  </p>
                ) : (
                  <p>
                    Assignment mode: you can reveal hints and check each answer as you go before
                    submitting your final score.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('active')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--cta-bg)] px-5 py-2 text-sm font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isExam ? 'Start Exam' : 'Start Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Active Question View */}
        {phase === 'active' && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Progress & Mobile Navigator Bar */}
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
                    Question {currentIndex + 1} of {orderedQuestions.length}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {answeredCount}/{orderedQuestions.length} answered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {assessment.instructions?.trim() && (
                    <button
                      type="button"
                      onClick={() => setInstructionsOpen((v) => !v)}
                      aria-expanded={instructionsOpen}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      Instructions
                      {instructionsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setNavOpenMobile((v) => !v)}
                    aria-expanded={navOpenMobile}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] lg:hidden"
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Questions
                  </button>
                </div>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-[var(--cta-bg)] transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {instructionsOpen && assessment.instructions?.trim() && (
                <div className="mt-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-secondary)]">
                  <RichMathText text={assessment.instructions} as="div" />
                </div>
              )}

              {navOpenMobile && (
                <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 lg:hidden">
                  {renderNavigatorPills()}
                </div>
              )}
            </div>

            {/* Main 2-Column Body */}
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_240px]">
              {/* Left: Question Card */}
              <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                    Question {currentIndex + 1} of {orderedQuestions.length} ·{' '}
                    {formatPointsLabel(currentQuestion.points ?? 1)}
                  </span>

                  <div className="flex items-center gap-2">
                    {!isExam && currentQuestion.hint?.trim() && (
                      <button
                        type="button"
                        onClick={() =>
                          setHintOpenIds((prev) => ({
                            ...prev,
                            [currentQuestion.id]: !prev[currentQuestion.id],
                          }))
                        }
                        aria-expanded={isHintOpen}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-[var(--status-warning-text)]" />
                        {isHintOpen ? 'Hide Hint' : 'Show Hint'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Header */}
                <div className="space-y-3">
                  <QuestionHeaderImage
                    imageFile={currentQuestion.header.imageFile}
                    imageUrl={currentQuestion.header.imageUrl}
                  />
                  {currentQuestion.header.text && (
                    <RichMathText
                      text={currentQuestion.header.text}
                      as="div"
                      className="text-base font-medium leading-relaxed text-[var(--text-primary)]"
                    />
                  )}
                </div>

                {/* Hint Panel directly under question header (hidden by default) */}
                {!isExam && isHintOpen && currentQuestion.hint?.trim() && (
                  <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning-text)]">
                    <span className="font-semibold">Hint: </span>
                    <RichMathText text={currentQuestion.hint} />
                  </div>
                )}

                {/* Choices / Input */}
                {(currentQuestion.type === 'mcq' ||
                  currentQuestion.type === 'true-false') && (
                  <div className="space-y-2">
                    {optionsForCurrent.map((opt, idx) => {
                      const selected = currentAnswer === idx;
                      const isOptionCorrect = currentQuestion.correctIndices?.[0] === idx;
                      const keycap = String.fromCharCode(65 + idx);
                      let cardStyle =
                        'border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:bg-[var(--surface-hover)]';
                      let keycapStyle =
                        'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]';
                      if (isChecked && isOptionCorrect) {
                        cardStyle =
                          'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]';
                        keycapStyle =
                          'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]';
                      } else if (isChecked && selected && !isOptionCorrect) {
                        cardStyle =
                          'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
                        keycapStyle =
                          'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
                      } else if (selected) {
                        cardStyle =
                          'border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)]';
                        keycapStyle =
                          'border-[var(--recommended-border)] bg-[var(--cta-bg)] text-[var(--cta-text)]';
                      }

                      return (
                        <label
                          key={idx}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${cardStyle}`}
                        >
                          <input
                            type="radio"
                            name={`answer-${currentQuestion.id}`}
                            checked={selected}
                            disabled={isChecked}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [currentQuestion.id]: idx,
                              }))
                            }
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-xs font-bold ${keycapStyle}`}
                          >
                            {keycap}
                          </span>
                          <RichMathText text={opt} className="flex-1 pt-0.5" />
                        </label>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'multi-select' && (
                  <div className="space-y-2">
                    {optionsForCurrent.map((opt, idx) => {
                      const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
                      const selected = selectedArr.includes(idx);
                      const isOptionCorrect = (
                        currentQuestion.correctIndices ?? []
                      ).includes(idx);
                      const keycap = String.fromCharCode(65 + idx);

                      let cardStyle =
                        'border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:bg-[var(--surface-hover)]';
                      let keycapStyle =
                        'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]';
                      if (isChecked && isOptionCorrect) {
                        cardStyle =
                          'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]';
                        keycapStyle =
                          'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]';
                      } else if (isChecked && selected && !isOptionCorrect) {
                        cardStyle =
                          'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
                        keycapStyle =
                          'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
                      } else if (selected) {
                        cardStyle =
                          'border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)]';
                        keycapStyle =
                          'border-[var(--recommended-border)] bg-[var(--cta-bg)] text-[var(--cta-text)]';
                      }

                      return (
                        <label
                          key={idx}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${cardStyle}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={isChecked}
                            onChange={() =>
                              setAnswers((prev) => {
                                const prevArr = Array.isArray(prev[currentQuestion.id])
                                  ? (prev[currentQuestion.id] as number[])
                                  : [];
                                const nextArr = prevArr.includes(idx)
                                  ? prevArr.filter((i) => i !== idx)
                                  : [...prevArr, idx].sort((a, b) => a - b);
                                return {
                                  ...prev,
                                  [currentQuestion.id]: nextArr,
                                };
                              })
                            }
                            className="mt-1 h-4 w-4 shrink-0 rounded accent-[var(--cta-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-xs font-bold ${keycapStyle}`}
                          >
                            {keycap}
                          </span>
                          <RichMathText text={opt} className="flex-1 pt-0.5" />
                        </label>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'short-answer' && (
                  <div>
                    <input
                      type="text"
                      aria-label="Your answer"
                      disabled={isChecked}
                      value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: e.target.value,
                        }))
                      }
                      placeholder="Type your answer..."
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
                    />
                  </div>
                )}

                {/* Assignment Mode Controls: Check Answer & Instant Feedback */}
                {!isExam && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          isChecked || !isQuestionAnswered(currentQuestion, currentAnswer)
                        }
                        onClick={() =>
                          setCheckedIds((prev) => ({
                            ...prev,
                            [currentQuestion.id]: true,
                          }))
                        }
                        className="rounded-md bg-[var(--solid-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--solid-text)] hover:bg-[var(--solid-bg-hover)] disabled:opacity-45"
                      >
                        Check Answer
                      </button>
                    </div>

                    {isChecked && currentGrade && (
                      <div
                        className={`rounded-lg border p-3 text-xs ${
                          currentGrade.isCorrect
                            ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                            : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold">
                          {currentGrade.isCorrect ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {currentGrade.isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                        {!currentGrade.isCorrect && (
                          <div className="mt-1">
                            <span className="font-semibold">Accepted / Correct: </span>
                            <RichMathText text={formatCorrectAnswerLabel(currentQuestion)} />
                          </div>
                        )}
                        {currentQuestion.explanation?.trim() && (
                          <div className="mt-1.5 border-t border-current/15 pt-1.5">
                            <span className="font-semibold">Explanation: </span>
                            <RichMathText text={currentQuestion.explanation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Desktop Question Navigator Sidebar */}
              <aside className="hidden border-l border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 lg:flex lg:flex-col lg:gap-4 lg:overflow-y-auto">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Question Navigator
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {answeredCount} answered · {unansweredCount} remaining
                    {isExam && flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ''}
                  </p>
                </div>

                {renderNavigatorPills()}

                <div className="mt-auto space-y-1.5 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm border border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)]" />
                    <span>Answered / Active</span>
                  </div>
                  {isExam && (
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]" />
                      <span>Flagged for review</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)]" />
                    <span>Unanswered</span>
                  </div>
                </div>
              </aside>
            </div>

            {/* Sticky Footer Navigation */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-45"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {isExam && (
                  <button
                    type="button"
                    onClick={() =>
                      setFlaggedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(currentQuestion.id)) {
                          next.delete(currentQuestion.id);
                        } else {
                          next.add(currentQuestion.id);
                        }
                        return next;
                      })
                    }
                    aria-label={isFlagged ? 'Unflag question' : 'Flag question'}
                    aria-pressed={isFlagged}
                    title={isFlagged ? 'Unflag question' : 'Flag question'}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                      isFlagged
                        ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <Flag className={`h-4 w-4 ${isFlagged ? 'fill-current' : ''}`} />
                  </button>
                )}

                {currentIndex < orderedQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((i) => Math.min(orderedQuestions.length - 1, i + 1))
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhase('review')}
                    className="rounded-md bg-[var(--cta-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
                  >
                    Review &amp; Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: Pre-Submit Review Screen */}
        {phase === 'review' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Review Before Submitting
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Check your progress below. Click any question to return and edit your answer.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)] p-3">
                  <div className="text-[11px] font-medium text-[var(--accent-purple-text)]">
                    Answered
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-[var(--accent-purple-text)]">
                    {answeredCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    Unanswered
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {unansweredCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3">
                  <div className="text-[11px] font-medium text-[var(--status-warning-text)]">
                    Flagged
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-[var(--status-warning-text)]">
                    {isExam ? flaggedCount : 0}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {orderedQuestions.map((q, idx) => {
                  const ans = answers[q.id];
                  const answered = isQuestionAnswered(q, ans);
                  const flagged = isExam && flaggedIds.has(q.id);
                  const opts =
                    q.type === 'true-false' ? (q.options ?? ['True', 'False']) : (q.options ?? []);

                  let chosenLetters: string | null = null;
                  let chosenText: string | null = null;
                  if (answered) {
                    if ((q.type === 'mcq' || q.type === 'true-false') && typeof ans === 'number') {
                      chosenLetters = String.fromCharCode(65 + ans);
                      chosenText = opts[ans] ?? '';
                    } else if (q.type === 'multi-select' && Array.isArray(ans)) {
                      const sorted = [...ans].sort((a, b) => a - b);
                      chosenLetters = sorted.map((i) => String.fromCharCode(65 + i)).join(', ');
                      chosenText = sorted.map((i) => opts[i] ?? '').join(', ');
                    } else if (typeof ans === 'string') {
                      chosenText = ans.trim();
                    }
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setPhase('active');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                            Q{idx + 1}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              answered
                                ? 'bg-[var(--accent-purple-soft-bg)] text-[var(--accent-purple-text)]'
                                : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                            }`}
                          >
                            {answered ? 'Answered' : 'Unanswered'}
                          </span>
                          {flagged && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-warning-text)]">
                              <Flag className="h-2.5 w-2.5 fill-current" />
                              Flagged
                            </span>
                          )}
                        </div>
                        {q.header.text && (
                          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                            {q.header.text}
                          </p>
                        )}
                      </div>

                      <div className="flex w-36 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs sm:w-52">
                        {answered ? (
                          <>
                            {chosenLetters && (
                              <span className="inline-flex shrink-0 items-center justify-center rounded border border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-purple-text)]">
                                {chosenLetters}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                              {chosenText}
                            </span>
                          </>
                        ) : (
                          <span className="truncate text-[var(--text-muted)]">No answer</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3">
              <button
                type="button"
                onClick={() => setPhase('active')}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                Back to Questions
              </button>

              <button
                type="button"
                onClick={handleSubmitFromReview}
                className="rounded-md bg-[var(--cta-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
              >
                {isExam ? 'Submit Exam' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        )}

        {/* Phase 4: Submitted Results Screen */}
        {phase === 'results' && gradedResult && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-bold sm:text-3xl">
                      {gradedResult.scorePercent}%
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        gradedResult.passed
                          ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                          : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                      }`}
                    >
                      {gradedResult.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {gradedResult.passed ? 'Passed' : 'Not Passed'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Score: {gradedResult.earnedPoints} / {gradedResult.totalPoints} pts · Pass
                    threshold: {gradedResult.passThreshold}%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={initAttempt}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-[var(--cta-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Question Review
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        key: 'all',
                        label: `All (${gradedResult.questionGrades.length})`,
                      },
                      {
                        key: 'incorrect',
                        label: `Incorrect (${gradedResult.questionGrades.filter((g) => g.answered && !g.isCorrect).length})`,
                      },
                      {
                        key: 'unanswered',
                        label: `Unanswered (${gradedResult.questionGrades.filter((g) => !g.answered).length})`,
                      },
                      ...(isExam
                        ? [
                            {
                              key: 'flagged' as const,
                              label: `Flagged (${gradedResult.questionGrades.filter((g) => flaggedIds.has(g.question.id)).length})`,
                            },
                          ]
                        : []),
                    ] as { key: ResultFilter; label: string }[]
                  ).map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      aria-pressed={resultFilter === pill.key}
                      onClick={() => setResultFilter(pill.key)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        resultFilter === pill.key
                          ? 'border-[var(--recommended-border)] bg-[var(--accent-purple-soft-bg)] text-[var(--accent-purple-text)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {gradedResult.questionGrades
                .map((grade, idx) => ({ grade, idx }))
                .filter(({ grade }) => {
                  if (resultFilter === 'incorrect') return grade.answered && !grade.isCorrect;
                  if (resultFilter === 'unanswered') return !grade.answered;
                  if (resultFilter === 'flagged') return flaggedIds.has(grade.question.id);
                  return true;
                })
                .map(({ grade, idx }) => {
                  const userLabel = formatUserAnswerLabel(grade.question, grade.userAnswer);
                  const correctLabel = formatCorrectAnswerLabel(grade.question);
                  return (
                    <div
                      key={grade.question.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--text-muted)]">
                          Question {idx + 1} · {grade.earnedPoints}/{grade.maxPoints} pts
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            !grade.answered
                              ? 'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                              : grade.isCorrect
                                ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                                : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                          }`}
                        >
                          {!grade.answered
                            ? 'Unanswered'
                            : grade.isCorrect
                              ? 'Correct'
                              : 'Incorrect'}
                        </span>
                      </div>

                      <div className="mt-2 space-y-2">
                        <QuestionHeaderImage
                          imageFile={grade.question.header.imageFile}
                          imageUrl={grade.question.header.imageUrl}
                        />
                        {grade.question.header.text && (
                          <RichMathText
                            text={grade.question.header.text}
                            as="div"
                            className="text-sm font-medium text-[var(--text-primary)]"
                          />
                        )}
                      </div>

                      <div className="mt-3 space-y-1 text-xs">
                        <div>
                          <span className="font-semibold text-[var(--text-secondary)]">
                            Your answer:{' '}
                          </span>
                          <RichMathText text={userLabel} />
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--status-done-text)]">
                            Correct answer:{' '}
                          </span>
                          <RichMathText text={correctLabel} />
                        </div>
                        {grade.question.explanation?.trim() && (
                          <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] p-2.5 text-[var(--text-secondary)]">
                            <span className="font-semibold">Explanation: </span>
                            <RichMathText text={grade.question.explanation} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnansweredOpen}
        title="Submit with unanswered questions?"
        description={`You still have ${unansweredCount} unanswered ${unansweredCount === 1 ? 'question' : 'questions'}. Submit anyway?`}
        confirmLabel={isExam ? 'Submit Exam' : 'Submit Assignment'}
        onConfirm={finalizeSubmission}
        onCancel={() => setConfirmUnansweredOpen(false)}
      />

      <ConfirmDialog
        open={confirmLeaveOpen}
        title="Leave assessment?"
        description="Your in-progress answers will be lost if you close now."
        confirmLabel="Leave Assessment"
        onConfirm={() => {
          setConfirmLeaveOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmLeaveOpen(false)}
      />
    </div>
  );
}
