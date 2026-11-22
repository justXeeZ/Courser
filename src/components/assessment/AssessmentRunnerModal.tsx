import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { ResourceBadge } from '@/components/ResourceBadge';
import { RichMathText } from '@/components/RichMathText';
import { getFile } from '@/lib/fileStore';
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

function isSafeHttpUrl(raw?: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

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
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Image &ldquo;{imageFile.name}&rdquo; unavailable in local storage.
        </p>
      );
    }
    if (!objectUrl) {
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Loading image...
        </p>
      );
    }
    return (
      <img
        src={objectUrl}
        alt={imageFile.name}
        className="max-h-64 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
      />
    );
  }

  if (imageUrl && isSafeHttpUrl(imageUrl)) {
    return (
      <img
        src={imageUrl.trim()}
        alt="Question illustration"
        className="max-h-64 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
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

  const [orderedQuestions, setOrderedQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [hintOpenIds, setHintOpenIds] = useState<Record<string, boolean>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [gradedResult, setGradedResult] = useState<GradedAssessmentResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const scoreRecordedRef = useRef<boolean>(false);

  const initAttempt = useCallback(() => {
    if (!assessment) return;
    const questions = assessment.shuffleQuestions
      ? shuffleArray(assessment.questions)
      : [...assessment.questions];
    setOrderedQuestions(questions);
    setCurrentIndex(0);
    setAnswers({});
    setCheckedIds({});
    setHintOpenIds({});
    setFlaggedIds(new Set());
    setSubmitted(false);
    setGradedResult(null);
    setSecondsLeft(
      assessment.mode === 'exam' && assessment.timeLimitMinutes
        ? assessment.timeLimitMinutes * 60
        : null
    );
    scoreRecordedRef.current = false;
  }, [assessment]);

  useEffect(() => {
    if (!isOpen || !assessment) return;
    initAttempt();
  }, [isOpen, courseSlug, itemId, resource, assessment, initAttempt]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const finalizeSubmission = useCallback(() => {
    if (!assessment || scoreRecordedRef.current) return;
    scoreRecordedRef.current = true;
    const result = gradeAssessment(assessment, answers, orderedQuestions);
    setGradedResult(result);
    setSubmitted(true);
    recordAssessmentScore(
      courseSlug,
      itemId,
      resource.title,
      result.scorePercent,
      result.passed
    );
  }, [assessment, answers, orderedQuestions, recordAssessmentScore, courseSlug, itemId, resource.title]);

  // Countdown tick in exam mode
  useEffect(() => {
    if (
      !isOpen ||
      !assessment ||
      assessment.mode !== 'exam' ||
      submitted ||
      secondsLeft === null ||
      secondsLeft <= 0
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isOpen, assessment, submitted, secondsLeft]);

  // Auto-submit at 00:00 using current render's answers (no stale closure)
  useEffect(() => {
    if (
      isOpen &&
      assessment?.mode === 'exam' &&
      !submitted &&
      secondsLeft === 0
    ) {
      finalizeSubmission();
    }
  }, [isOpen, assessment, submitted, secondsLeft, finalizeSubmission]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 dark:bg-black/75"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#121926] dark:text-slate-50"
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]">
          <div className="flex min-w-0 items-center gap-2.5">
            <ResourceBadge kind={resource.kind} />
            <h2 id={titleId} className="truncate text-sm font-bold sm:text-base">
              {resource.title}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {isExam && secondsLeft !== null && !submitted && (
              <div
                aria-label="Time remaining"
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold ${
                  secondsLeft <= 60
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                    : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {formatTimer(secondsLeft)}
              </div>
            )}

            {!submitted && (
              <button
                type="button"
                onClick={finalizeSubmission}
                className="rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-500"
              >
                {isExam ? 'Submit Exam' : 'Finish Assignment'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close assessment"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Submitted Results Screen */}
        {submitted && gradedResult ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-700 dark:bg-[#1b2436]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-bold sm:text-3xl">
                      {gradedResult.scorePercent}%
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        gradedResult.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
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
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Score: {gradedResult.earnedPoints} / {gradedResult.totalPoints} pts · Pass
                    threshold: {gradedResult.passThreshold}%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={initAttempt}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Question Review
              </h3>
              {gradedResult.questionGrades.map((grade, idx) => {
                const userLabel = formatUserAnswerLabel(grade.question, grade.userAnswer);
                const correctLabel = formatCorrectAnswerLabel(grade.question);
                return (
                  <div
                    key={grade.question.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1b2436]/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        Question {idx + 1} · {grade.earnedPoints}/{grade.maxPoints} pts
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          !grade.answered
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : grade.isCorrect
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
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
                          className="text-sm font-medium text-slate-900 dark:text-slate-100"
                        />
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <div>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Your answer:{' '}
                        </span>
                        <RichMathText text={userLabel} />
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Correct answer:{' '}
                        </span>
                        <RichMathText text={correctLabel} />
                      </div>
                      {grade.question.explanation?.trim() && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-slate-700 dark:border-slate-700 dark:bg-[#0d131f] dark:text-slate-200">
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
        ) : (
          /* Active Question View */
          <div className="flex min-h-0 flex-1 flex-col">
            {assessment.instructions?.trim() && (
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#1b2436]/50 dark:text-slate-300">
                <RichMathText text={assessment.instructions} as="div" />
              </div>
            )}

            {/* Jumpable Question Navigator */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-[#121926]">
              {orderedQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q, answers[q.id]);
                const flagged = isExam && flaggedIds.has(q.id);
                const checked = !isExam && Boolean(checkedIds[q.id]);
                const checkedGrade = checked ? gradeQuestion(q, answers[q.id]) : null;
                const isCurrent = idx === currentIndex;

                let pillColor =
                  'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200';
                if (checkedGrade) {
                  pillColor = checkedGrade.isCorrect
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-red-400 bg-red-50 text-red-800 dark:border-red-600 dark:bg-red-950/40 dark:text-red-200';
                } else if (flagged) {
                  pillColor =
                    'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200';
                } else if (answered) {
                  pillColor =
                    'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`Jump to question ${idx + 1}${flagged ? ' (flagged)' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs font-semibold ${pillColor} ${
                      isCurrent ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {idx + 1}
                    {flagged && <Flag className="ml-1 h-2.5 w-2.5 fill-current" />}
                  </button>
                );
              })}
            </div>

            {/* Question Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Question {currentIndex + 1} of {orderedQuestions.length} ·{' '}
                  {currentQuestion.points ?? 1} pt
                </span>

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
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                      isFlagged
                        ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                    {isFlagged ? 'Flagged' : 'Flag for review'}
                  </button>
                )}
              </div>

              {/* Header */}
              <div className="space-y-3">
                <QuestionHeaderImage
                  imageFile={currentQuestion.header.imageFile}
                  imageUrl={currentQuestion.header.imageUrl}
                />
                {currentQuestion.header.text && (
                  <RichMathText
                    text={currentQuestion.header.text}
                    as="div"
                    className="text-base font-medium leading-relaxed text-slate-900 dark:text-slate-50"
                  />
                )}
              </div>

              {/* Choices / Input */}
              {(currentQuestion.type === 'mcq' ||
                currentQuestion.type === 'true-false') && (
                <div className="space-y-2">
                  {optionsForCurrent.map((opt, idx) => {
                    const selected = currentAnswer === idx;
                    const isOptionCorrect = currentQuestion.correctIndices?.[0] === idx;
                    let cardStyle =
                      'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-[#1b2436]/40 dark:hover:border-slate-600';
                    if (isChecked && isOptionCorrect) {
                      cardStyle =
                        'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30';
                    } else if (isChecked && selected && !isOptionCorrect) {
                      cardStyle =
                        'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/30';
                    } else if (selected) {
                      cardStyle =
                        'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30';
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
                          className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <RichMathText text={opt} className="flex-1" />
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

                    let cardStyle =
                      'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-[#1b2436]/40 dark:hover:border-slate-600';
                    if (isChecked && isOptionCorrect) {
                      cardStyle =
                        'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30';
                    } else if (isChecked && selected && !isOptionCorrect) {
                      cardStyle =
                        'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/30';
                    } else if (selected) {
                      cardStyle =
                        'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30';
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
                          className="mt-0.5 h-4 w-4 shrink-0 rounded"
                        />
                        <RichMathText text={opt} className="flex-1" />
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
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              {/* Assignment Mode Controls: Hint & Check Answer */}
              {!isExam && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {currentQuestion.hint?.trim() && (
                      <button
                        type="button"
                        onClick={() =>
                          setHintOpenIds((prev) => ({
                            ...prev,
                            [currentQuestion.id]: !prev[currentQuestion.id],
                          }))
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {isHintOpen ? 'Hide Hint' : 'Show Hint'}
                      </button>
                    )}

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
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                      Check Answer
                    </button>
                  </div>

                  {isHintOpen && currentQuestion.hint?.trim() && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="font-semibold">Hint: </span>
                      <RichMathText text={currentQuestion.hint} />
                    </div>
                  )}

                  {isChecked && currentGrade && (
                    <div
                      className={`rounded-lg border p-3 text-xs ${
                        currentGrade.isCorrect
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200'
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

            {/* Footer Navigation */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={currentIndex >= orderedQuestions.length - 1}
                onClick={() =>
                  setCurrentIndex((i) => Math.min(orderedQuestions.length - 1, i + 1))
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
